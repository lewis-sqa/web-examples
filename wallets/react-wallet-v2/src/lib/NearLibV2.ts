import { keyStores, utils } from "near-api-js";

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

    for (let i = 1; i <= 2; i += 1) {
      let account = getJsonItem<StoredAccount>(`NEAR_ACCOUNT_${i}`);

      if (!account) {
        account = await NearWallet.createDevAccount();
        localStorage.setItem(`NEAR_ACCOUNT_${i}`, JSON.stringify(account));
      }

      await vault.setKey(
        networkId,
        account.accountId,
        utils.KeyPair.fromString(account.secretKey)
      );
    }

    return new NearWallet(networkId, vault);
  }

  static async createDevAccount(): Promise<StoredAccount> {
    const keyPair = utils.KeyPair.fromRandom("ed25519");
    const randomNumber = Math.floor(Math.random() * (99999999999999 - 10000000000000) + 10000000000000);
    const accountId = `dev-${Date.now()}-${randomNumber}`;
    const publicKey = keyPair.getPublicKey().toString();

    return fetch(`https://helper.testnet.near.org/account`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        newAccountId: accountId,
        newAccountPublicKey: publicKey
      })
    })
      .then((res) => {
        if (res.ok) {
          return {
            accountId,
            secretKey: keyPair.toString(),
          }
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
