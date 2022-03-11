import { WalletConnection, connect, keyStores, transactions } from "near-api-js";
import BN from "bn.js";
import MnemonicKeyring from "mnemonic-keyring";

export let nearWallet: WalletConnection;
export let nearAddresses: string[];

/**
 * Utilities
 */
export async function createOrRestoreNearWallet() {
  const localStorageKeyStore = new keyStores.BrowserLocalStorageKeyStore();
  const near = await connect({
    keyStore: localStorageKeyStore,
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    walletUrl: "https://wallet.testnet.near.org",
    helperUrl: "https://helper.testnet.near.org",
    headers: {},
  });

  nearWallet = new WalletConnection(near, "near_app");
  nearAddresses = nearWallet.isSignedIn() ? [nearWallet.account().accountId] : [];

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
