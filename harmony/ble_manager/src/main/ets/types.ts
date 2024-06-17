export type StartOptions = {
  showAlert?: boolean,
  restoreIdentifierKey?: string,
  queueIdentifierKey?: string,
  forceLegacy?: boolean
}

export type ScanOptions = {
  numberOfMatches?: Object,
  matchMode?: BleScanMatchMode,
  callbackType?: Object,
  scanMode?: BleScanMode,
  reportDelay?: number,
  phy?: Object,
  legacy?: boolean,
  exactAdvertisingName?: string | string[],
  manufacturerData?: {
    manufacturerId: number,
    manufacturerData?: number[],
    manufacturerDataMask?: number[]
  },
  single?: boolean,
  companion?: boolean
}

export type BleConnectPeripheralEvent = {
  peripheral: string;
  status?: number;
}

export type BleStopScanEvent = {
  status?: number;
}

export type BleManagerDidUpdateStateEvent = {
  state: BleState;
}

export type Peripheral = {
  id: string;
  rssi: number;
  name?: string;
  advertising?: AdvertisingData;
}

export type AdvertisingData = {
  isConnectable?: boolean;
  localName?: string;
  rawData?: CustomAdvertisingData;
}

export type CustomAdvertisingData = {
  CDVType: "ArrayBuffer";
  bytes: ArrayBuffer;
  data: string;
}

export enum BleScanMode {
  Opportunistic = -1,
  LowPower = 0,
  Balanced = 1,
  LowLatency = 2,
}

export enum BleScanMatchMode {
  Aggressive = 1,
  Sticky = 2,
}

export enum BleState {
  /**
   * [iOS only]
   */
  Unknown = "unknown",
  /**
   * [iOS only]
   */
  Resetting = "resetting",
  Unsupported = "unsupported",
  /**
   * [iOS only]
   */
  Unauthorized = "unauthorized",
  On = "on",
  Off = "off",
  /**
   * [android only]
   */
  TurningOn = "turning_on",
  /**
   * [android only]
   */
  TurningOff = "turning_off",
}

export type PeripheralInfo = {
  serviceUUIDs?: string[];
  characteristics?: Characteristic[];
  services?: Service[];
}

export type Descriptor = {
  value: string;
  uuid: string;
}

export type Characteristic = {
  /**
   * See https://developer.apple.com/documentation/corebluetooth/cbcharacteristicproperties
   */
  properties?: {
    Broadcast?: "Broadcast";
    Read?: "Read";
    WriteWithoutResponse?: "WriteWithoutResponse";
    Write?: "Write";
    Notify?: "Notify";
    Indicate?: "Indicate";
    AuthenticatedSignedWrites?: "AuthenticatedSignedWrites";
    ExtendedProperties?: "ExtendedProperties";
    NotifyEncryptionRequired?: "NotifyEncryptionRequired";
    IndicateEncryptionRequired?: "IndicateEncryptionRequired";
  };
  characteristic: string;
  service: string;
  descriptors?: Descriptor[];
}

export type Service = {
  uuid: string;
}