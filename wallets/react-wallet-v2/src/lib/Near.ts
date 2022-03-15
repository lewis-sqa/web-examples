import {
  connect,
  keyStores,
  transactions,
  providers,
  utils,
  Near
} from "near-api-js";
import BN from "bn.js";

import { NEAR_CHAINS, TNearChain } from "@/data/NEARData";

interface SignAndSendTransactionParams {
  chainId: string;
  receiverId: string;
  actions: Array<any>;
}

interface Account {
  accountId: string;
  publicKey: string;
}


export class NearWallet {
  private near: Near;
  private account: Account;

  static async init(derivationPath: string) {
    const near = await connect({
      networkId: "testnet",
      keyStore: new keyStores.BrowserLocalStorageKeyStore(),
      nodeUrl: 'https://rpc.testnet.near.org',
      helperUrl: 'https://helper.testnet.near.org',
      headers: {}
    });

    const account = localStorage.getItem(`WALLET_NEAR_ACCOUNT:${derivationPath}`);

    if (!account) {
      const newAccount = await NearWallet.createDevAccount();

      localStorage.setItem(
        `WALLET_NEAR_ACCOUNT:${derivationPath}`,
        JSON.stringify(newAccount)
      );

      return new NearWallet(near, newAccount);
    }


    return new NearWallet(near, JSON.parse(account));
  }

  static async createDevAccount() {
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
        newAccountPublicKey: publicKey })
    })
      .then((res) => {
        if (res.ok) {
          return {
            accountId,
            publicKey,
          }
        }

        throw new Error("Failed to create NEAR dev account");
      });
  }

  private constructor(near: Near, account: Account) {
    this.near = near;
    this.account = account;
  }

  private transformActions(actions: any) {
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

  getAccountId() {
    return this.account.accountId;
  }

  async getAccount() {
    return this.near.connection.provider.query({
      request_type: "view_account",
      finality: "optimistic",
      account_id: this.getAccountId()
    });
  }

  async signAndSendTransaction({ chainId, receiverId, actions }: SignAndSendTransactionParams) {
    console.log("Signing transaction with", {
      chainId,
      receiverId,
      actions
    });

    const provider = new providers.JsonRpcProvider(NEAR_CHAINS[chainId as TNearChain].rpc);
    const [block, accessKey] = await Promise.all([
      provider.block({ finality: "final" }),
      provider.query({
        request_type: "view_access_key",
        finality: "final",
        account_id: this.account.accountId,
        public_key: this.account.publicKey,
      }),
    ]);

    console.log({
      block,
      accessKey
    });
  }
}