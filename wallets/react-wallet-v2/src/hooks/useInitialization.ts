import SettingsStore from '@/store/SettingsStore'
import { createOrRestoreNearWallet } from '@/utils/NearWalletUtil'
import { createOrRestoreCosmosWallet } from '@/utils/CosmosWalletUtil'
import { createOrRestoreEIP155Wallet } from '@/utils/EIP155WalletUtil'
import { createWalletConnectClient } from '@/utils/WalletConnectUtil'
import { generateMnemonic } from "@/utils/HelperUtil";
import { useCallback, useEffect, useState } from 'react'

export default function useInitialization() {
  const [initialized, setInitialized] = useState(false)

  const onInitialize = useCallback(async () => {
    try {
      let mnemonic = localStorage.getItem('WALLET_MNEMONIC');

      if (!mnemonic) {
        mnemonic = generateMnemonic() as string;

        // Don't store mnemonic in local storage in a production project!
        localStorage.setItem('WALLET_MNEMONIC', mnemonic)
      }

      const { eip155Addresses } = createOrRestoreEIP155Wallet(mnemonic)
      const { cosmosAddresses } = await createOrRestoreCosmosWallet(mnemonic)
      const { nearAddresses } = await createOrRestoreNearWallet(mnemonic)

      SettingsStore.setEIP155Address(eip155Addresses[0])
      SettingsStore.setCosmosAddress(cosmosAddresses[0])
      SettingsStore.setNearAddress(nearAddresses[0] || '')

      await createWalletConnectClient()

      setInitialized(true)
    } catch (err: unknown) {
      throw err;
      alert(err)
    }
  }, [])

  useEffect(() => {
    if (!initialized) {
      onInitialize()
    }
  }, [initialized, onInitialize])

  return initialized
}
