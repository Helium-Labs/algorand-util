import algosdk, { Algodv2 } from "algosdk";
import { Signer } from "./types";
import { SignTxnRequest, Wallet } from "../util/types";

export default class KeyPairSigner implements Signer {
  wallet: Wallet;
  algoClient: Algodv2;
  constructor(algoClient: Algodv2, wallet: Wallet) {
    this.wallet = wallet;
    this.algoClient = algoClient;
    // assert this.wallet.sk is defined
    if (!this.wallet.sk) {
      throw new Error("KeyPairSigner requires a wallet with a secret key");
    }
  }
  async sign(txnsToSign: SignTxnRequest[]): Promise<Uint8Array | Uint8Array[]> {
    const stxs: Uint8Array[] = txnsToSign.map((e: SignTxnRequest) => {
      if (e.stxn) {
        // already signed
        return new Uint8Array(Buffer.from(e.stxn, "base64"));
      }
      // sign the unsigned transaction with the wallet's secret key
      const txnAsUint8Array = new Uint8Array(Buffer.from(e.txn, "base64"));
      const txn: algosdk.Transaction =
        algosdk.decodeUnsignedTransaction(txnAsUint8Array);
      if (!this.wallet.sk) {
        throw new Error("KeyPairSigner requires a wallet with a secret key");
      }

      return txn.signTxn(this.wallet.sk);
    });

    return stxs;
  }

  getWalletAddress(): string | undefined {
    return this.wallet.addr;
  }
}
