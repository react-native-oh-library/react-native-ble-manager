/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import ble from '@ohos.bluetooth.ble';
import { JSON, util } from '@kit.ArkTS';
import constant from '@ohos.bluetooth.constant';
import { TM } from '@rnoh/react-native-openharmony/generated/ts';
import { TurboModuleContext } from './BleTurboModule';
import { AdvertisingData, BleConnectPeripheralEvent, CustomAdvertisingData, Peripheral } from './types';
import { BusinessError } from "@kit.BasicServicesKit"
import Logger from "./BleManagerLogger"

const TAG = 'BleTurboModule'

export default class PeripheralData {
  private device: ble.GattClientDevice;
  private context: TurboModuleContext;
  private connected: boolean = false;
  private connecting: boolean = false;
  private deviceId: string;
  private deviceName: string;
  private advertisingRSSI: number;
  private advertisingDataBytes: ArrayBuffer;

  constructor(context: TurboModuleContext, bleDevice: ble.GattClientDevice) {
    this.context = context;
    this.device = bleDevice;
  }

  sendEvent(eventName: string, payload: any) {
    this.context.rnInstance.emitDeviceEvent(eventName, payload)
  }

  sendConnectionEvent(deviceId: string, eventName: string, status: number) {
    let bleConnectPeripheralEvent: BleConnectPeripheralEvent = {
      peripheral: deviceId
    }
    if (status != -1) {
      bleConnectPeripheralEvent.status = status
    }
    this.sendEvent(eventName, bleConnectPeripheralEvent);
  }

  asPeripheral() {
    let advertising: AdvertisingData = this.getAdvertising(this.deviceName, this.connected, this.advertisingDataBytes)
    let peripheral: Peripheral = {
      id: this.deviceId,
      name: this.deviceName,
      rssi: this.advertisingRSSI,
      advertising: advertising
    }
    return peripheral;
  }

  getAdvertising(name: string, isConnectable: boolean, advertisingDataBytes: ArrayBuffer) {
    let advertising: AdvertisingData = {}
    if (name) {
      advertising.localName = name;
    }
    advertising.isConnectable = isConnectable;
    advertising.rawData = this.getCustomAdvertisingData(advertisingDataBytes);
    return advertising;
  }

  getCustomAdvertisingData(advertisingDataBytes: ArrayBuffer) {
    let base64Helper = new util.Base64Helper;
    let customAdvertisingData: CustomAdvertisingData = {
      CDVType: 'ArrayBuffer',
      data: advertisingDataBytes ? base64Helper.encodeToStringSync(new Uint8Array(advertisingDataBytes)) : '',
      bytes: advertisingDataBytes ? advertisingDataBytes : null,
    }
    return customAdvertisingData;
  }

  setRssi(rssi: number) {
    this.advertisingRSSI = rssi;
  }

  getRssi() {
    return this.advertisingRSSI;
  }

  setData(data: ArrayBuffer) {
    this.advertisingDataBytes = data
  }

  connect(options: TM.ReactNativeBleManager.ConnectOptions): boolean {
    if (!this.connected && this.device) {
      this.onBLEConnectionStateChange(this.device)
      try {

        this.device.connect();
        this.connecting = true;
        return true
      } catch (error) {
        Logger.error(TAG, JSON.stringify(error))
        this.connecting = false;
        return false
      }
    }
    return true
  }

  setConnected(connected: boolean) {
    this.connected = connected;
  }

  setDevice(bleDevice: ble.GattClientDevice) {
    this.device = bleDevice;
  }

  getDevice() {
    return this.device;
  }

  setDeviceId(deviceId: string) {
    this.deviceId = deviceId;
  }

  getDeviceId() {
    return this.deviceId;
  }

  setDeviceName(deviceName: string) {
    this.deviceName = deviceName;
  }

  getDeviceName() {
    return this.deviceName;
  }

  isConnected() {
    return this.connected
  }

  readRSSI(): Promise<number> {
    if (!this.isConnected()) {
      return Promise.reject('Device is not connected')
    }
    if (!this.device) {
      return Promise.reject('Device is null')
    }
    return this.device.getRssiValue();
  }

  disconnect() {
    try {
      this.connected = false;
      if (this.device) {
        this.device.disconnect();
      }
    }catch (error){
      Logger.error('errCode: ' + (error as BusinessError).code + ', errMessage: ' + (error as BusinessError).message);
    }
  }

  onBLEConnectionStateChange(device: ble.GattClientDevice) {
    device.on('BLEConnectionStateChange', (state: ble.BLEConnectionChangeState) => {
      let connectState: ble.ProfileConnectionState = state.state;
      let deviceId: string = state.deviceId;
      this.connecting = false;
      if (connectState === constant.ProfileConnectionState.STATE_CONNECTED) {
        this.setConnected(true);
        this.sendConnectionEvent(deviceId, "BleManagerConnectPeripheral", connectState);
      } else if (connectState === constant.ProfileConnectionState.STATE_DISCONNECTED) {
        this.setConnected(false);
        this.sendConnectionEvent(deviceId, "BleManagerDisconnectPeripheral", connectState)
      }
    })
  }

  offConnectStateChanged() {
    if (this.device) {
      this.device.off('BLEConnectionStateChange')
    }
  }

