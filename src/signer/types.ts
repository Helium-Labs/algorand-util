import { Algodv2 } from "algosdk";
import { SignTxnRequest } from "../util/types";

// The base interface for IPFS pinning services.
export interface Signer {
  // must have an Algodv2 client instance variable
  algoClient: Algodv2;
  sign(
    txnsToSign: SignTxnRequest[]
  ): Promise<Uint8Array | Uint8Array[]>;

  getWalletAddress(): string | undefined;
}
