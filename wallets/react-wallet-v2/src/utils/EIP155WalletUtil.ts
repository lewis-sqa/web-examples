import { Wallet } from 'ethers'

export let eip155Wallets: Record<string, Wallet>
export let eip155Addresses: string[]

let wallet1: Wallet
let wallet2: Wallet

/**
 * Utilities
 */
export function createOrRestoreEIP155Wallet(mnemonic: string) {
  wallet1 = Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/0")
  wallet2 = Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/1")

  eip155Wallets = {
    [wallet1.address]: wallet1,
    [wallet2.address]: wallet2
  }
  eip155Addresses = Object.keys(eip155Wallets)

  return {
    eip155Wallets,
    eip155Addresses
  }
}
