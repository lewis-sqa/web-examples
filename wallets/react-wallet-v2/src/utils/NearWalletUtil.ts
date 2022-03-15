import { NearWallet } from "@/lib/Near";

export let nearWallets: Record<string, NearWallet>;
export let nearAddresses: string[];

/**
 * Utilities
 */
export async function createOrRestoreNearWallet() {
  const [wallet1, wallet2] = await Promise.all([
    NearWallet.init("m/44'/397'/0'/0'/0'"),
    NearWallet.init("m/44'/397'/0'/0'/1'")
  ]);

  nearWallets = {
    [wallet1.getAccountId()]: wallet1,
    [wallet2.getAccountId()]: wallet2,
  };
  nearAddresses = [wallet1.getAccountId(), wallet2.getAccountId()];

  return {
    nearWallets,
    nearAddresses
  }
}