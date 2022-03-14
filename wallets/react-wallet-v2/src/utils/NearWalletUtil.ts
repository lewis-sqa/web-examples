import { WalletConnection, connect, keyStores, transactions, utils } from "near-api-js";
import { parseSeedPhrase } from "near-seed-phrase";
import { decode } from "bs58";
import BN from "bn.js";

const getImplicitAccountId = (publicKey: string) => {
  return Buffer.from(decode(publicKey.replace('ed25519:', ''))).toString('hex');
}

export const nearNetworkId = "testnet";
export let nearWallet: WalletConnection;
export let nearAddresses: string[];

/**
 * Utilities
 */
export async function createOrRestoreNearWallet(mnemonic: string) {
  const localStorageKeyStore = new keyStores.BrowserLocalStorageKeyStore();

  const keyPair1 = parseSeedPhrase(mnemonic, "m/44'/397'/0'/0'/0'");
  const account1 = getImplicitAccountId(keyPair1.publicKey);
  await localStorageKeyStore.setKey(
    nearNetworkId,
    account1,
    utils.KeyPair.fromString(keyPair1.secretKey)
  );

  const keyPair2 = parseSeedPhrase(mnemonic, "m/44'/397'/0'/0'/0'");
  const account2 = getImplicitAccountId(keyPair2.publicKey);
  await localStorageKeyStore.setKey(
    nearNetworkId,
    account2,
    utils.KeyPair.fromString(keyPair2.secretKey)
  );

  const near = await connect({
    keyStore: localStorageKeyStore,
    networkId: nearNetworkId,
    nodeUrl: "https://rpc.testnet.near.org",
    walletUrl: "https://wallet.testnet.near.org",
    helperUrl: "https://helper.testnet.near.org",
    headers: {},
  });

  nearWallet = new WalletConnection(near, "near_app");
  nearAddresses = [account1, account2];

  return {
    nearWallet,
    nearAddresses
  }
}

export function transformActions(actions: any) {
  if (!actions.every((x) => x.type === "FunctionCall")) {
    throw new Error("Invalid actions");
  }

  return actions.map((action: any) => {
    const { methodName, args, gas, deposit } = action.params;
    return transactions.functionCall(methodName,
      args,
      new BN(gas),
      new BN(deposit))
  })
}
