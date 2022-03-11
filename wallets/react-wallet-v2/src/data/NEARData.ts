/**
 * @desc Refference list of eip155 chains
 * @url https://chainlist.org
 */

/**
 * Types
 */
export type TNearChain = keyof typeof NEAR_CHAINS

/**
 * Chains
 */
export const NEAR_MAINNET_CHAINS = {
  'near:mainnet': {
    chainId: 'mainnet',
    name: 'NEAR (Mainnet)',
    logo: '/chain-logos/near.png',
    rgb: '99, 125, 234',
    rpc: 'https://rpc.mainnet.near.org'
  },
}

export const NEAR_TEST_CHAINS = {
  'near:testnet': {
    chainId: 'testnet',
    name: 'NEAR (Testnet)',
    logo: '/chain-logos/near.png',
    rgb: '99, 125, 234',
    rpc: 'https://rpc.testnet.near.org'
  },
  'near:betanet': {
    chainId: 'betanet',
    name: 'NEAR (Betanet)',
    logo: '/chain-logos/near.png',
    rgb: '99, 125, 234',
    rpc: 'https://rpc.betanet.near.org'
  },
}

export const NEAR_CHAINS = { ...NEAR_MAINNET_CHAINS, ...NEAR_TEST_CHAINS }

/**
 * Methods
 */
export const NEAR_SIGNING_METHODS = {
  PERSONAL_SIGN: 'personal_sign',
  ETH_SIGN: 'eth_sign',
  ETH_SIGN_TRANSACTION: 'eth_signTransaction',
  ETH_SIGN_TYPED_DATA: 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V3: 'eth_signTypedData_v3',
  ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
  ETH_SEND_RAW_TRANSACTION: 'eth_sendRawTransaction',
  ETH_SEND_TRANSACTION: 'eth_sendTransaction'
}