  requestMTU(mtu: number): Promise<number> {
    if (!this.isConnected()) {
      return Promise.reject("Device is not connected")
    }
    if (!this.device) {
      return Promise.reject("device is null")
    }
    if (mtu) {
      try {
        this.device.setBLEMtuSize(128);
        return Promise.resolve(mtu)
      } catch (err) {
        return Promise.reject('errCode: ' + (err as BusinessError).code + ', errMessage: ' +
        (err as BusinessError).message)
      }
    }
  }

  retrieveServices(peripheralId: string, serviceUUIDs: string[]): Promise<Array<ble.GattService>> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.connected) {
          this.device.connect();
          this.device.on('BLEConnectionStateChange', (state: ble.BLEConnectionChangeState) => {
            let connectState: ble.ProfileConnectionState = state.state;
            let deviceId: string = state.deviceId;
            if (connectState === constant.ProfileConnectionState.STATE_CONNECTED) {
              this.device.getServices().then((result: Array<ble.GattService>) => {
                const array = []
                const itemArray = []
                for (let i = 0; i < result.length; i++) {
                  const item = result[i];
                  if (!array.includes(item.serviceUuid)) {
                    array.push(item.serviceUuid)
                    itemArray.push(item)
                  }
                }
                resolve(itemArray)
              });
              this.setConnected(true);
              this.sendEvent("BleManagerConnectPeripheral", connectState);
            } else if (connectState === constant.ProfileConnectionState.STATE_DISCONNECTED) {
              this.setConnected(false);
              this.sendEvent("BleManagerDisconnectPeripheral", connectState)
            }
          })
        } else {
          this.device.getServices().then((result: Array<ble.GattService>) => {
            const array = []
            const itemArray = []
            for (let i = 0; i < result.length; i++) {
              const item = result[i];
              if (!array.includes(item.serviceUuid)) {
                array.push(item.serviceUuid)
                itemArray.push(item)
              }
            }
            resolve(itemArray)
          }).catch((err) => {
            reject(err)
          });
        }
      } catch (error) {
        reject(new Error("failed"));
      }
    });
  }

  //修改后
  async write(serviceUUID: string, characteristicUUID: string, data: Uint8Array,
    maxByteSize: number, writeType: number): Promise<void> {
    if (!this.isConnected || this.device === null) {
      return Promise.reject('Device is not connected')
    }
    let result: Array<ble.GattService> = await this.device.getServices();
    let gattService: ble.GattService = result.find((gattService) => gattService.serviceUuid === serviceUUID)
    if (gattService === null || gattService === undefined) {
      return Promise.reject(`serviceUUID + ${serviceUUID} + not found.`)
    }
    let characteristic: ble.BLECharacteristic =
      this.findWritableCharacteristic(gattService, characteristicUUID, writeType);
    if (characteristic === null || characteristic === undefined) {
      return Promise.reject(`Characteristic + ${characteristicUUID} + not found.`)
    }
    const uint8Data = data
    if (data.length <= maxByteSize) {
      const isDoWriteSuccess = await this.doWrite(characteristic, uint8Data.buffer);
      if (!isDoWriteSuccess) {
        return Promise.reject("Write failed")
      } else {
        return Promise.resolve();
      }
    } else {
      let dataLength = uint8Data.buffer.byteLength;
      let count = 0;
      let firstMessage: ArrayBuffer = null;
      const splittedMessage = [];
      while (count < dataLength && (dataLength - count > maxByteSize)) {
        if (count == 0) {
          firstMessage = uint8Data.buffer.slice(count, count + maxByteSize);
        } else {
          splittedMessage.push(uint8Data.buffer.slice(count, count + maxByteSize))
        }
        count += maxByteSize;
      }
      if (count < dataLength) {
        splittedMessage.push(uint8Data.buffer.slice(count, dataLength))
      }
      //harmonyOS 默认writeType ==  ble.GattWriteType.WRITE
      let writeError: boolean = false;
      const isDoWriteSuccess = await this.doWrite(characteristic, firstMessage);
      if (!isDoWriteSuccess) {
        writeError = true;
        return Promise.reject('Write failed')
      }
      if (!writeError) {
        for (let i = 0; i < splittedMessage.length; i++) {
          let message = splittedMessage[i];
          const isDoWriteSuccess = await this.doWrite(characteristic, message);
          if (!isDoWriteSuccess) {
            writeError = true;
            return Promise.reject('Write failed')
          }
        }
      }
    }
    return Promise.resolve();
  }

  doWrite(characteristic: ble.BLECharacteristic, buffer: ArrayBuffer): Promise<boolean> {
    try {
      characteristic.characteristicValue = buffer;
      return this.device.writeCharacteristicValue(characteristic, ble.GattWriteType.WRITE).then(() => true).catch(() => false)
    } catch (error) {
      console.info('Write failed ：' + JSON.stringify(error))
      return Promise.resolve(false);
    }
  }


  findWritableCharacteristic(gattService:ble.GattService,characteristicUUID: string,writeType:number):ble.BLECharacteristic{
    let writeProperty = ble.GattWriteType.WRITE;
    if(writeType == ble.GattWriteType.WRITE_NO_RESPONSE) {
      writeProperty = ble.GattWriteType.WRITE_NO_RESPONSE
    }
    let characteristics: Array<ble.BLECharacteristic> = gattService.characteristics;
    try {
      let chara = characteristics.find((characteristic) => {
        let properties = characteristic.properties?.write ? 1 : 0
        return ((properties & writeProperty) != 0 && characteristic.characteristicUuid === characteristicUUID) ?
          characteristic : null
      })
      return chara;
    }catch (error){
      Logger.error(TAG,"Error on findWritableCharacteristic",error);
      return null;
    }
  }
}