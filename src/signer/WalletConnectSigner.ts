import { Algodv2 } from "algosdk";
import { Signer } from "./types";
import { formatJsonRpcRequest } from "@json-rpc-tools/utils";
import { SignTxnRequest } from "../util/types";

export default class WalletConnectSigner implements Signer {
  algoClient: Algodv2;
  connector: any;
  constructor(algoClient: Algodv2, walletConnectConnector: any) {
    this.algoClient = algoClient;
    this.connector = walletConnectConnector;
  }

  async getSignedB64Txns(connector: any, txnsToSign: any[]) {
    const validParams = ["signers", "txn", "message"];
    const requestTxnsToSign = txnsToSign.map((e) => {
      const cleaned: any = {};
      for (const key of Object.keys(e)) {
        if (validParams.includes(key)) {
          cleaned[key] = e[key];
        }
      }
      return cleaned;
    });

    const requestParams = [requestTxnsToSign];
    const request = formatJsonRpcRequest("algo_signTxn", requestParams);
    // array of base64 encoded signed transactions
    const b64EncodedResult = await connector.sendCustomRequest(request);

    // merge partially signed array with signed transactions
    for (let i = 0; i < b64EncodedResult.length; i++) {
      if (!b64EncodedResult[i]) {
        b64EncodedResult[i] = txnsToSign[i].stxn;
      }
    }

    return b64EncodedResult;
  }

  async sign(txnsToSign: SignTxnRequest[]): Promise<Uint8Array | Uint8Array[]> {
    const b64EncodedResult = await this.getSignedB64Txns(
      this.connector,
      txnsToSign
    );

    // array of uint8 transactions
    const stxns = b64EncodedResult.map((element: any) => {
      return element ? new Uint8Array(Buffer.from(element, "base64")) : null;
    });

    return stxns;
  }

  getWalletAddress(): string | undefined {
    if (!this.connector) {
      return;
    }
    if (!this.connector?.accounts) {
      return;
    }
    if (this.connector.accounts.length <= 0) {
      return;
    }
    if (!this.connector.connected) {
      return;
    }
    const walletId = this.connector.accounts[0];
    return walletId;
  }
}
