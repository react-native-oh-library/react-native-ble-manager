/*
 * Copyright (c) 2024 Huawei Device Co., Ltd. All rights reserved
 * Use of this source code is governed by a MIT license that can be
 * found in the LICENSE file.
 */

import { TurboModuleRegistry,NativeModule } from 'react-native';
import type { TurboModule } from 'react-native/Libraries/TurboModule/RCTExport';

import { BleState, Peripheral, PeripheralInfo } from "./types";

export interface CompanionScanOptions {
    single?: boolean;
}

export interface ScanOptions {
    numberOfMatches?: Object;
    matchMode?: Object;
    callbackType?: Object;
    scanMode?: Object;
    reportDelay?: number;
    phy?: Object;
    legacy?: boolean;
    exactAdvertisingName?: string | string[];
    manufacturerData?: {
        manufacturerId: number;
        manufacturerData?: number[];
        manufacturerDataMask?: number[];
    }
    single?: boolean;
    companion?: boolean;
}

export interface StartOptions {
    showAlert?: boolean;
    restoreIdentifierKey?: string;
    queueIdentifierKey?: string;
    forceLegacy?: boolean;
}

export enum BleScanPhyMode {
    LE_1M = 1,
    LE_2M = 2,
    LE_CODED = 3,
    ALL_SUPPORTED = 255,
}

export enum ConnectionPriority {
    balanced = 0,
    high = 1,
    low = 2,
}

export interface ConnectOptions {
    autoconnect?: boolean;
    phy?: BleScanPhyMode;
}

export interface Spec extends TurboModule {
    read(peripheralId: string, serviceUUID: string, characteristicUUID: string): Promise<number[]>;
    readDescriptor(peripheralId: string, serviceUUID: string, characteristicUUID: string, descriptorUUID: string): Promise<number[]>;
    writeDescriptor(peripheralId: string, serviceUUID: string, characteristicUUID: string, descriptorUUID: string, data: number[]): Promise<void>;
    readRSSI(peripheralId: string): Promise<number>;
    retrieveServices(peripheralId: string, serviceUUIDs?: string[]): Promise<PeripheralInfo>;
    write(peripheralId: string, serviceUUID: string, characteristicUUID: string, data: number[], maxByteSize?: number): Promise<void>;
    connect(peripheralId: string, options?: ConnectOptions): Promise<void>;
    createBond(peripheralId: string, peripheralPin?: string | null): Promise<void>;
    removeBond(peripheralId: string): Promise<void>;
    disconnect(peripheralId: string, force?: boolean): Promise<void>;
    startNotification(peripheralId: string, serviceUUID: string, characteristicUUID: string): Promise<void>;
    checkState(): Promise<BleState>;
    start(options?: StartOptions): Promise<void>;
    scan(serviceUUIDs: string[], seconds: number, allowDuplicates?: boolean, scanningOptions?: ScanOptions): Promise<void>;
    stopScan(): Promise<void>;
    enableBluetooth(): Promise<void>;
    getConnectedPeripherals(serviceUUIDs?: string[]): Promise<Peripheral[]>;
    getBondedPeripherals(): Promise<Peripheral[]>;
    getDiscoveredPeripherals(): Promise<Peripheral[]>;
    requestMTU(peripheralId: string, mtu: number): Promise<number>;
    removePeripheral(peripheralId: string): Promise<void>;
    isScanning(): Promise<boolean>;
    isPeripheralConnected(peripheralId: string, serviceUUIDs?: string[]): Promise<boolean>;
    refreshCache(peripheralId: string): Promise<boolean>;
    writeWithoutResponse(peripheralId: string, serviceUUID: string, characteristicUUID: string, data: number[], maxByteSize?: number, queueSleepTime?: number): Promise<void>;
    startNotificationUseBuffer(peripheralId: string, serviceUUID: string, characteristicUUID: string, buffer: number): Promise<void>;
    stopNotification(peripheralId: string, serviceUUID: string, characteristicUUID: string): Promise<void>;
    requestConnectionPriority(peripheralId: string, connectionPriority: ConnectionPriority): Promise<boolean>;
    getAssociatedPeripherals(): Promise<Peripheral[]>;
    removeAssociatedPeripheral(peripheralId: string): Promise<void>;
    supportsCompanion(): Promise<boolean>;
    companionScan(serviceUUIDs: string[], options?: CompanionScanOptions): Promise<Peripheral | null>;
    setName(name: string): void;
    getMaximumWriteValueLengthForWithoutResponse(peripheralId: string): Promise<number>;
    getMaximumWriteValueLengthForWithResponse(peripheralId: string): Promise<number>;
}


export default TurboModuleRegistry.get<Spec>('ReactNativeBleManager')!;
