import { NearWallet } from "@/lib/NearLibV2";

export let nearAddresses: string[];
export let nearWallet: NearWallet;

/**
 * Utilities
 */
export async function createOrRestoreNearWallet() {
  const wallet = await NearWallet.init();
  const accounts = await wallet.getAccounts();

  nearAddresses = accounts.map((x) => x.accountId);
  nearWallet = wallet;

  return {
    nearWallet,
    nearAddresses
  }
}
