import algosdk, { Algodv2, makeApplicationCreateTxn } from "algosdk";
import { arc69Mimetypes } from "./constants";
import {
  AssetInventoryItem,
  CreateApplicationConfig,
  FalseyWallet,
  SignTxnRequest,
  Wallet,
} from "./types";

/**
 * Algorand Utility class
 */
export default class AlgorandUtil {
  algoClient: algosdk.Algodv2;
  /**
   * @param {Algodv2} algorandClient Algorand client instance
   * @returns AlgorandUtil instance
   */
  constructor(algorandClient: Algodv2) {
    this.algoClient = algorandClient;
  }

  /**
   * Compile a program source file
   * @param programSource
   * @returns
   */
  async compileProgram(programSource: string) {
    let encoder = new TextEncoder();
    let programBytes = encoder.encode(programSource);
    let compileResponse = await this.algoClient.compile(programBytes).do();
    let compiledBytes = new Uint8Array(
      Buffer.from(compileResponse.result, "base64")
    );
    return compiledBytes;
  }

  /**
   * Waits for Confirmation of the client
   * @param {*} client Algorand client
   * @param {*} txId Transaction id to wait for confirmation
   */
  async awaitForConfirmation(txId: any) {
    const status = await this.algoClient.status().do();
    let lastRound = status["last-round"];
    while (true) {
      const pendingInfo = await this.algoClient
        .pendingTransactionInformation(txId)
        .do();
      if (
        pendingInfo["confirmed-round"] !== null &&
        pendingInfo["confirmed-round"] > 0
      ) {
        // Got the completed Transaction
        break;
      }
      lastRound++;
      await this.algoClient.statusAfterBlock(lastRound).do();
    }
  }

  /**
   * Sends a raw transaction to the network
   * @param {Uint8Array | Uint8Array[]} signedTxn Signed transaction to send
   * @returns Raw transaction response
   */
  async sendRawTransaction(
    signedTxn: Uint8Array[] | Uint8Array
  ): Promise<Record<string, any>> {
    console.log("Sending Raw Transaction.");
    const { txId } = await this.algoClient.sendRawTransaction(signedTxn).do();

    await this.awaitForConfirmation(txId);

    const txResponse = await this.algoClient
      .pendingTransactionInformation(txId)
      .do();
    console.log(
      "Transaction",
      txId,
      "confirmed in round",
      txResponse["confirmed-round"],
      "with application id:",
      txResponse["application-index"]
    );

    return txResponse;
  }

  /**
   * Executes a transaction after signing it with the provided wallet
   * @param {any} txn Transaction to execute
   * @param {Wallet} wallet Wallet to sign the transaction with
   * @returns {Promise<Record<string, any>>} Raw transaction response
   */
  async executeTransaction(
    txn: any,
    wallet: Wallet
  ): Promise<Record<string, any>> {
    const signedTxn = txn.signTxn(wallet.sk);
    const txId = txn.txID().toString();
    console.log("Signed transaction with txID: %s", txId);
    return await this.sendRawTransaction(signedTxn);
  }

