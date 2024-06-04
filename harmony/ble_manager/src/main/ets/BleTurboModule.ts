import { TurboModule, RNOHError, Tag, RNOHContext, RNOHLogger } from '@rnoh/react-native-openharmony/ts';
import { TM } from "@rnoh/react-native-openharmony/generated/ts"
import { promptAction } from '@kit.ArkUI';
import access from '@ohos.bluetooth.access';
import ble from '@ohos.bluetooth.ble';

import { BleState,StartOptions,ScanOptions, BleStopScanEvent, BleManagerDidUpdateStateEvent ,PeripheralInfo,Characteristic,
  Service,
  Descriptor,Peripheral} from "./types"
import DefaultScanManager from './DefaultScanManager';
import LightWeightMap from '@ohos.util.LightWeightMap';
import { HashMap, JSON } from '@kit.ArkTS';
import { BusinessError, Callback } from '@kit.BasicServicesKit';
import connection from '@ohos.bluetooth.connection';
import PeripheralData from './PeripheralData';
import Utils from './utils/Util';
import { util } from '@kit.ArkTS';


const LOGGER_NAME = 'RNBleManager'

export type TurboModuleContext = RNOHContext;

export class BleTurboModule extends TurboModule implements TM.ReactNativeBleManager.Spec {
  public logger:RNOHLogger;
  private scanManager:DefaultScanManager;
  private peripherals:LightWeightMap<string,PeripheralData> = new LightWeightMap<string,PeripheralData>();
  private bondRequest:BondRequest;
  private cValue: string = '123456';
  private gattServer: ble.GattServer | undefined = undefined;
  descriptorUuid:string;
  descriptorValue: string = 'BLEServerDescriptor';
  charValue: string = 'BLEServer';

  constructor(ctx) {
    super(ctx)
    this.logger = this.ctx.logger.clone(LOGGER_NAME)
    this.gattServer = ble.createGattServer();
  }

