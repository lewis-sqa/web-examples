import { keyStores, utils } from "near-api-js";

const MAX_ACCOUNTS = 2;

interface Account {
  accountId: string;
  publicKey: string;
}

interface StoredAccount {
  accountId: string;
  secretKey: string;
}

const getJsonItem = <Value extends unknown>(path: string) => {
  const item = localStorage.getItem(path);

  return item ? JSON.parse(item) as Value : null;
}

export class NearWallet {
  private networkId: string;
  private vault: keyStores.KeyStore;

  static async init(networkId: string) {
    const vault = new keyStores.BrowserLocalStorageKeyStore(
      window.localStorage,
      "vault"
    );

    const accounts = await vault.getAccounts(networkId);

    for (let i = 0; i < Math.max(MAX_ACCOUNTS - accounts.length, 0); i += 1) {
      const { accountId, keyPair } = await NearWallet.createDevAccount();

      await vault.setKey(networkId, accountId, keyPair);
    }

    return new NearWallet(networkId, vault);
  }

  static async createDevAccount() {
    const keyPair = utils.KeyPair.fromRandom("ed25519");
    const randomNumber = Math.floor(Math.random() * (99999999999999 - 10000000000000) + 10000000000000);
    const accountId = `dev-${Date.now()}-${randomNumber}`;
    const publicKey = keyPair.getPublicKey().toString();

    return fetch(`https://helper.testnet.near.org/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newAccountId: accountId,
        newAccountPublicKey: publicKey,
      }),
    })
      .then((res) => {
        if (res.ok) {
          return {
            accountId,
            keyPair
          };
        }

        throw new Error("Failed to create NEAR dev account");
      });
  }

  private constructor(networkId: string, vault: keyStores.KeyStore) {
    this.networkId = networkId;
    this.vault = vault;
  }

  // Retrieve all imported accounts from wallet.
  async getAccounts(): Promise<Array<Account>> {
    const accountIds = await this.vault.getAccounts(this.networkId);

    return Promise.all(
      accountIds.map(async (accountId) => {
        const keyPair = await this.vault.getKey(this.networkId, accountId);

        return {
          accountId,
          publicKey: keyPair.getPublicKey().toString(),
        };
      })
    );
  }
}
