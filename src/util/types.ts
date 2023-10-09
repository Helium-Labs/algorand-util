import algosdk, { OnApplicationComplete } from "algosdk";

// Types for the Gradian Backend API
export interface AssetInventoryItem {
  amount: number;
  assetIndex: number;
}

export interface CreateApplicationConfig {
  args: Uint8Array[];
  localInts: number;
  localByteSlices: number;
  globalInts: number;
  globalByteSlices: number;
  onComplete: OnApplicationComplete;
  foreignAssets: number[];
  foreignApps: number[];
  accounts: string[];
  boxes: algosdk.BoxReference[];
}

export interface Wallet {
  addr: string;
  sk?: Uint8Array;
}
export type FalseyWallet = Wallet | undefined;

// Signed transaction in a Group transaction signing request.
export interface SignedTxnInGroup {
  txn: string;
  message: string;
  stxn: string;
  signers: Wallet[];
}
// Unsigned transaction in a Group transaction signing request.
export interface UnsignedTxnInGroup {
  txn: string;
  message: string;
}

// Transaction in a Group transaction signing request, which may or may not already be signed.
export type SignTxnRequest = {
  txn: string;
  message: string;
  stxn?: string;
  signers?: Wallet[];
};