  /**
   * Group an array of transactions, and sign them with the provided wallets if possible returning a group of partially signed transactions.
   * @param {algosdk.Transaction[]} txns Transactions to group and (partially) sign
   * @param {FalseyWallet[]} accounts Wallets to sign the transactions with, if possible (i.e. sk is available)
   * @returns {Promise<SignTxnRequest[]>} Grouped transactions, signed if possible with the provided wallets
   */
  async generateGroupTransactionSigningRequest(
    txns: algosdk.Transaction[],
    accounts: FalseyWallet[]
  ): Promise<SignTxnRequest[]> {
    algosdk.assignGroupID(txns);
    const stxns: SignTxnRequest[] = [];
    /*
    if account is undefined, then it needs user signing i.e. it remains an unsigned transaction.
    */
    for (let idx = 0; idx < txns.length; idx++) {
      if (accounts[idx]?.sk !== undefined) {
        // wallet is defined, so sign the transaction
        const wallet: Wallet = accounts[idx] as Wallet;
        if (!wallet.sk) {
          throw new Error("Wallet does not have a secret key");
        }
        let signedTxn: Uint8Array = txns[idx].signTxn(wallet.sk);
        const encodedTxn = Buffer.from(
          algosdk.encodeUnsignedTransaction(txns[idx])
        ).toString("base64");

        // convert to base64 for compact transport
        let buff = Buffer.from(signedTxn);
        let base64EncodedTxn = buff.toString("base64");

        // doesn't need signing, indicated with the signers array
        stxns.push({
          stxn: base64EncodedTxn,
          txn: encodedTxn,
          message: "Gradian Transaction Signing Request",
          signers: [],
        });
      } else {
        const encodedTxn = Buffer.from(
          algosdk.encodeUnsignedTransaction(txns[idx])
        ).toString("base64");
        stxns.push({
          txn: encodedTxn,
          message: "Gradian Transaction Signing Request",
        });
      }
    }

    // return the partially signed transactions
    return stxns;
  }

  /**
   * Submit array of signed transactions to the network
   * @param {any[]} signedTxns Array of signed transactions {stxn: base64EncodedTxn, txn: encodedTxn, message: "Gradian Transaction Signing Request", signers: []}
   * @returns {Promise<Record<string, any>>} Raw transaction response
   */
  async submitSignedTransactions(
    signedTxns: any[]
  ): Promise<Record<string, any>> {
    const stxnsUint8Array: Uint8Array[] = signedTxns.map((stxn: any) => {
      return new Uint8Array(Buffer.from(stxn.stxn, "base64"));
    });
    const response = await this.sendRawTransaction(stxnsUint8Array);
    return response;
  }

  /**
   * Opt the user into the app
   * @param {string} wallet_address
   * @param {number} appId
   * @returns {Promise<any[]>}
   */
  async appOptIn(wallet_address: string, appId: number): Promise<any[]> {
    const suggestedParams = await this.algoClient.getTransactionParams().do();
    let txn = algosdk.makeApplicationOptInTxn(
      wallet_address,
      suggestedParams,
      appId
    );
    const stxns = await this.generateGroupTransactionSigningRequest([txn], [undefined]);

    return stxns;
  }

  /**
   * Check whether the user has opted in to the app
   * @param {string} walletAddr
   * @param {number} appIndex
   * @returns {Promise<boolean>} true if the user has opted in, false otherwise
   */
  async hasOptedIn(walletAddr: string, appIndex: number): Promise<boolean> {
    const appInfo = await this.getAppInfoInUserContext(walletAddr, appIndex);
    return appInfo !== undefined;
  }

  /**
   * Tests whether the server has opted in to the app
   * @param {number} appId
   * @returns {Promise<any>} Transaction response
   */
  async testAppOptIn(appId: number, wallet: Wallet): Promise<any> {
    const isOptedIn = await this.hasOptedIn(wallet.addr, appId);
    if (isOptedIn) {
      return;
    }
    const suggestedParams = await this.algoClient.getTransactionParams().do();
    let txn = algosdk.makeApplicationOptInTxn(
      wallet.addr,
      suggestedParams,
      appId
    );
    const stxns = await this.generateGroupTransactionSigningRequest([txn], [wallet]);

    await this.submitSignedTransactions(stxns);

    return stxns;
  }

