import algosdk, { OnApplicationComplete } from "algosdk";

// Types for the Gradian Backend API
export interface AssetInventoryItem {
    amount: number;
    assetIndex: number;
}

export interface CreateApplicationConfig {
    args: Uint8Array[],
    localInts: number,
    localByteSlices: number,
    globalInts: number,
    globalByteSlices: number,
    onComplete: OnApplicationComplete,
    foreignAssets: number[],
    foreignApps: number[],
    accounts: string[],
    boxes: algosdk.BoxReference[]
}

export interface Wallet {
    addr: string;
    sk?: Uint8Array;
}
export type FalseyWallet = Wallet | undefined
