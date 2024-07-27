import { TurboModule, RNOHContext, RNOHLogger } from '@rnoh/react-native-openharmony/ts';
import { TM } from "@rnoh/react-native-openharmony/generated/ts"
import access from '@ohos.bluetooth.access';
import ble from '@ohos.bluetooth.ble';
import Logger from "./BleManagerLogger"
import {
  BleState,
  StartOptions,
  ScanOptions,
  BleStopScanEvent,
  BleManagerDidUpdateStateEvent,
  PeripheralInfo,
  Characteristic,
  Service,
  Descriptor,
  Peripheral
} from "./types"
import DefaultScanManager from './DefaultScanManager';
import LightWeightMap from '@ohos.util.LightWeightMap';
import { JSON } from '@kit.ArkTS';
import { BusinessError, Callback } from '@kit.BasicServicesKit';
import connection from '@ohos.bluetooth.connection';
import PeripheralData from './PeripheralData';
import Utils from './utils/Util';
import { util } from '@kit.ArkTS';


const LOGGER_NAME = 'RNBleManager'
const TAG = 'BleTurboModule'

export type TurboModuleContext = RNOHContext;

export class BleTurboModule extends TurboModule implements TM.ReactNativeBleManager.Spec {
  public logger: RNOHLogger;
  private scanManager: DefaultScanManager;
  private peripherals: LightWeightMap<string, PeripheralData> = new LightWeightMap<string, PeripheralData>();
  private bondRequest: BondRequest;
  private cValue: string = '123456';
  private gattServer: ble.GattServer | undefined = undefined;
  descriptorUuid: string;
  descriptorValue: string = 'BLEServerDescriptor';
  charValue: string = 'BLEServer';

  constructor(ctx) {
    super(ctx)
    this.logger = this.ctx.logger.clone(LOGGER_NAME)
    this.gattServer = ble.createGattServer();
  }

  refreshCache(peripheralId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  writeWithoutResponse(peripheralId: string, serviceUUID: string, characteristicUUID: string, data: number[],
    maxByteSize: number, queueSleepTime: number): Promise<void> {
    throw new Error('Method not implemented.');
  }

  startNotificationUseBuffer(peripheralId: string, serviceUUID: string, characteristicUUID: string,
    buffer: number): Promise<void> {
    throw new Error('Method not implemented.');
  }

  stopNotification(peripheralId: string, serviceUUID: string, characteristicUUID: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  requestConnectionPriority(peripheralId: string,
    connectionPriority: TM.ReactNativeBleManager.ConnectionPriority): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  getAssociatedPeripherals(): Promise<unknown[]> {
    throw new Error('Method not implemented.');
  }

  removeAssociatedPeripheral(peripheralId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  supportsCompanion(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  companionScan(serviceUUIDs: string[], options: TM.ReactNativeBleManager.CompanionScanOptions): Promise<unknown> {
    throw new Error('Method not implemented.');
  }

  setName(name: string): void {
    throw new Error('Method not implemented.');
  }

  getMaximumWriteValueLengthForWithoutResponse(peripheralId: string): Promise<number> {
    throw new Error('Method not implemented.');
  }

  getMaximumWriteValueLengthForWithResponse(peripheralId: string): Promise<number> {
    throw new Error('Method not implemented.');
  }

  read(peripheralId: string, serviceUUID: string, characteristicUUID: string): Promise<number[]> {
    let peripheral: PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve, reject) => {
      peripheral.retrieveServices(peripheralId, [serviceUUID]).then((result: Array<ble.GattService>) => {
        if (result.length > 0) {
          result.forEach(services => {
            if (services.serviceUuid == serviceUUID) {
              Utils.ArrayBuffer2String(services?.characteristics[0]?.characteristicValue)
              let descriptors: Array<ble.BLEDescriptor> = [];
              let descriptor: ble.BLEDescriptor = {
                serviceUuid: services.serviceUuid,
                characteristicUuid: characteristicUUID,
                descriptorUuid: services.characteristics[0].descriptors[0].descriptorUuid,
                descriptorValue: services.characteristics[0].descriptors[0].descriptorValue
              };
              descriptors[0] = descriptor;

              let characteristic: ble.BLECharacteristic = {
                serviceUuid: services.serviceUuid,
                characteristicUuid: characteristicUUID,
                characteristicValue: services?.characteristics[0]?.characteristicValue,
                descriptors: descriptors
              };
              peripheral.getDevice().readCharacteristicValue(characteristic, (err, bleCharacteristicDataOut) => {
                if (err != null) {
                  Logger.error(TAG, 'readCharacteristicValue error, code = ' + (err as BusinessError).code)
                  return;
                }
                const decoder = util.TextDecoder.create('"utf-8"');
                const str = decoder.decodeWithStream(new Uint8Array(bleCharacteristicDataOut.characteristicValue));
                let strToAscii: number[] = [];
                for (let i = 0; i < str.length; i++) {
                  strToAscii.push(str.charCodeAt(i));
                }
                resolve(strToAscii);
              });
            }
          })
        } else {
          reject("Device is not connected");
        }
      }).catch(error => {
        reject(error)
      })
    });
  }


  readDescriptor(peripheralId: string, serviceUUID: string, characteristicUUID: string,
    descriptorUUID: string): Promise<number[]> {
    let peripheralData: PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve, reject) => {
      peripheralData.retrieveServices(peripheralId, [serviceUUID]).then((result: Array<ble.GattService>) => {
        let descriptorValues
        if (result.length > 0) {
          result.forEach(item => {
            item.characteristics.forEach((items) => {
              items.descriptors.forEach((item) => {
                if (item.descriptorUuid.includes(descriptorUUID)) {
                  descriptorValues = item
                  return;
                }
              })
            })
          });
          if (descriptorValues.serviceUuid == serviceUUID) {
            let device: ble.GattClientDevice = peripheralData.getDevice();
            let descriptor: ble.BLEDescriptor = {
              serviceUuid: descriptorValues.serviceUuid,
              characteristicUuid: descriptorValues.characteristicUuid,
              descriptorUuid: descriptorUUID,
              descriptorValue: descriptorValues.descriptorValue
            };
            if (device) {
              device.readDescriptorValue(descriptor).then((bleCharacteristicDataOut: ble.BLEDescriptor) => {
                const decoder = util.TextDecoder.create('"utf-8"');
                const str = decoder.decodeWithStream(new Uint8Array(bleCharacteristicDataOut.descriptorValue));
                let strToAscii: number[] = [];
                for (let i = 0; i < str.length; i++) {
                  strToAscii.push(str.charCodeAt(i));
                }
                return resolve(strToAscii);
              }).catch((error) => {
                reject(error);
              })
            } else {
              reject("Reading descriptor failed");
            }
          }
        } else {
          reject("Reading descriptor failed");
        }
      }).catch(error => {
        reject(error + "Reading descriptor failed");
      })
    });
  }

