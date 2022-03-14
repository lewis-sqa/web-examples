import { Cosmos } from '@/lib/Cosmos'

export let wallet1: Cosmos
export let wallet2: Cosmos
export let cosmosWallets: Record<string, Cosmos>
export let cosmosAddresses: string[]

let address1: string
let address2: string

/**
 * Utilities
 */
export async function createOrRestoreCosmosWallet(mnemonic: string) {
  wallet1 = await Cosmos.init({ mnemonic, path: "m/44'/118'/0'/0/0" })
  const account1 = await wallet1.getAccount()
  address1 = account1.address

  wallet2 = await Cosmos.init({ mnemonic, path: "m/44'/118'/0'/0/1" })
  const account2 = await wallet2.getAccount()
  address2 = account2.address

  cosmosWallets = {
    [address1]: wallet1,
    [address2]: wallet2
  }
  cosmosAddresses = Object.keys(cosmosWallets)

  console.log("cosmosAddresses", cosmosAddresses)

  return {
    cosmosWallets,
    cosmosAddresses
  }
}