  /**
   * Opt the wallet into the given asset
   * @param {Wallet} wallet
   * @param {number} assetId
   * @returns {Promise<Record<string, any>>} Raw transaction response
   */
  async assetOptIn(wallet: any, assetId: any): Promise<Record<string, any>> {
    const suggestedParams = await this.algoClient.getTransactionParams().do();
    const txnAssetOptIn =
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: wallet.addr,
        to: wallet.addr,
        assetIndex: assetId,
        amount: 0,
        suggestedParams: suggestedParams,
      });
    const stxns = await this.executeTransaction(txnAssetOptIn, wallet);
    return stxns;
  }

  /**
   * Asset transfer
   * @param {any} from_wallet
   * @param {string} to_addr
   * @param {number} assetId
   * @param {number} amount
   * @returns {Promise<any[]>} Array of partially signed transactions
   */
  async assetTransfer(
    from_wallet: any,
    to_addr: string,
    assetId: number,
    amount: number
  ): Promise<any[]> {
    const suggestedParams = await this.algoClient.getTransactionParams().do();
    const transferTx =
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: from_wallet.addr,
        to: to_addr,
        assetIndex: assetId,
        amount: amount,
        suggestedParams,
      });
    const stxns = await this.generateGroupTransactionSigningRequest(
      [transferTx],
      [from_wallet]
    );
    return stxns;
  }

  /**
   * Asset transfer without signing the transaction
   * @param {any} from_wallet
   * @param {string} to_addr
   * @param {number} assetId
   * @param {number} amount
   * @returns {Promise<algosdk.Transaction>} Array of partially signed transactions
   */
  async assetTransferWithoutSigning(
    from_wallet: any,
    to_addr: string,
    assetId: number,
    amount: number
  ): Promise<algosdk.Transaction> {
    const suggestedParams = await this.algoClient.getTransactionParams().do();
    const transferTx =
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: from_wallet.addr,
        to: to_addr,
        assetIndex: assetId,
        amount: amount,
        suggestedParams,
      });
    return transferTx;
  }

  /**
   * Many asset transfers
   * @param {Wallet} from_wallet
   * @param {string} to_addr
   * @param {AssetInventoryItem[]} assets
   * @returns {Promise<boolean>} true if all transfers were successful
   */
  async assetsTransfer(
    from_wallet: Wallet,
    to_addr: string,
    assets: AssetInventoryItem[]
  ): Promise<boolean> {
    const promises: Promise<any>[] = [];
    for (const asset of assets) {
      const { amount, assetIndex } = asset;
      const transferAssetPromise = this.assetTransfer(
        from_wallet,
        to_addr,
        assetIndex,
        amount
      );
      promises.push(transferAssetPromise);
    }
    await Promise.all(promises);
    return true;
  }

  /**
   * opt-in to all assets in the given array as a group transaction
   * @param {number[]} assets
   * @param {string} walletAddr
   * @param {FalseyWallet} wallet
   * @returns {Promise<any[]>} array of signed transactions responses
   */
  async optInAssetsAsGroupTransaction(
    assets: number[],
    walletAddr: string,
    wallet: FalseyWallet = undefined
  ): Promise<any[]> {
    // remove duplicates from assets array
    assets = [...new Set(assets)];

    // send 0 of each asset to self to opt in
    const suggestedParams = await this.algoClient.getTransactionParams().do();
    const assetOptInTxns = assets.map((assetIndex: number) => {
      return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: walletAddr,
        to: walletAddr,
        assetIndex,
        amount: 0,
        suggestedParams,
      });
    });
    const stxns = await this.generateGroupTransactionSigningRequest(
      assetOptInTxns,
      Array(assets.length).fill(wallet)
    );
    return stxns;
  }

  /**
   * Returns the wallet info for the given wallet address
   * @param {string} walletAddr
   * @returns {Promise<Record<string, any>>} WalletInfo for given address
   */
  async getWalletInfo(walletAddr: string): Promise<Record<string, any>> {
    let accountInfo = await this.algoClient.accountInformation(walletAddr).do();
    return accountInfo;
  }

  /**
   * Get the application info for the given application index
   * @param {number} index
   * @returns {Promise<Record<string, any>>} Application info
   */
  async getApplicationInfo(index: number) {
    const appInfo = await this.algoClient.getApplicationByID(index).do();
    return appInfo;
  }

  /**
   * @todo Implement this
   * Get box value for the given application
   * @param {number} appIndex
   * @param {string} b64BoxName
   * @returns {Promise<void>}
   */
  async getBoxValueForApplication(appIndex: number, boxName: string) {
    const response = await this.algoClient
      .getApplicationBoxByName(appIndex, Buffer.from(boxName))
      .do();
    return response.value;
  }

  /**
   * Get the global state value for the given application index for the given base64 encoded variable name
   * @param {number} index
   * @param {string} b64VarName
   * @returns {Promise<string | number>} value of the global state variable
   */
  async getGlobalStateValue(index: number, b64VarName: string) {
    const info = await this.getApplicationInfo(index);

    const params = info.params;

    const globalState = params["global-state"];

    const valueArray = globalState.filter((obj: any) => {
      console.log(obj, obj.key === b64VarName);
      return obj.key === b64VarName;
    });

    const state = valueArray.pop();
    if (state === undefined) {
      throw new Error("No such global state variable.");
    }

    const value = state.value;

    const type = parseInt(value.type);
    if (type === 1) {
      // bytes type. Return b64 string.
      return value.bytes;
    }

    if (type === 2) {
      const uintValue = parseInt(value.uint);
      return uintValue;
    }

    throw new Error("Type is not handled");
  }

  /**
   * Get the app info for the user context for the given application index
   * @param {string} walletAddr
   * @param {number} appIndex
   * @returns {Promise<Record<string, any>>} app info for the user context
   */
  async getAppInfoInUserContext(walletAddr: string, appIndex: number) {
    const info = await this.getWalletInfo(walletAddr);
    const localState = info["apps-local-state"];

    const appInfo = localState
      .filter((obj: any) => {
        return obj.id === appIndex;
      })
      .pop();

    return appInfo;
  }

  /**
   * Get the local state value for the given application index for the given base64 encoded variable name
   * @param {string} walletAddr
   * @param {number} appIndex
   * @param {string} b64VarName
   * @returns {Promise<string | number>} value of the local state variable
   */
  async getLocalStateValue(
    walletAddr: string,
    appIndex: number,
    b64VarName: string
  ) {
    const appInfo = await this.getAppInfoInUserContext(walletAddr, appIndex);
    if (appInfo === undefined) {
      throw new Error("user hasn't opted into app");
    }

    const appKV = appInfo["key-value"];
    if (appKV === undefined) {
      // it's undefined, so the user has opted in but hasn't set any local state
      return undefined;
    }
    const variable = appKV
      .filter((obj: any) => {
        return obj.key === b64VarName;
      })
      .pop();

    if (variable === undefined) {
      return undefined;
    }

    const value = variable.value;
    const type = parseInt(value.type);
    // 1 = bytes, 2 = uint
    if (type === 1) {
      return value.bytes;
    }
    if (type === 2) {
      const uintValue = parseInt(value.uint);
      return uintValue;
    }

    throw new Error("Type is not handled");
  }

  /**
   * Get the application wallet info for the given application index
   * @param {number} index
   * @returns {Promise<Record<string, any>>} WalletInfo for the application wallet
   */
  async getApplicationWalletInfo(index: number) {
    const appWallet = algosdk.getApplicationAddress(index);
    const walletInfo = this.getWalletInfo(appWallet);
    return walletInfo;
  }

  /**
   * Get the assets array for the given application index
   * @param {number} index
   * @returns {Promise<number[]>} array of asset indices
   */
  async getForeignAssetsArray(index: number) {
    // assets
    const info = await this.getApplicationWalletInfo(index);
    const assets = info.assets.map((asset: any) => asset["asset-id"]);
    return assets;
  }

  /**
   * Convert an array of asset indices into a Uint8Array for use in a transaction
   * @param {number[]} assets
   * @returns {Uint8Array} encoded asset array as a Uint8Array
   */
  generateAssetByteArray(assets: number[]): Uint8Array {
    const sizeOf = 8;
    const length = sizeOf * assets.length;
    const result = new Uint8Array(length);

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const assetUint64 = algosdk.encodeUint64(asset);
      const offset = i * sizeOf;
      result.set(assetUint64, offset);
    }

    return result;
  }

  /**
   * encodes an array of asset indices into a Uint8Array for use in a transaction
   * @param {number[]} assets
   * @returns {Uint8Array} encoded asset array as a Uint8Array
   */
  encodeAssetArrayToUint8Array(assets: number[]): Uint8Array {
    const assetByteArray = this.generateAssetByteArray(assets);
    return assetByteArray;
  }

  /**
   * create smart contract application from source code and config
   * @param {string} approvalSource
   * @param {string} clearSource
   * @param {CreateApplicationConfig} config
   * @param {string} creatorAddr
   * @param {FalseyWallet} creatorWallet
   * @returns {Promise<any[]>} array of transactions
   */
  async createApplication(
    approvalSource: string,
    clearSource: string,
    config: CreateApplicationConfig,
    creatorAddr: string,
    creatorWallet: FalseyWallet = undefined
  ): Promise<any[]> {
    const {
      args,
      localInts,
      localByteSlices,
      globalInts,
      globalByteSlices,
      onComplete,
      foreignAssets,
      foreignApps,
      accounts,
      boxes,
    } = config;

    const [approvalProgram, clearProgram, params] = await Promise.all([
      this.compileProgram(approvalSource),
      this.compileProgram(clearSource),
      this.algoClient.getTransactionParams().do(),
    ]);

    // make application create txn
    const txn = makeApplicationCreateTxn(
      creatorAddr,
      params,
      onComplete,
      approvalProgram,
      clearProgram,
      localInts,
      localByteSlices,
      globalInts,
      globalByteSlices,
      args,
      accounts,
      foreignApps,
      foreignAssets,
      undefined,
      undefined,
      undefined,
      undefined,
      boxes
    );

    const stxns = await this.generateGroupTransactionSigningRequest([txn], [creatorWallet]);

    return stxns;
  }

  /**
   * create smart contract application from source code and config
   * @param {string} approvalSource
   * @param {string} clearSource
   * @param {CreateApplicationConfig} config
   * @param {string} creatorAddr
   * @param {FalseyWallet} creatorWallet
   * @returns {Promise<algosdk.Transaction>} unsigned transaction
   */
  async createApplicationWithoutSigning(
    approvalSource: string,
    clearSource: string,
    config: CreateApplicationConfig,
    creatorAddr: string
  ): Promise<algosdk.Transaction> {
    const {
      args,
      localInts,
      localByteSlices,
      globalInts,
      globalByteSlices,
      onComplete,
      foreignAssets,
      foreignApps,
      accounts,
      boxes,
    } = config;

    const approvalProgram = await this.compileProgram(approvalSource);
    const clearProgram = await this.compileProgram(clearSource);

    // get node suggested parameters
    const params = await this.algoClient.getTransactionParams().do();

    // make application create txn
    const txn = makeApplicationCreateTxn(
      creatorAddr,
      params,
      onComplete,
      approvalProgram,
      clearProgram,
      localInts,
      localByteSlices,
      globalInts,
      globalByteSlices,
      args,
      accounts,
      foreignApps,
      foreignAssets,
      undefined,
      undefined,
      undefined,
      undefined,
      boxes
    );

    return txn;
  }

  /**
   * Update smart contract application from source code and config
   * @param {string} approvalSource
   * @param {string} clearSource
   * @param {number} appIndex
   * @param {string} creatorAddr
   * @param {FalseyWallet} creatorWallet
   * @returns {Promise<any>} transaction
   */
  async updateApplication(
    approvalSource: string,
    clearSource: string,
    appIndex: number,
    creatorAddr: string,
    creatorWallet: FalseyWallet = undefined
  ): Promise<any> {
    const approvalProgram = await this.compileProgram(approvalSource);
    const clearProgram = await this.compileProgram(clearSource);
    const params = await this.algoClient.getTransactionParams().do();
    const txn = algosdk.makeApplicationUpdateTxn(
      creatorAddr,
      params,
      appIndex,
      approvalProgram,
      clearProgram
    );
    const stxns = await this.generateGroupTransactionSigningRequest([txn], [creatorWallet]);

    return stxns;
  }

  /**
   * Return all Algorand from the application to the creator
   * @param {FalseyWallet} serverWallet
   * @param {number} appIndex
   * @returns {Promise<Record<string, any>>} transaction response
   */
  async commonApplicationClaimFees(
    serverWallet: FalseyWallet,
    claimFeesFcnName: string,
    appIndex: number
  ) {
    if (serverWallet === undefined) {
      throw new Error("serverWallet is undefined");
    }
    // claim the fees from the application
    // const foreignAssets = await getForeignAssetsArray(appIndex)
    // console.log("foreignAssets", foreignAssets)

    const appArgs = [new Uint8Array(Buffer.from(claimFeesFcnName))];
    const suggestedParams = await this.algoClient.getTransactionParams().do();

    const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
      from: serverWallet.addr,
      suggestedParams: suggestedParams,
      appIndex,
      appArgs,
      accounts: [serverWallet.addr],
    });

    const stxns = await this.generateGroupTransactionSigningRequest([appTxn], [serverWallet]);
    const response = await this.submitSignedTransactions(stxns);

    console.log(`[Contract ${appIndex}] Claimed fees`);
    return response;
  }

  /**
   * Opt application into asset
   * @param {FalseyWallet} serverWallet
   * @param {number} assetIndex
   * @param {string} optInAssetFcnName
   * @param {number} appIndex
   * @returns {Promise<Record<string, any>>} transaction response
   */
  async commonApplicationOptIntoAsset(
    serverWallet: FalseyWallet,
    assetIndex: number,
    optInAssetFcnName: string,
    appIndex: number
  ) {
    if (serverWallet === undefined) {
      throw new Error("serverWallet is undefined");
    }

    const suggestedParams = await this.algoClient.getTransactionParams().do();
    const appArgs = [
      new Uint8Array(Buffer.from(optInAssetFcnName)),
      algosdk.encodeUint64(assetIndex),
    ];

    const appTxn = algosdk.makeApplicationNoOpTxnFromObject({
      from: serverWallet.addr,
      suggestedParams: suggestedParams,
      appIndex,
      appArgs,
      accounts: [serverWallet.addr],
      foreignAssets: [assetIndex],
    });

    const stxns = await this.generateGroupTransactionSigningRequest([appTxn], [serverWallet]);
    const response = await this.submitSignedTransactions(stxns);

    console.log(`[Contract ${appIndex}] Opted into asset:`, assetIndex);
    return response;
  }

  /**
   * Opt application into assets
   * @param {FalseyWallet} serverWallet
   * @param {number[]} assetIndices
   * @param {string} optInAssetFcnName
   * @param {number} appIndex
   * @returns {Promise<any[]>} array of transactions
   */
  async commonApplicationOptIntoAssets(
    serverWallet: FalseyWallet,
    assetIndices: number[],
    optInAssetFcnName: string,
    appIndex: number
  ) {
    const promises: Promise<any>[] = [];
    for (const assetIndex of assetIndices) {
      const promise = this.commonApplicationOptIntoAsset(
        serverWallet,
        assetIndex,
        optInAssetFcnName,
        appIndex
      );
      promises.push(promise);
    }
    await Promise.all(promises);
  }

  /**
   * send Algo to address
   * @param {FalseyWallet} serverWallet
   * @param {number} amount
   * @param {string} address
   * @returns {any[]} array of (partially) signed transactions
   */
  async sendAlgo(serverWallet: FalseyWallet, amount: number, address: string) {
    if (serverWallet === undefined) {
      throw new Error("serverWallet is undefined");
    }

    // get suggested parameters
    const suggestedParams = await this.algoClient.getTransactionParams().do();

    // Pay the app
    let paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: serverWallet.addr,
      to: address,
      amount: amount,
      suggestedParams: suggestedParams,
    });
    const stxns = await this.generateGroupTransactionSigningRequest(
      [paymentTxn],
      [serverWallet]
    );
    return stxns;
  }

  /**
   * send Algo to address without signing
   * @param {FalseyWallet} serverWallet
   * @param {number} amount
   * @param {string} address
   * @returns {algosdk.Transaction} Unsigned Transaction
   */
  async sendAlgoWithoutSigning(
    serverWallet: FalseyWallet,
    amount: number,
    address: string
  ) {
    if (serverWallet === undefined) {
      throw new Error("serverWallet is undefined");
    }

    // get suggested parameters
    const suggestedParams = await this.algoClient.getTransactionParams().do();

    // Pay the app
    const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: serverWallet.addr,
      to: address,
      amount: amount,
      suggestedParams: suggestedParams,
    });

    return paymentTxn;
  }

  /**
   * transfer asset from contract to user
   * @param {number} appIndex
   * @param {number} assetIndex
   * @param {number} amount
   * @returns {Promise<Record<string, any>>} transaction response
   */
  async assetTransferFromContract(
    appIndex: number,
    assetIndex: any,
    amount: number,
    wallet: Wallet
  ): Promise<Record<string, any>> {
    console.log(
      "Attempting asset transfer from contract",
      appIndex,
      assetIndex,
      amount
    );
    const suggestedParams = await this.algoClient.getTransactionParams().do();
    const contractAddress = algosdk.getApplicationAddress(appIndex);
    const transferTx =
      algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: contractAddress,
        to: wallet.addr,
        assetIndex,
        amount: amount,
        suggestedParams,
      });
    // sign the transaction
    const stxns = await this.generateGroupTransactionSigningRequest([transferTx], [wallet]);
    // submit the transaction
    const response = await this.submitSignedTransactions(stxns);
    console.log("Completed asset transfer from contract");
    return response;
  }

  /**
   * Delete application
   * @param {number} appIndex
   * @returns {Promise<any[]>} array of transactions
   */
  async deleteApplication(appIndex: number, wallet: Wallet) {
    let params = await this.algoClient.getTransactionParams().do();
    let txn = algosdk.makeApplicationDeleteTxn(wallet.addr, params, appIndex);
    const stxns = await this.generateGroupTransactionSigningRequest([txn], [wallet]);
    // submit the transaction
    const response = await this.submitSignedTransactions(stxns);
    return response;
  }

  /**
   * Get all applications given application id is opted into
   */
  async getOptedInApplications(appId: number): Promise<number[]> {
    const address = algosdk.getApplicationAddress(appId);
    const accountInfo = await this.algoClient.accountInformation(address).do();
    const appsLocalState = accountInfo["apps-local-state"];
    const appIds = appsLocalState.map((app: any) => app.id);
    return appIds;
  }

  makeWallet(addr: string, sk: Uint8Array | undefined = undefined): Wallet {
    return { addr, sk };
  }

  getARC69MimetypeFromMediaMimeType(mimeType: string | undefined): string {
    if (mimeType === undefined) {
      return arc69Mimetypes.image;
    }
    const lowerMimeType = mimeType.toLowerCase();
    const [type, _] = lowerMimeType.split("/");
    switch (type) {
      case "image":
        return arc69Mimetypes.image;
      case "video":
        return arc69Mimetypes.video;
      case "audio":
        return arc69Mimetypes.audio;
    }

    // more cases, focusing on lowerMimeType
    switch (lowerMimeType) {
      case "application/pdf":
        return arc69Mimetypes.pdf;
      case "text/html":
        return arc69Mimetypes.html;
      default:
        return arc69Mimetypes.image;
    }
  }
}