  writeDescriptor(peripheralId: string, serviceUUID: string, characteristicUUID: string, descriptorUUID: string,
    data: number[]): Promise<void> {
    let peripheralData: PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve, reject) => {
      peripheralData.retrieveServices(peripheralId, [serviceUUID]).then((result: Array<ble.GattService>) => {
        if (result.length > 0) {
          let item: ble.GattService = null;
          for (let i = 0; i < result.length; i++) {
            if (result[i].serviceUuid == serviceUUID) {
              item = result[i];
              break;
            }
          }
          Utils.ArrayBuffer2String(item?.characteristics[0]?.characteristicValue)
          let device: ble.GattClientDevice = peripheralData.getDevice();
          let descBuffer = new ArrayBuffer(2);
          let descValue = new Uint8Array(descBuffer);
          descValue[0] = data[0];
          descValue[1] = data[1];
          let descriptor: ble.BLEDescriptor = {
            serviceUuid: item.serviceUuid,
            characteristicUuid: characteristicUUID,
            descriptorUuid: descriptorUUID,
            descriptorValue: descBuffer
          };
          try {
            if (device) {
              device.writeDescriptorValue(descriptor, (err) => {
                if (null == err) {
                  resolve()
                } else {
                  reject("writeDescriptor failed for descriptor")
                }
              });
              return resolve();
            } else {
              reject("writeDescriptor failed for descriptor");
            }
          } catch (error) {
            reject(error);
          }
        } else {
          reject("writeDescriptor failed for descriptor");
        }
      }).catch(error => {
        reject(error);
      })
    });
  }


  write(peripheralId: string, serviceUUID: string, characteristicUUID: string, data: number[],
    maxByteSize: number): Promise<void> {
    let peripheral: PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve, reject) => {
      peripheral.retrieveServices(peripheralId, [serviceUUID]).then((result: Array<ble.GattService>) => {
        if (result.length > 0) {
          result.forEach(services => {
            if (services.serviceUuid == serviceUUID) {
              Utils.ArrayBuffer2String(services?.characteristics[0]?.characteristicValue)
              let descriptors: Array<ble.BLEDescriptor> = [];
              let descriptor: ble.BLEDescriptor = {
                serviceUuid: services.serviceUuid,
                characteristicUuid: characteristicUUID,
                descriptorUuid: services.characteristics[0].descriptors[0].descriptorUuid,
                descriptorValue: services.characteristics[0].descriptors[0].descriptorValue
              };
              descriptors[0] = descriptor;
              let characteristic: ble.BLECharacteristic = {
                serviceUuid: services.serviceUuid,
                characteristicUuid: characteristicUUID,
                characteristicValue: new Uint8Array(data).buffer,
                descriptors: descriptors
              };

              function writeCharacteristicValueCallBack(code: BusinessError) {
                if (code != null) {
                  return;
                }
              }

              try {
                const per: PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
                let device: ble.GattClientDevice = per.getDevice();
                device.writeCharacteristicValue(characteristic, ble.GattWriteType.WRITE,
                  writeCharacteristicValueCallBack);
                resolve();
              } catch (error) {
                reject('errCode: ' + (error as BusinessError).code + ', errMessage: ' +
                (error as BusinessError).message);
              }
            }
          })
        } else {
          reject("Write failed");
        }
      }).catch(error => {
        reject(error + "Write failed")
      })
    });
  }


  startNotification(peripheralId: string, serviceUUID: string, characteristicUUID: string): Promise<void> {
    let peripheral: PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve, reject) => {
      peripheral.retrieveServices(peripheralId, [serviceUUID]).then((result: Array<ble.GattService>) => {
        if (result.length > 0) {
          result.forEach(services => {
            if (services.serviceUuid == serviceUUID) {
              Utils.ArrayBuffer2String(services?.characteristics[0].characteristicValue)
              let descriptors: Array<ble.BLEDescriptor> = [];
              let bufferDesc = new ArrayBuffer(8);
              let descV = new Uint8Array(bufferDesc);
              descV[0] = 11;
              let descriptor: ble.BLEDescriptor = {
                serviceUuid: services.serviceUuid,
                characteristicUuid: services.characteristics[0].characteristicUuid,
                descriptorUuid: services.characteristics[0].descriptors[0].descriptorUuid,
                descriptorValue: services.characteristics[0].descriptors[0].descriptorValue
              };
              descriptors[0] = descriptor;

              let characteristic: ble.BLECharacteristic = {
                serviceUuid: services.serviceUuid,
                characteristicUuid: characteristicUUID,
                characteristicValue: services?.characteristics[0]?.characteristicValue,
                descriptors: descriptors
              };
              try {
                peripheral.getDevice().setCharacteristicChangeNotification(characteristic, true)
                this.onBleCharacteristicChange(peripheral.getDevice())
                resolve()
              } catch (err) {
                reject('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message)
              }
            }
          })
        } else {
          reject("Peripheral not found")
        }
      })
    })
  }

  getConnectedPeripherals(): Promise<Peripheral[]> {
    try {
      let result: Array<string> = ble.getConnectedBLEDevices();
      const perList: Peripheral[] = [];
      result.forEach(item => {
        let peripheralData: PeripheralData = this.retrieveOrCreatePeripheral(item);
        const peripheral: Peripheral = {
          rssi: peripheralData.getRssi(),
          id: peripheralData.getDeviceId(),
          name: peripheralData.getDeviceName(),
        }
        perList.push(peripheral);
      })
      return Promise.resolve(perList);
    } catch (err) {
      Logger.error(TAG, (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
    }
  }

  getBondedPeripherals(): Promise<Peripheral[]> {
    try {
      let devices: Array<string> = connection.getPairedDevices();
      const perList: Peripheral[] = [];
      devices.forEach(item => {
        let peripheralData: PeripheralData = this.retrieveOrCreatePeripheral(item);
        const peripheral: Peripheral = {
          rssi: peripheralData.getRssi(),
          id: peripheralData.getDeviceId(),
          name: peripheralData.getDeviceName(),
        }
        perList.push(peripheral);
      })
      return Promise.resolve(perList);
    } catch (err) {
      return Promise.reject('errCode: ' + (err as BusinessError).code + ', errMessage: ' +
      (err as BusinessError).message)
    }
  }

  getDiscoveredPeripherals(): Promise<Peripheral[]> {
    const list = Array.from(this.peripherals.values())
    const perList: Peripheral[] = [];
    list.forEach(item => {
      const peripheral: Peripheral = {
        rssi: item.getRssi(),
        id: item.getDeviceId(),
        name: item.getDeviceName(),
      }
      perList.push(peripheral);
    })
    return Promise.resolve(perList);
  }

  requestMTU(peripheralId: string, mtu: number): Promise<number> {
    try {
      const peripheral = this.retrieveOrCreatePeripheral(peripheralId)
      return peripheral.requestMTU(mtu)
    } catch (err) {
      return Promise.reject("Request MTU failed")
    }
  }


  retrieveServices(peripheralId: string, serviceUUIDs?: string[]): Promise<PeripheralInfo> {
    let peripheral: PeripheralData = this.retrieveOrCreatePeripheral(peripheralId);
    return new Promise((resolve, reject) => {
      peripheral.retrieveServices(peripheralId, serviceUUIDs).then((result: Array<ble.GattService>) => {
        if (result.length > 0) {
          let newArray;
          if (serviceUUIDs?.length == 0) {
            newArray = result
          } else {
            newArray = result.filter(item => {
              if (item.characteristics[0].descriptors.length > 0) {
                if (serviceUUIDs.includes(item.serviceUuid) &&
                serviceUUIDs.includes(item.characteristics[0].descriptors[0].serviceUuid)) {
                  return item;
                }
              }
            })
          }
          const perinfoServiceUUIDs = [];
          const perinfoCharacteristics = [];
          const perinfoServices = [];
          newArray.forEach((res: ble.GattService) => {
            perinfoServiceUUIDs?.push(res.serviceUuid);
            res.characteristics.forEach((r: ble.BLECharacteristic) => {
              const perinfoDescriptor: Descriptor = {
                uuid: r.characteristicUuid,
                value: JSON.stringify(r.characteristicValue)
              }
              const character: Characteristic = {
                characteristic: r.characteristicUuid,
                service: r.serviceUuid,
                descriptors: [perinfoDescriptor],
                properties: {
                  Write: r.properties?.write ? "Write" : null
                }
              }
              perinfoCharacteristics.push(character)
            })
            const serve: Service = {
              uuid: res.serviceUuid
            }
            perinfoServices.push(serve)
          })
          const perInfo: PeripheralInfo = {
            serviceUUIDs: perinfoServiceUUIDs,
            services: perinfoServices,
            characteristics: perinfoCharacteristics,
          }
          resolve(perInfo);
        }
      }).catch(error => {
        reject(error + "Peripheral not found");
      })
    });
  }

  sendEvent(eventName: string, payload: any) {
    this.ctx.rnInstance.emitDeviceEvent(eventName, payload)
  }

  sendServices(eventName: string, payload: any) {
    this.ctx.rnInstance.emitDeviceEvent(eventName, payload)
  }


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
      default:
        stateInfo = BleState.Off
        break;
    }
    let bleManagerDidUpdateStateEvent: BleManagerDidUpdateStateEvent = {
      state: stateInfo
    }
    this.sendEvent("BleManagerDidUpdateState", bleManagerDidUpdateStateEvent);
    return Promise.resolve(stateInfo)
  }

  start(options: StartOptions): Promise<void> {
    Logger.info("start")
    this.startAdvertising()
    this.addService()
    this.onCharacteristicWrite()
    this.onCharacteristicRead()
    this.onDescriptorWrite()
    this.onDescriptorRead()
    this.scanManager = new DefaultScanManager(this.ctx, this)
    access.on('stateChange', this.onStateChange.bind(this));
    connection.on('bondStateChange', this.onBondStateChange.bind(this));
    connection.on('pinRequired', this.onPinRequired.bind(this))
    return Promise.resolve();
  }

  onStateChange(state: access.BluetoothState) {
    this.logger.info('bluetooth state = ' + JSON.stringify(state));
    let stringState = BleState.Unknown;
    switch (state) {
      case access.BluetoothState.STATE_OFF:
        stringState = BleState.Off
        this.clearPeripheral();
        break;
      case access.BluetoothState.STATE_TURNING_OFF:
        stringState = BleState.TurningOff
        this.disconnectPeripherals();
        break;
      case access.BluetoothState.STATE_ON:
        stringState = BleState.On
        break;
      case access.BluetoothState.STATE_TURNING_ON:
        stringState = BleState.TurningOn
        break;
      default:
        stringState = BleState.Off;
        break;
    }
    let bleManagerDidUpdateStateEvent: BleManagerDidUpdateStateEvent = {
      state: stringState
    }
    this.sendEvent("BleManagerDidUpdateState", bleManagerDidUpdateStateEvent)
  }

  async onBondStateChange(state: connection.BondStateParam) {
    let bondState = state.state;
    let deviceId = state.deviceId;
    let bondStateStr = 'UNKNOWN';
    switch (bondState) {
      case connection.BondState.BOND_STATE_BONDED:
        bondStateStr = "BOND_BONDED";
        break;
      case connection.BondState.BOND_STATE_BONDING:
        bondStateStr = "BOND_BONDING";
        break;
      case connection.BondState.BOND_STATE_INVALID:
        bondStateStr = "BOND_NONE";
        break;
    }
    ;
    this.logger.info("bond state: " + bondStateStr);
    if (this.bondRequest != null && this.bondRequest.uuid === deviceId) {
      if (bondState === connection.BondState.BOND_STATE_BONDED) {
        this.bondRequest.callback(null);
        this.bondRequest = null;
      } else if (bondState === connection.BondState.BOND_STATE_INVALID) {
        this.bondRequest.callback("User refused to enable");
        this.bondRequest = null;
      }
    }
    if (bondState === connection.BondState.BOND_STATE_BONDED) {
      let device: ble.GattClientDevice = ble.createGattClientDevice(deviceId)
      let peripheral = new PeripheralData(this.ctx, device)
      peripheral.setDeviceId(deviceId);
      peripheral.setDeviceName(await device.getDeviceName());
      peripheral.setConnected(true);
      peripheral.setRssi(await device.getRssiValue())
      this.sendEvent("BleManagerPeripheralDidBond", peripheral.asPeripheral());
    }
  }

  onPinRequired(data: connection.PinRequiredParam) {
    let deviceId = data.deviceId;
    if (this.bondRequest !== null && this.bondRequest.uuid === deviceId && this.bondRequest.pin != null) {
      connection.setDevicePinCode(this.bondRequest.uuid, this.bondRequest.pin, (err: BusinessError) => {
        if (err) {
          this.bondRequest.callback('setDevicePinCode,device name err:' + JSON.stringify(err))
          this.logger.info('setDevicePinCode,device name err:' + JSON.stringify(err));
        }
      })
    }
  }

  enableBluetooth(): Promise<void> {
    try {
      access.enableBluetooth();
    } catch (err) {
      return Promise.reject("Current activity not available")
    }
    return Promise.resolve();
  }

  scan(serviceUUIDs: string[], seconds: number, allowDuplicates: boolean, scanningOptions: ScanOptions): Promise<void> {
    if (this.scanManager != null) {
      this.scanManager.scan(serviceUUIDs, seconds, scanningOptions)
    }
    return Promise.resolve();
  }

  stopScan(): Promise<void> {
    ble.stopBLEScan();
    this.scanManager.setIsScanning()
    let bleStopScanEvent: BleStopScanEvent = {
      status: 0
    }
    this.sendEvent("BleManagerStopScan", bleStopScanEvent);
    return Promise.resolve();
  }

  async createBond(peripheralId: string, peripheralPin: string | null): Promise<void> {
    this.logger.info("Request bond to: " + peripheralId)
    let bondState: connection.BondState = connection.getPairState(peripheralId);
    if (bondState === connection.BondState.BOND_STATE_BONDED) {
      return Promise.resolve();
    }
    const peripheral = this.retrieveOrCreatePeripheral(peripheralId)
    if (peripheral === null || peripheral === undefined) {
      return Promise.reject('Invalid peripheral uuid');
    } else if (this.bondRequest) {
      return Promise.reject('Only allow one bond request at a time');
    } else {
      connection.pairDevice(peripheralId);
      this.bondRequest = new BondRequest(peripheralId, peripheralPin, (data) => {
        if (data) {
          return Promise.reject(data);
        }
      });
    }
    return Promise.resolve();
  }

  connect(peripheralId: string, options: TM.ReactNativeBleManager.ConnectOptions): Promise<void> {
    this.logger.info("Connect to: " + peripheralId)
    const peripheral = this.retrieveOrCreatePeripheral(peripheralId)
    if (peripheral === null || peripheral === undefined) {
      return Promise.reject("Invalid peripheral uuid")
    }
    const success = peripheral.connect(options);
    return success ? Promise.resolve() : Promise.reject("BluetoothGatt is null");
  }

  disconnect(peripheralId: string, force: boolean): Promise<void> {
    this.logger.info("Disconnect from: " + peripheralId);
    const peripheral = this.peripherals.get(peripheralId);
    if (peripheral) {
      peripheral.disconnect()
      return Promise.resolve();
    }
    return Promise.reject('Peripheral not found')
  }

  removePeripheral(peripheralId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let peripheralData = this.peripherals.get(peripheralId);
      if (peripheralData != null) {
        if (peripheralData.isConnected()) {
          reject("Peripheral can not be removed while connected")
        } else {
          this.peripherals.remove(peripheralId)
          resolve()
        }
      } else {
        resolve()
      }
    })
  }

  isScanning(): Promise<boolean> {
    if (this.scanManager) {
      return Promise.resolve(this.scanManager.getIsScanning())
    }
    return Promise.resolve(false);
  }


  isPeripheralConnected(peripheralId: string, serviceUUIDs: string[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let result: Array<string> = ble.getConnectedBLEDevices();
      result.forEach((item) => {
        return item
      })
      if (result.includes(peripheralId)) {
        return resolve(true)
      } else {
        return reject("peripheralId not found")
      }
    })
  }

  removeBond(peripheralId: string): Promise<void> {
    return Promise.resolve()
  }

  readRSSI(peripheralId: string): Promise<number> {
    this.logger.info("Read RSSI from: " + peripheralId)
    const peripheral = this.peripherals.get(peripheralId);
    if (peripheral) {
      return peripheral.readRSSI()
    }
    return Promise.reject('Peripheral not found')
  }

  savePeripheral(peripheral: PeripheralData) {
    this.peripherals.set(peripheral.getDeviceId(), peripheral)
  }

  getPeripheral(result: ble.ScanResult): PeripheralData {
    const deviceId = result.deviceId
    return this.peripherals.get(deviceId)
  }

  clearPeripheral() {
    if (!this.peripherals.isEmpty()) {
      this.peripherals.clear()
    }
  }

  disconnectPeripherals() {
    if (!this.peripherals.isEmpty()) {
      this.peripherals.forEach((value) => {
        value?.disconnect();
      })
    }
  }

  retrieveOrCreatePeripheral(peripheralId: string) {
    let peripheralData = this.peripherals.get(peripheralId);
    if (peripheralData === null || peripheralData === undefined) {
      if (peripheralId) {
        peripheralId = peripheralId.toLowerCase();
      }
      ;
      if (this.isBluetoothAddress(peripheralId)) {
        try {
          let device: ble.GattClientDevice = ble.createGattClientDevice(peripheralId);
          peripheralData = new PeripheralData(this.ctx, device);
          this.peripherals.set(peripheralId, peripheralData);
          device.connect()
        } catch (error) {
          Logger.error(JSON.stringify(error))
        }
      }
      ;
    }
    ;
    return peripheralData;
  }

  isBluetoothAddress(address: string): boolean {
    const bluetoothRegex = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;
    return bluetoothRegex.test(address);
  }

  onBleCharacteristicChange(gattClient: ble.GattClientDevice) {
    try {
      if (gattClient) {
        gattClient.on('BLECharacteristicChange', (characteristicChangeReq: ble.BLECharacteristic) => {
          let serviceUuid: string = characteristicChangeReq.serviceUuid;
          let characteristicUuid: string = characteristicChangeReq.characteristicUuid;
          let value: Uint8Array = new Uint8Array(characteristicChangeReq.characteristicValue);
          Logger.info('BluetoothPage BLECharacteristicChange value = ' + JSON.stringify(characteristicChangeReq))
        })
        Logger.info('BluetoothPage bleCharacteristicChange ');
      }
    } catch (err) {
      Logger.error(TAG, 'bleCharacteristicChange errCode: ' + (err as BusinessError).code + ', errMessage: ' +
      (err as BusinessError).message);
    }
  }

  startAdvertising() {
    let manufactureValueBuffer = new Uint8Array(4);
    manufactureValueBuffer[0] = 1;
    manufactureValueBuffer[1] = 2;
    manufactureValueBuffer[2] = 3;
    manufactureValueBuffer[3] = 4;

    let serviceValueBuffer = new Uint8Array(4);
    serviceValueBuffer[0] = 4;
    serviceValueBuffer[1] = 6;
    serviceValueBuffer[2] = 7;
    serviceValueBuffer[3] = 8;
    Logger.info(TAG, 'ble server manufactureValueBuffer = ' + JSON.stringify(manufactureValueBuffer));
    Logger.info(TAG, 'ble server serviceValueBuffer = ' + JSON.stringify(serviceValueBuffer));

    try {
      let setting: ble.AdvertiseSetting = {
        interval: 150,
        txPower: 0,
        connectable: true,
      };
      let manufactureDataUnit: ble.ManufactureData = {
        manufactureId: 4567,
        manufactureValue: manufactureValueBuffer.buffer
      };
      let serviceDataUnit: ble.ServiceData = {
        serviceUuid: '00001888-0000-1000-8000-00805f9b34fb',
        serviceValue: serviceValueBuffer.buffer
      };
      let advData: ble.AdvertiseData = {
        serviceUuids: ['00001888-0000-1000-8000-00805f9b34fb'],
        manufactureData: [manufactureDataUnit],
        serviceData: [serviceDataUnit],
        includeDeviceName: true
      };
      let advResponse: ble.AdvertiseData = {
        serviceUuids: ['00001888-0000-1000-8000-00805f9b34fb'],
        manufactureData: [manufactureDataUnit],
        serviceData: [serviceDataUnit],
      };
      let advertisingParams: ble.AdvertisingParams = {
        advertisingSettings: setting,
        advertisingData: advData,
        advertisingResponse: advResponse,
        duration: 0,
      }
      let advHandle = 0xFF;
      ble.startAdvertising(advertisingParams, (err, outAdvHandle) => {
        if (err) {
          return;
        } else {
          advHandle = outAdvHandle;
          console.log("advHandle: " + advHandle);
          this.addService()
        }
      });
    } catch (err) {
      Logger.error(TAG, 'ble server startAdvertising errCode: ' + (err as BusinessError).code + ', errMessage: ' +
      (err as BusinessError).message);
    }
  }

  addService() {
    let characteristicUuid = '00001820-0000-1000-8000-00805F9B34FB';
    let descriptors: Array<ble.BLEDescriptor> = [];
    let descriptor: ble.BLEDescriptor = {
      serviceUuid: "00001888-0000-1000-8000-00805f9b34fb",
      characteristicUuid: characteristicUuid,
      descriptorUuid: '00002902-0000-1000-8000-00805F9B34FB',
      descriptorValue: Utils.string2ArrayBuffer(this.descriptorValue)
    };

    let descriptor1: ble.BLEDescriptor = {
      serviceUuid: "00001888-0000-1000-8000-00805f9b34fb",
      characteristicUuid: characteristicUuid,
      descriptorUuid: '00002903-0000-1000-8000-00805F9B34FB',
      descriptorValue: Utils.string2ArrayBuffer(this.descriptorValue)
    };

    descriptors[0] = descriptor;
    descriptors[1] = descriptor1;

    let properties: ble.GattProperties = {
      write: true,
      writeNoResponse: false,
      read: true,
      notify: true,
      indicate: true
    }

    let characteristics: Array<ble.BLECharacteristic> = [];
    let characteristic: ble.BLECharacteristic = {
      serviceUuid: "00001888-0000-1000-8000-00805f9b34fb",
      characteristicUuid: characteristicUuid,
      characteristicValue: Utils.string2ArrayBuffer(this.charValue),
      descriptors: descriptors,
      properties: properties
    };
    characteristics[0] = characteristic;

    let gattService: ble.GattService = {
      serviceUuid: "00001888-0000-1000-8000-00805f9b34fb",
      isPrimary: true,
      characteristics: characteristics,
      includeServices: []
    };

    try {
      this.gattServer.addService(gattService);
    } catch (err) {
      Logger.error(TAG, 'ble server addService errCode: ' + (err as BusinessError).code + ', errMessage: ' +
      (err as BusinessError).message);
    }
  }

  onCharacteristicWrite() {
    try {
      this.gattServer.on('characteristicWrite', (characteristicWriteRequest: ble.CharacteristicWriteRequest) => {
        Logger.info(TAG, 'on onCharacteristicWrite start')
        let deviceId: string = characteristicWriteRequest.deviceId;
        let transId: number = characteristicWriteRequest.transId;
        let offset: number = characteristicWriteRequest.offset;
        let isPrepared: boolean = characteristicWriteRequest.isPrepared;
        let needRsp: boolean = characteristicWriteRequest.needRsp;
        let value: Uint8Array = new Uint8Array(characteristicWriteRequest.value);
        this.charValue = Utils.ArrayBuffer2String(characteristicWriteRequest.value);
        let characteristicUuid: string = characteristicWriteRequest.characteristicUuid;

        let serverResponse: ble.ServerResponse = {
          deviceId: deviceId,
          transId: transId,
          status: 0,
          offset: offset,
          value: Utils.string2ArrayBuffer(this.charValue)
        };

        let notifyCharacter: ble.NotifyCharacteristic = {
          serviceUuid: characteristicWriteRequest.serviceUuid,
          characteristicUuid: characteristicUuid,
          characteristicValue: Utils.string2ArrayBuffer(this.charValue),
          confirm: true,
        };

        try {
          this.gattServer.sendResponse(serverResponse);
          this.gattServer.notifyCharacteristicChanged(deviceId, notifyCharacter).then(() => {
            Logger.info(TAG, 'notifyCharacteristicChanged promise successfull');
            Logger.info(TAG, this.charValue)
          });

          Logger.info(TAG, 'onCharacteristicWrite send success, value = ' + JSON.stringify(serverResponse))
        } catch (err) {
          Logger.error(TAG,
            'errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
        }
      });
    } catch (err) {
      Logger.error(TAG, "errCode:" + (err as BusinessError).code + ",errMessage:" + (err as BusinessError).message);
    }
  }

  onCharacteristicRead() {
    let gattServer: ble.GattServer = this.gattServer;
    gattServer.on('characteristicRead', (characteristicReadRequest: ble.CharacteristicReadRequest) => {
      let deviceId: string = characteristicReadRequest.deviceId;
      let transId: number = characteristicReadRequest.transId;
      let offset: number = characteristicReadRequest.offset;
      let characteristicUuid: string = characteristicReadRequest.characteristicUuid;
      let rspBuffer = new ArrayBuffer(2);
      let rspValue = new Uint8Array(rspBuffer);
      rspValue[0] = 21;
      rspValue[1] = 22;
      let serverResponse: ble.ServerResponse = {
        deviceId: deviceId,
        transId: transId,
        status: 0,
        offset: offset,
        value: rspBuffer
      };

      try {
        gattServer.sendResponse(serverResponse);
        Logger.info(TAG, 'ble server onCharacteristicRead sendResponse success')
      } catch (err) {
        Logger.error(TAG,
          'errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
      }
    });
  }

  onDescriptorWrite() {
    try {
      let gattServer: ble.GattServer = this.gattServer;
      gattServer.on('descriptorWrite', (descriptorWriteRequest: ble.DescriptorWriteRequest) => {
        let deviceId: string = descriptorWriteRequest.deviceId;
        let transId: number = descriptorWriteRequest.transId;
        let offset: number = descriptorWriteRequest.offset;
        if (!descriptorWriteRequest.needRsp) {
          return;
        }
        let rspBuffer = new ArrayBuffer(0);
        let serverResponse: ble.ServerResponse = {
          deviceId: deviceId,
          transId: transId,
          status: 0,
          offset: offset,
          value: rspBuffer
        };

        try {
          gattServer.sendResponse(serverResponse);
        } catch (err) {
          Logger.error(TAG,
            'errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
        }
      });
    } catch (err) {
      Logger.error(TAG, "errCode:" + (err as BusinessError).code + ",errMessage:" + (err as BusinessError).message);
    }
  }

  onDescriptorRead() {
    let gattServer: ble.GattServer = this.gattServer;

    function ReadDescriptorReq(descriptorReadRequest: ble.DescriptorReadRequest) {
      let deviceId: string = descriptorReadRequest.deviceId;
      let transId: number = descriptorReadRequest.transId;
      let offset: number = descriptorReadRequest.offset;
      let descriptorUuid: string = descriptorReadRequest.descriptorUuid;
      let rspBuffer = new ArrayBuffer(2);
      let rspValue = new Uint8Array(rspBuffer);
      rspValue[0] = 31;
      rspValue[1] = 32;
      let serverResponse: ble.ServerResponse = {
        deviceId: deviceId,
        transId: transId,
        status: 0,
        offset: offset,
        value: rspBuffer
      };
      try {
        gattServer.sendResponse(serverResponse);
      } catch (err) {
        Logger.error(TAG,
          'errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
      }
    }

    gattServer.on('descriptorRead', ReadDescriptorReq);
  }
}

class BondRequest {
  uuid: string;
  pin: string;
  callback: Callback<string>;

  constructor(uuid: string, pin: string, callback: Callback<string>) {
    this.uuid = uuid;
    this.pin = pin;
    this.callback = callback;
  }
}
