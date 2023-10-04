import algo from "algosdk";

const mainnetBaseServer = "https://mainnet-algorand.api.purestake.io/ps2";
const purestakeKey = process.env.PURESTAKE_KEY;
if (!purestakeKey) {
  throw new Error("PURESTAKE_KEY environment variable not set");
}
const testnetBaseServer = "https://testnet-algorand.api.purestake.io/ps2";

const port = "";
const token = {
  "X-API-Key": purestakeKey,
};

const mainnetClient = new algo.Algodv2(token, mainnetBaseServer, port);
const testnetClient = new algo.Algodv2(token, testnetBaseServer, port);

function algoClient(isMainNet: boolean = true): algo.Algodv2 {
  return isMainNet ? mainnetClient : testnetClient;
}

export { mainnetClient, testnetClient, algoClient };