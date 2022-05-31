import { NearWallet } from "@/lib/NearLib";

export let nearAddresses: string[];
export let nearWallet: NearWallet;

/**
 * Utilities
 */
export async function createOrRestoreNearWallet() {
  const wallet = await NearWallet.init();
  const accounts = wallet.getAccounts();

  nearAddresses = accounts.map((x) => x.accountId);
  nearWallet = wallet;

  return {
    nearWallet,
    nearAddresses
  }
}
