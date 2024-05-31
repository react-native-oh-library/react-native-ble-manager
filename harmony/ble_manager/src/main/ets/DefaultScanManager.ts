import { BleTurboModule, TurboModuleContext } from './BleTurboModule';
import common from '@ohos.app.ability.common';
import { BleScanMode, ScanOptions,BleScanMatchMode, BleStopScanEvent } from './types';
import ble from '@ohos.bluetooth.ble';
import access from '@ohos.bluetooth.access';
import { HashMap } from '@kit.ArkTS';
import { BusinessError } from '@ohos.base';
import Peripheral from './PeripheralData';
import PeripheralData from './PeripheralData';

export default class DefaultScanManager{

  private isScanning:boolean = false;
  private context: TurboModuleContext | undefined = undefined;
  private bleManager:BleTurboModule | undefined = undefined;

  constructor(context:TurboModuleContext,bleManagerBleTurboModule:BleTurboModule) {
    this.context = context
    this.bleManager = bleManagerBleTurboModule
  }

  scan(serviceUUIDs:string[],seconds:number, scanningOptions: ScanOptions) {
    try {
      this.onBLEDeviceFind();
      const scanMode = scanningOptions.scanMode ? scanningOptions.scanMode : ble.ScanDuty.SCAN_MODE_LOW_POWER;
      const matchMode = scanningOptions.matchMode ? scanningOptions.matchMode : ble.MatchMode.MATCH_MODE_AGGRESSIVE;
      const reportDelay = scanningOptions.reportDelay ? scanningOptions.reportDelay : 500;
      const exactAdvertisingName = scanningOptions.exactAdvertisingName;
      let filters = this.setFilters(serviceUUIDs,exactAdvertisingName);
      let scanOptions = this.setScanOptions(scanMode,matchMode,reportDelay)
      ble.startBLEScan(filters,scanOptions);
      this.isScanning = true

    } catch (err) {
      //扫描失败
      this.offBLEDeviceFind()
      this.isScanning = false;
      let bleStopScanEvent:BleStopScanEvent = {
        status:(err as BusinessError).code
      };
      this.bleManager.sendEvent("BleManagerStopScan", bleStopScanEvent);
      this.bleManager?.logger.info('errCode: ' + (err as BusinessError).code + ', errMessage: ' + (err as BusinessError).message);
    }
    if(seconds > 0) {
      let timeoutID = setTimeout(()=> {
        //如果当前蓝牙已打开，则停止扫描
        if(access.getState() === access.BluetoothState.STATE_ON) {
          ble.stopBLEScan()
          ble.off('BLEDeviceFind')
          // this.deleteBle()
          this.isScanning = false;
          clearTimeout(timeoutID);
        }
        let bleStopScanEvent:BleStopScanEvent = {
          status:10
        };
        this.bleManager.sendEvent("BleManagerStopScan", bleStopScanEvent);
      }, seconds * 1000);

    }
  }

  setScanOptions(scanMode,matchMode,reportDelay) {
    const scanOptions: ble.ScanOptions = {
      dutyMode: ble.ScanDuty.SCAN_MODE_LOW_POWER,
      matchMode: ble.MatchMode.MATCH_MODE_AGGRESSIVE,
    };
    scanOptions.interval = reportDelay
    switch(scanMode) {
      case BleScanMode.Balanced:
        scanOptions.dutyMode = ble.ScanDuty.SCAN_MODE_BALANCED;
        break;
      case BleScanMode.LowLatency:
        scanOptions.dutyMode = ble.ScanDuty.SCAN_MODE_LOW_LATENCY;
        break;
      case BleScanMode.Opportunistic:
        break;
    }
    switch (matchMode) {
      case BleScanMatchMode.Aggressive:
        scanOptions.matchMode = ble.MatchMode.MATCH_MODE_AGGRESSIVE;
        break;
      case BleScanMatchMode.Sticky:
        scanOptions.matchMode = ble.MatchMode.MATCH_MODE_STICKY;
        break;
    }
    return scanOptions;
  }

  setFilters(serviceUUIDs:string[],exactAdvertisingName:string|string[]) {
    let filters:Array<ble.ScanFilter> = new Array<ble.ScanFilter>();
    if(serviceUUIDs.length > 0) {
      serviceUUIDs.forEach(serviceUUID => {
        let scanFilter: ble.ScanFilter = {
          serviceUuid:serviceUUID
        };
        filters.push(scanFilter);
      })
    } else {
      let scanFilter: ble.ScanFilter = {};
      filters.push(scanFilter)
    }
    if(exactAdvertisingName) {
      let exactAdvertisingNames = []
      exactAdvertisingNames.push(exactAdvertisingName)
      exactAdvertisingNames.forEach(deviceName => {
        let scanFilter: ble.ScanFilter = {
          name:deviceName
        };
        filters.push(scanFilter);
      });
    }
    return filters
  }

  onBLEDeviceFind() {
    ble.on("BLEDeviceFind", (data: Array<ble.ScanResult>)=> {
      if(data.length === 0) {
        return;
      }
      data.forEach(result => {
        this.onDiscoveredPeripheral(result);
      });
    });
  }

  offBLEDeviceFind() {
    ble.off("BLEDeviceFind");
  }

  onDiscoveredPeripheral(result:ble.ScanResult) {
    const info = result.deviceName;
    this.bleManager?.logger.info("DiscoverPeripheral: "+info);
    let peripheral = this.bleManager?.getPeripheral(result);
    if(peripheral == null) {
      peripheral = new PeripheralData(this.context,ble.createGattClientDevice(result.deviceId));
      peripheral.setDeviceId(result.deviceId);
      peripheral.setDeviceName(result.deviceName);
      peripheral.setRssi(result.rssi);
      peripheral.setData(result.data);
    } else {
      peripheral.setRssi(result.rssi);
      peripheral.setData(result.data);
    }
    console.info('device name==='+ result.deviceName);
    ble.createGattClientDevice(result.deviceId).getDeviceName((err: BusinessError, data: string)=> {
      console.info('device name err ' + JSON.stringify(err));
      console.info('device name' + JSON.stringify(data));
    })
      this.bleManager?.savePeripheral(peripheral)
      let peripheralData = peripheral.asPeripheral();
      this.bleManager?.sendEvent("BleManagerDiscoverPeripheral",peripheralData);
  }

  getIsScanning() {
    return this.isScanning
  }
}