  read(peripheralId: string, serviceUUID: string, characteristicUUID: string): Promise<number[]> {
    let peripheral : PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve,reject)=>{
      // 获取serves
      peripheral.retrieveServices(peripheralId,[serviceUUID]).then((result: Array<ble.GattService>)=>{
        // 获取到的蓝牙服务
        if (result.length > 0 ){
          result.forEach(services => {
            if (services.serviceUuid == serviceUUID) {
              Utils.ArrayBuffer2String(services?.characteristics[0]?.characteristicValue)
              let descriptors: Array<ble.BLEDescriptor> = [];
              let descriptor: ble.BLEDescriptor = {
                serviceUuid: services.serviceUuid,
                characteristicUuid:characteristicUUID,
                descriptorUuid: services.characteristics[0].descriptors[0].descriptorUuid,
                descriptorValue: services.characteristics[0].descriptors[0].descriptorValue
              };
              descriptors[0] = descriptor;

              let characteristic: ble.BLECharacteristic = {
                serviceUuid: services.serviceUuid,
                characteristicUuid:characteristicUUID,
                characteristicValue: services?.characteristics[0]?.characteristicValue,
                descriptors: descriptors
              };
              peripheral.getDevice().readCharacteristicValue(characteristic, (err, bleCharacteristicDataOut) => {
                if (err != null) {
                  console.error('readCharacteristicValue error, code = ' + (err as BusinessError).code)
                  return;
                }
                const decoder = util.TextDecoder.create('"utf-8"');
                const str = decoder.decodeWithStream(new Uint8Array(bleCharacteristicDataOut.characteristicValue));
                console.info('bluetooth readCharacteristicValue = ' + str);
                let strToAscii: number[] = [];
                for (let i = 0;i <str.length; i++) {
                  strToAscii.push(str.charCodeAt(i));
                }
                promptAction.showToast({message:'read is success'})
                resolve(strToAscii);
              });
            }
          })
        } else  {
          reject("get serves failed");
        }
      }).catch(e=>{
        reject("get serves failed")
      })
    });
  }


  readDescriptor(peripheralId: string, serviceUUID: string, characteristicUUID: string, descriptorUUID: string): Promise<number[]> {
    let peripheralData : PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve,reject)=>{
      // 获取serves
      peripheralData.retrieveServices(peripheralId,[serviceUUID]).then((result: Array<ble.GattService>)=>{
        // 获取到的蓝牙服务
        let descriptorValues
        if (result.length > 0 ){
          result.forEach(item => {
              item.characteristics.forEach((items)=>{
              items.descriptors.forEach((item)=>{
                if(item.descriptorUuid.includes(descriptorUUID)){
                  descriptorValues = item
                  return;
                }
              })
            })
          });
          if (descriptorValues.serviceUuid == serviceUUID) {
            let device:ble.GattClientDevice = peripheralData.getDevice();
            let descriptor: ble.BLEDescriptor = {
              serviceUuid: descriptorValues.serviceUuid,
              characteristicUuid: descriptorValues.characteristicUuid,
              descriptorUuid: descriptorUUID,
              descriptorValue: descriptorValues.descriptorValue
            };
            if (device) {
              device.readDescriptorValue(descriptor).then((bleCharacteristicDataOut:ble.BLEDescriptor)=>{
                const decoder = util.TextDecoder.create('"utf-8"');
                const str = decoder.decodeWithStream(new Uint8Array(bleCharacteristicDataOut.descriptorValue));
                let strToAscii: number[] = [];
                for (let i = 0;i <str.length; i++) {
                  strToAscii.push(str.charCodeAt(i));
                }
                resolve(strToAscii);
                promptAction.showToast({message:'readDescriptor is success'})
              }).catch((err)=>{
                console.log('err',err)
                reject("read failed");
              })
            } else  {
              reject("read failed");
            }
          }
        } else  {
          reject("read failed");
        }
      }).catch(err=>{
        console.log('err',err)
        reject("read failed");
      })
    });
  }

  writeDescriptor(peripheralId: string, serviceUUID: string, characteristicUUID: string, descriptorUUID: string,
    data: number[]): Promise<void> {
    let peripheralData : PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve,reject)=>{
      // 获取serves
      peripheralData.retrieveServices(peripheralId,[serviceUUID]).then((result: Array<ble.GattService>)=>{
        if (result.length > 0 ){
          let item: ble.GattService = null;
          for (let i=0;i < result.length; i++) {
            if (result[i].serviceUuid == serviceUUID) {
              item = result[i];
              break;
            }
          }
          Utils.ArrayBuffer2String(item?.characteristics[0]?.characteristicValue)
          let device:ble.GattClientDevice = peripheralData.getDevice();
          let descBuffer = new ArrayBuffer(2);
          let descValue = new Uint8Array(descBuffer);
          descValue[0] = data[0];
          descValue[1] = data[1];
          console.log('descBuffer',descBuffer)
          let descriptor: ble.BLEDescriptor = {
            serviceUuid: item.serviceUuid,
            characteristicUuid: characteristicUUID,
            descriptorUuid: descriptorUUID,
            descriptorValue: descBuffer
          };
          try {
            if (device) {
              device.writeDescriptorValue(descriptor,(err)=>{
                console.log('err',err)
                if (null == err) {
                  promptAction.showToast({message:'描述符写入成功'})
                } else {
                  promptAction.showToast({message:'描述符写入失败'})
                }
              });
              return resolve();
            } else  {
              reject("write failed");
            }
          } catch (err) {
            console.error('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
            reject("write failed");
          }
        } else  {
          reject("write failed");
        }
      }).catch(err=>{
        console.log('err',err)
        reject("write failed");
      })
    });
  }


  write(peripheralId: string, serviceUUID: string, characteristicUUID: string, data: number[],
    maxByteSize: number): Promise<void> {
    let peripheral : PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve,reject)=>{
      // 获取serves
      peripheral.retrieveServices(peripheralId,[serviceUUID]).then((result: Array<ble.GattService>)=>{
        // 获取到的蓝牙服务
        if (result.length > 0 ){
          result.forEach(services => {
            if (services.serviceUuid == serviceUUID) {
              Utils.ArrayBuffer2String(services?.characteristics[0]?.characteristicValue)
              let descriptors: Array<ble.BLEDescriptor> = [];
              let descriptor: ble.BLEDescriptor = {
                serviceUuid: services.serviceUuid,
                characteristicUuid: characteristicUUID,
                descriptorUuid: services.characteristics[0].descriptors[0].descriptorUuid,
                descriptorValue:services.characteristics[0].descriptors[0].descriptorValue
              };
              descriptors[0] = descriptor;
              let characteristic: ble.BLECharacteristic = {
                serviceUuid: services.serviceUuid,
                characteristicUuid:characteristicUUID,
                characteristicValue: new Uint8Array(data).buffer,
                descriptors: descriptors
              };

              function writeCharacteristicValueCallBack(code: BusinessError) {
                if (code != null) {
                  return;
                }
                console.log('bluetooth writeCharacteristicValue success');
              }
              try {
                const per : PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
                let device:ble.GattClientDevice = per.getDevice();
                device.writeCharacteristicValue(characteristic, ble.GattWriteType.WRITE,writeCharacteristicValueCallBack);
                promptAction.showToast({
                  message: '特征值写结束'
                })
                resolve();
              } catch (err) {
                console.error('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
                reject('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
              }
            }
          })
        } else  {
          reject("get serves failed");
        }
      }).catch(err=>{
        console.log('err',err)
        reject("get serves failed")
      })
    });
  }

  //向服务端发送设置通知此特征值请求
  startNotification(peripheralId: string, serviceUUID: string, characteristicUUID: string): Promise<void> {
    let peripheral : PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve,reject)=>{
      //获取serves
      peripheral.retrieveServices(peripheralId,[serviceUUID]).then((result: Array<ble.GattService>)=>{
        // 获取到的蓝牙服务
        if(result.length > 0){
            result.forEach(services =>{
             if(services.serviceUuid == serviceUUID){
               Utils.ArrayBuffer2String(services?.characteristics[0].characteristicValue)
               let descriptors: Array<ble.BLEDescriptor> = [];
               let bufferDesc = new ArrayBuffer(8);
               let descV = new Uint8Array(bufferDesc);
               descV[0] = 11;
               let descriptor: ble.BLEDescriptor = {
                 serviceUuid: services.serviceUuid,
                 characteristicUuid: services.characteristics[0].characteristicUuid,
                 descriptorUuid: services.characteristics[0].descriptors[0].descriptorUuid,
                 descriptorValue:services.characteristics[0].descriptors[0].descriptorValue
               };
               descriptors[0] = descriptor;

               let characteristic: ble.BLECharacteristic = {
                 serviceUuid: services.serviceUuid,
                 characteristicUuid:characteristicUUID,
                 characteristicValue: services?.characteristics[0]?.characteristicValue,
                 descriptors: descriptors
               };
               try {
                 peripheral.getDevice().setCharacteristicChangeNotification(characteristic,true)
                 this.onBleCharacteristicChange(peripheral.getDevice())
                 promptAction.showToast({message:'startNotification is success'})
               } catch (err) {
                 console.error('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
               }
             }
            })
        }else {
          reject("get serves failed")
        }
      })
    })
  }

  getConnectedPeripherals(serviceUUIDs: string[]): Promise<Peripheral[]> {
    try {
      let result: Array<string> = ble.getConnectedBLEDevices();
      const  perList : Peripheral[] = [];
      result.forEach(item=>{
        let peripheralData : PeripheralData = this.retrieveOrCreatePeripheral(item);
        const peripheral:Peripheral = {
          rssi:peripheralData.getRssi(),
          id:peripheralData.getDeviceId(),
          name:peripheralData.getDeviceName(),
        }
        perList.push(peripheral);
      })
      promptAction.showToast({message:'getConnectedPeripherals is success'})
      return Promise.resolve(perList);
    } catch (err) {
      console.error('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
    }
    throw new Error('Method not implemented.');
  }

  getBondedPeripherals(): Promise<Peripheral[]> {
    try {
      let devices: Array<string> = connection.getPairedDevices();
      const  perList : Peripheral[] = [];
      devices.forEach(item=>{
        let peripheralData : PeripheralData = this.retrieveOrCreatePeripheral(item);
        const peripheral:Peripheral = {
          rssi:peripheralData.getRssi(),
          id:peripheralData.getDeviceId(),
          name:peripheralData.getDeviceName(),
        }
        perList.push(peripheral);
      })
      promptAction.showToast({message:'getBondedPeripherals is success'})
      return Promise.resolve(perList);
    } catch (err) {
      console.error('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
      return Promise.reject('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message)
    }
  }

  getDiscoveredPeripherals(): Promise<Peripheral[]> {
    const  list = Array.from(this.peripherals.values())
    const  perList : Peripheral[] = [];
    list.forEach(item=>{
      const peripheral:Peripheral = {
        rssi:item.getRssi(),
        id:item.getDeviceId(),
        name:item.getDeviceName(),
      }
      perList.push(peripheral);
    })
    promptAction.showToast({message:'getDiscoveredPeripherals is success'})
    return Promise.resolve(perList);
  }

  requestMTU(peripheralId: string, mtu: number): Promise<number> {
    try {
      const peripheral = this.retrieveOrCreatePeripheral(peripheralId)
      return peripheral.requestMTU(mtu)
    } catch (err) {
      return Promise.reject('请设置范围为22~512字节')
    }
  }


  retrieveServices(peripheralId: string, serviceUUIDs: string[]): Promise<PeripheralInfo> {
    let peripheral : PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve,reject)=>{
      peripheral.retrieveServices(peripheralId,serviceUUIDs).then((result: Array<ble.GattService>)=>{
        // 获取到的蓝牙服务
        if (result.length > 0 ){
          // 得到符合
          const newArray = result.filter(item=>{
            if (item.characteristics[0].descriptors.length > 0) {
              if (serviceUUIDs.includes(item.serviceUuid) && serviceUUIDs.includes(item.characteristics[0].descriptors[0].serviceUuid)) {
                return item;
              }
            }
          })
          const perinfoServiceUUIDs = [];
          const perinfoCharacteristics = [];
          const perinfoServices = [];
          newArray.forEach((res:ble.GattService)=>{
            perinfoServiceUUIDs?.push(res.serviceUuid);
            res.characteristics.forEach((r:ble.BLECharacteristic )=>{
              const perinfoDescriptor:Descriptor = {
                uuid:r.characteristicUuid,
                value:JSON.stringify(r.characteristicValue)
              }
              const  character : Characteristic = {
                characteristic : r.characteristicUuid,
                service : r.serviceUuid,
                descriptors:[perinfoDescriptor]
              }
              perinfoCharacteristics.push(character)
            })
            const serve : Service = {
              uuid:res.serviceUuid
            }
            perinfoServices.push(serve)
          })
          const perInfo : PeripheralInfo= {
            serviceUUIDs:perinfoServiceUUIDs,
            services:perinfoServices,
            characteristics:perinfoCharacteristics
          }
          promptAction.showToast({message:'retrieveServices is success'})
          resolve(perInfo);
        }
        }).catch(e=>{
        reject(new Error("failed"));
      })
    });
  }

  sendEvent(eventName: string, payload: any) {
    this.ctx.rnInstance.emitDeviceEvent(eventName,payload)
  }

  sendServices(eventName: string, payload: any){
    this.ctx.rnInstance.emitDeviceEvent(eventName,payload)
  }

  //检查蓝牙开关状态
  checkState(): Promise<BleState> {
    let state = access.getState();
    let stateInfo = BleState.Off
    switch (state) {
      case access.BluetoothState.STATE_ON:
        stateInfo = BleState.On;
        break;
      case access.BluetoothState.STATE_TURNING_ON:
        stateInfo = BleState.TurningOn;
        break;
      case access.BluetoothState.STATE_TURNING_OFF:
        stateInfo = BleState.TurningOff;
        break;
      case access.BluetoothState.STATE_OFF:
      default :
        stateInfo = BleState.Off
        break;
    }
    let bleManagerDidUpdateStateEvent:BleManagerDidUpdateStateEvent = {
      state:stateInfo
    }
    this.sendEvent("BleManagerDidUpdateState", bleManagerDidUpdateStateEvent);
    return Promise.resolve(stateInfo)
  }

  start(options: StartOptions): Promise<void> {
    this.logger.info("start")
    //鸿蒙只存在一种扫描器
    this.scanManager = new DefaultScanManager(this.ctx,this)
    access.on('stateChange',this.onStateChange.bind(this));
    connection.on('bondStateChange', this.onBondStateChange.bind(this));
    connection.on('pinRequired',this.onPinRequired.bind(this))
    promptAction.showToast({message:'start is success'})
    return Promise.resolve() ;
  }

  onStateChange(state: access.BluetoothState) {
    this.logger.info('bluetooth state = '+ JSON.stringify(state));
    let stringState = BleState.Unknown;
    switch (state) {
    //表示蓝牙已关闭
      case access.BluetoothState.STATE_OFF:
        stringState = BleState.Off
        this.clearPeripheral();
        break;
    //表示蓝牙正在关闭
      case access.BluetoothState.STATE_TURNING_OFF:
        stringState = BleState.TurningOff
        this.disconnectPeripherals();
        break;
    //表示蓝牙已打开
      case access.BluetoothState.STATE_ON:
        stringState = BleState.On
        break;
    //表示蓝牙正在打开
      case access.BluetoothState.STATE_TURNING_ON:
        stringState = BleState.TurningOn
        break;
      default:
        stringState = BleState.Off;
        break;
    }
    let bleManagerDidUpdateStateEvent:BleManagerDidUpdateStateEvent = {
      state:stringState
    }
    this.sendEvent("BleManagerDidUpdateState", bleManagerDidUpdateStateEvent)
  }

  async onBondStateChange(state:connection.BondStateParam) {
    let bondState = state.state;
    let deviceId = state.deviceId;
    let bondStateStr = 'UNKNOWN';
    switch (bondState) {
      case connection.BondState.BOND_STATE_BONDED://已配对
        bondStateStr = "BOND_BONDED";
        break;
      case connection.BondState.BOND_STATE_BONDING://正在配对
        bondStateStr = "BOND_BONDING";
        break;
      case connection.BondState.BOND_STATE_INVALID:
        bondStateStr = "BOND_NONE";
        break;
    };
    this.logger.info("bond state: " + bondStateStr);
    if(this.bondRequest != null && this.bondRequest.uuid === deviceId) {
      if(bondState ===  connection.BondState.BOND_STATE_BONDED) {
        this.bondRequest.callback(null);
        this.bondRequest = null;
      } else if(bondState === connection.BondState.BOND_STATE_INVALID) {
        //无效配对
        this.bondRequest.callback("User refused to enable");
        this.bondRequest = null;
      }
    }
    if(bondState === connection.BondState.BOND_STATE_BONDED) {
      //设备绑定成功
      let device: ble.GattClientDevice = ble.createGattClientDevice(deviceId)
      let peripheral = new PeripheralData(this.ctx,device)
      peripheral.setDeviceId(deviceId);
      peripheral.setDeviceName(await device.getDeviceName());
      peripheral.setConnected(true);
      peripheral.setRssi(await device.getRssiValue())
      this.sendEvent("BleManagerPeripheralDidBond", peripheral.asPeripheral());
    }
  }

  onPinRequired(data:connection.PinRequiredParam) {
    let deviceId = data.deviceId;
    if(this.bondRequest !== null && this.bondRequest.uuid === deviceId && this.bondRequest.pin !=null) {
      connection.setDevicePinCode(this.bondRequest.uuid,this.bondRequest.pin,(err: BusinessError) => {
        if(err) {
          this.bondRequest.callback('setDevicePinCode,device name err:' + JSON.stringify(err))
          this.logger.info('setDevicePinCode,device name err:' + JSON.stringify(err));
        }
      })
    }
  }

  //打开蓝牙
  enableBluetooth(): Promise<void> {
    try {
      access.enableBluetooth();
      promptAction.showToast({message:'成功打开蓝牙'})
    } catch (err) {
      promptAction.showToast({message:'蓝牙已打开'})
      return Promise.reject('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message)
    }
    return Promise.resolve();
  }

  //开启蓝牙扫描
  scan(serviceUUIDs: string[], seconds: number, allowDuplicates: boolean, scanningOptions: ScanOptions): Promise<void> {
    if(this.scanManager != null) {
      this.scanManager.scan(serviceUUIDs,seconds,scanningOptions)
    }
    return Promise.resolve();
  }

  //关闭BLE扫描流程
  stopScan(): Promise<void> {
    ble.stopBLEScan();
    this.scanManager.setIsScanning()
    let bleStopScanEvent:BleStopScanEvent = {
      status:0
    }
    this.sendEvent("BleManagerStopScan", bleStopScanEvent);
    promptAction.showToast({message:'stopScan is success'})
    return Promise.resolve();
  }

  //绑定设备
  async createBond(peripheralId: string, peripheralPin: string | null): Promise<void> {
    this.logger.info("Request bond to: " + peripheralId)
    let bondState: connection.BondState = connection.getPairState(peripheralId);
    if( bondState === connection.BondState.BOND_STATE_BONDED) {
      //设备已匹配
      return Promise.resolve();
    }
    const peripheral = this.retrieveOrCreatePeripheral(peripheralId)
    if(peripheral === null || peripheral === undefined) {
      return Promise.reject('Invalid peripheral uuid');
    } else if (this.bondRequest){
      return Promise.reject('Only allow one bond request at a time');
    } else {
      connection.pairDevice(peripheralId);
      this.bondRequest = new BondRequest(peripheralId,peripheralPin,(data)=> {
        if(data) {
          return Promise.reject(data);
        }
      });
    }
    return Promise.resolve();
  }

  //连接
  connect(peripheralId: string, options: TM.ReactNativeBleManager.ConnectOptions): Promise<void> {
    this.logger.info("Connect to: " + peripheralId)
    const peripheral = this.retrieveOrCreatePeripheral(peripheralId)
    if(peripheral === null || peripheral === undefined) {
      return Promise.reject("Invalid peripheral uuid")
    }
    const success =  peripheral.connect(options);
    promptAction.showToast({message:'connect is success'})
    return success ? Promise.resolve() : Promise.reject("connect failed");
  }

  //断开连接
  disconnect(peripheralId: string, force: boolean): Promise<void> {
    this.logger.info("Disconnect from: " + peripheralId);
    const peripheral = this.peripherals.get(peripheralId);
    if(peripheral) {
      peripheral.disconnect()
      promptAction.showToast({message:'disconnect is success'})
      return Promise.resolve();
    }
    return Promise.reject('Peripheral not found')
  }

  //移除Peripheral
  removePeripheral(peripheralId:string):Promise<void>{
    return new Promise((resolve,reject)=>{
      let peripheralData = this.peripherals.get(peripheralId);
      if(peripheralData !=null){
        if(peripheralData.isConnected()){
            promptAction.showToast({message:'Peripheral can not be removed while connected"'})
        }else{
          this.peripherals.remove(peripheralId)
          promptAction.showToast({message:'removePeripheral is success'})
        }
      }else{
        resolve()
      }
    })
  }

  isScanning():Promise<boolean> {
    if(this.scanManager) {
      return Promise.resolve(this.scanManager.getIsScanning())
    }
    return Promise.resolve(false);
  }


  isPeripheralConnected(peripheralId: string, serviceUUIDs: string[]): Promise<boolean> {
    return new Promise((resolve,reject)=>{
      let result: Array<string> = ble.getConnectedBLEDevices();
      result.forEach((item)=>{
        return item
      })
      if(result.includes(peripheralId)){
        return resolve(true)
      }else{
        return reject("peripheralId not found")
      }
    })
  }

  //移除绑定设备
  removeBond(peripheralId: string): Promise<void> {
    promptAction.showToast({message:'此接口为系统接口，三方库无法调用'})
    return Promise.reject('此接口为系统接口，三方库无法调用')
  }

  //读取信号强度
  readRSSI(peripheralId: string): Promise<number> {
    this.logger.info("Read RSSI from: " + peripheralId)
    const peripheral = this.peripherals.get(peripheralId);
    if(peripheral) {
      return peripheral.readRSSI()
    }
    return Promise.reject('Peripheral not found')
  }

  savePeripheral(peripheral:PeripheralData) {
    this.peripherals.set(peripheral.getDeviceId(),peripheral)
  }

  getPeripheral(result:ble.ScanResult):PeripheralData {
    const deviceId = result.deviceId
    return this.peripherals.get(deviceId)
  }

  clearPeripheral() {
    if(!this.peripherals.isEmpty()) {
      this.peripherals.clear()
    }
  }

  disconnectPeripherals() {
    if(!this.peripherals.isEmpty()) {
      //TODO 蓝牙关闭时取消链接
      this.peripherals.forEach((value)=> {
        value?.disconnect();
      })
    }
  }

  retrieveOrCreatePeripheral(peripheralId:string)  {
    let peripheralData = this.peripherals.get(peripheralId);
    if(peripheralData ===  null || peripheralData === undefined) {
      if(peripheralId) {
        peripheralId = peripheralId.toLowerCase();
      };
      if(this.isBluetoothAddress(peripheralId)) {
        try {
          let device:ble.GattClientDevice = ble.createGattClientDevice(peripheralId);
          // device.connect()
          peripheralData = new PeripheralData(this.ctx,device);
          this.peripherals.set(peripheralId,peripheralData);
          device.connect()
        } catch (e) {
          console.log(JSON.stringify(e))
        }
      };
    };
    return peripheralData;
  }

  isBluetoothAddress(address: string): boolean {
    const bluetoothRegex = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;
    return bluetoothRegex.test(address);
  }

  //订阅蓝牙低功耗设备的特征值变化事件
  onBleCharacteristicChange(gattClient:ble.GattClientDevice) {
    try {
      if (gattClient) {
        gattClient.on('BLECharacteristicChange', (characteristicChangeReq: ble.BLECharacteristic) => {
          let serviceUuid: string = characteristicChangeReq.serviceUuid;
          let characteristicUuid: string = characteristicChangeReq.characteristicUuid;
          let value: Uint8Array = new Uint8Array(characteristicChangeReq.characteristicValue);
          console.log('BluetoothPage BLECharacteristicChange value = ' + JSON.stringify(characteristicChangeReq))
        })
        console.log('BluetoothPage bleCharacteristicChange ');
      }
    } catch (err) {
      console.error('bleCharacteristicChange errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
    }
  }

}

class BondRequest {
  uuid:string;
  pin:string;
  callback:Callback<string>;

  constructor(uuid:string,pin:string,callback:Callback<string>) {
    this.uuid = uuid;
    this.pin = pin;
    this.callback = callback;
  }
}
