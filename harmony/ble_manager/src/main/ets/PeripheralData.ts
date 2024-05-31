import ble from '@ohos.bluetooth.ble';
import { HashMap, JSON, util } from '@kit.ArkTS';
import common from '@ohos.app.ability.common';
import constant from '@ohos.bluetooth.constant';
import { TM } from '@rnoh/react-native-openharmony/generated/ts';
import { TurboModuleContext } from './BleTurboModule';
import { AdvertisingData, BleConnectPeripheralEvent, CustomAdvertisingData, Peripheral } from './types';
import {BusinessError} from  "@kit.BasicServicesKit"
import { promptAction } from '@kit.ArkUI';

export default class PeripheralData{

  private device: ble.GattClientDevice;
  private context: TurboModuleContext;
  private connected:boolean = false;
  private connecting:boolean = false;
  private deviceId:string;
  private deviceName:string;
  private advertisingRSSI:number;
  private advertisingDataBytes:ArrayBuffer;

  constructor(context:TurboModuleContext,bleDevice: ble.GattClientDevice) {
    this.context = context;
    this.device = bleDevice;
  }

  sendEvent(eventName: string, payload: any) {
    this.context.rnInstance.emitDeviceEvent(eventName,payload)
  }

  sendConnectionEvent(deviceId:string,eventName:string,status:number) {
    let bleConnectPeripheralEvent:BleConnectPeripheralEvent = {
      peripheral:deviceId
    }
    if(status != -1) {
      bleConnectPeripheralEvent.status = status
    }
    this.sendEvent(eventName,bleConnectPeripheralEvent);
  }

  asPeripheral() {
    let advertising:AdvertisingData = this.getAdvertising(this.deviceName,this.connected,this.advertisingDataBytes)
    let peripheral:Peripheral = {
      id:this.deviceId,
      name:this.deviceName,
      rssi:this.advertisingRSSI,
      advertising:advertising
    }
    return peripheral;
  }

  getAdvertising (name:string,isConnectable:boolean,advertisingDataBytes:ArrayBuffer) {
    let advertising:AdvertisingData = {}
    if(name) {
      advertising.localName = name;
    }
    advertising.isConnectable = isConnectable;
    advertising.rawData = this.getCustomAdvertisingData(advertisingDataBytes);
    return advertising;
  }

  getCustomAdvertisingData(advertisingDataBytes:ArrayBuffer) {
    let base64Helper = new util.Base64Helper;
    let customAdvertisingData:CustomAdvertisingData = {
      CDVType:'ArrayBuffer',
      data:advertisingDataBytes ? base64Helper.encodeToStringSync(new Uint8Array(advertisingDataBytes)) : '',
      bytes:advertisingDataBytes ? advertisingDataBytes : null,
    }
    return customAdvertisingData;
  }

  setRssi(rssi:number) {
    this.advertisingRSSI = rssi;
  }

  getRssi() {
    return this.advertisingRSSI;
  }

  setData(data:ArrayBuffer) {
    this.advertisingDataBytes = data
  }

  connect(options: TM.ReactNativeBleManager.ConnectOptions) : boolean {
    if(!this.connected && this.device) {
      this.onBLEConnectionStateChange(this.device)
      try {
        this.device.connect();
        this.connecting = true;
        return true
      } catch (e) {
        console.log(JSON.stringify(e))
        this.connecting = false;
        return false
      }
    }
    return true
  }

  setConnected(connected:boolean) {
    this.connected = connected;
  }

  setDevice(bleDevice:ble.GattClientDevice) {
    this.device = bleDevice;
  }

  getDevice() {
    return this.device;
  }

  setDeviceId(deviceId:string) {
    this.deviceId = deviceId;
  }

  getDeviceId() {
    return this.deviceId;
  }

  setDeviceName(deviceName:string) {
    this.deviceName = deviceName;
  }

  getDeviceName () {
    return this.deviceName;
  }

  isConnected() {
    return this.connected
  }

  isConnecting() {

  }

  readRSSI():Promise<number> {
    if(!this.isConnected()) {
      return Promise.reject('Device is not connected')
    }
    if (!this.device) {
      return Promise.reject('Device is null')
    }
    return this.device.getRssiValue();
  }

  disconnect(){
    //做断开链接操作
    this.connected = false;
    if(this.device) {
      this.device.disconnect();
    }
  }

  onBLEConnectionStateChange(device: ble.GattClientDevice) {
    device.on('BLEConnectionStateChange',(state: ble.BLEConnectionChangeState) => {
      let connectState: ble.ProfileConnectionState = state.state;
      let deviceId:string = state.deviceId;
      this.connecting = false;
      if(connectState === constant.ProfileConnectionState.STATE_CONNECTED ) {
        //表示设备已连接
        this.setConnected(true);
        promptAction.showToast({message:'connect is success'})
        //TODO 获取服务
        this.sendConnectionEvent(deviceId, "BleManagerConnectPeripheral", connectState);
      } else if(connectState === constant.ProfileConnectionState.STATE_DISCONNECTED){
        //表示设备断开链接
        this.setConnected(false);
        this.sendConnectionEvent(deviceId,"BleManagerDisconnectPeripheral",connectState)
      }
    })
  }

  offConnectStateChanged() {
    if(this.device) {
      this.device.off('BLEConnectionStateChange')
    }
  }

  getServices() {

  }

  requestMTU(mtu:number):Promise<number>{
    if(!this.isConnected()){
      return Promise.reject("Device is not connected")
    }
    if(!this.device){
      return Promise.reject("device is null")
    }
    if(mtu){
      try {
        this.device.setBLEMtuSize(128);
        return Promise.resolve(mtu)
      } catch (err) {
        return Promise.reject('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message)
      }
    }
  }

  retrieveServices(peripheralId: string, serviceUUIDs: string[]):Promise<Array<ble.GattService>> {
    return new Promise((resolve,reject)=>{
      try {
        if (!this.connected) {
          this.device.connect();
          this.device.on('BLEConnectionStateChange',(state: ble.BLEConnectionChangeState) => {
            let connectState: ble.ProfileConnectionState = state.state;
            let deviceId:string = state.deviceId;

            if(connectState === constant.ProfileConnectionState.STATE_CONNECTED ) {
              //表示设备已连接
              this.device.getServices().then((result: Array<ble.GattService>) => {
                const array = []
                const itemarray = []
                for(let i =0;i<result.length;i++){
                  const item = result[i];
                  if (!array.includes(item.serviceUuid)) {
                    array.push(item.serviceUuid)
                    itemarray.push(item)
                  }
                }
                console.log("connect success")
                resolve(itemarray)
              });
              this.setConnected(true);
              //TODO 获取服务
              this.sendEvent("BleManagerConnectPeripheral", connectState);
            } else if(connectState === constant.ProfileConnectionState.STATE_DISCONNECTED){
              //表示设备断开链接
              this.setConnected(false);
              this.sendEvent("BleManagerDisconnectPeripheral",connectState)
            }
          })
        } else  {
          this.device.getServices().then((result: Array<ble.GattService>) => {
            const array = []
            const itemarray = []
            for(let i =0;i<result.length;i++){
              const item = result[i];
              if (!array.includes(item.serviceUuid)) {
                array.push(item.serviceUuid)
                itemarray.push(item)
              }
            }
            resolve(itemarray)
          }).catch((err)=>{
            console.log('err----',err)
          });
        }
      } catch (e) {
        reject(new Error("failed"));
        console.log("failed")
      }
    });
  }
}