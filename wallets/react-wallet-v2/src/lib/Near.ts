import {
  connect,
  keyStores,
  transactions,
  providers,
  utils,
  Near
} from "near-api-js";
import { AccessKeyView } from "near-api-js/lib/providers/provider";
import BN from "bn.js";

import { NEAR_CHAINS, TNearChain } from "@/data/NEARData";

interface RequestSignInParams {
  contractId: string;
  methodNames?: Array<string>;
}

interface SignAndSendTransactionParams {
  chainId: string;
  receiverId: string;
  actions: Array<any>;
}

interface Account {
  accountId: string;
  publicKey: string;
  privateKey: string;
}

const getJsonItem = <Value extends unknown>(path: string) => {
  const item = localStorage.getItem(path);

  return item ? JSON.parse(item) as Value : null;
}

export class NearWallet {
  private derivationPath: string;
  private near: Near;
  private account: Account;
  private accessKeys: Array<string>;

  static async init(derivationPath: string) {
    const networkId = "testnet";
    const keyStore = new keyStores.InMemoryKeyStore();
    const near = await connect({
      networkId,
      keyStore,
      nodeUrl: `https://rpc.${networkId}.near.org`,
      helperUrl: `https://helper.${networkId}.near.org`,
      headers: {}
    });

    let account = getJsonItem<Account>(`WALLET_NEAR_ACCOUNT:${derivationPath}`);

    if (!account) {
      account = await NearWallet.createDevAccount();

      localStorage.setItem(
        `WALLET_NEAR_ACCOUNT:${derivationPath}`,
        JSON.stringify(account)
      );
    }

    await keyStore.setKey(
      networkId,
      account.accountId,
      utils.KeyPair.fromString(account.privateKey)
    );

    const accessKeys = getJsonItem<Array<string>>(`WALLET_NEAR_ACCESS_KEYS:${derivationPath}`) || [] ;

    return new NearWallet(derivationPath, near, account, accessKeys);
  }

  static async createDevAccount() {
    const keyPair = utils.KeyPair.fromRandom("ed25519");
    const randomNumber = Math.floor(Math.random() * (99999999999999 - 10000000000000) + 10000000000000);
    const accountId = `dev-${Date.now()}-${randomNumber}`;
    const publicKey = keyPair.getPublicKey().toString();
    const privateKey = keyPair.toString();

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
            publicKey,
            privateKey
          }
        }

        throw new Error("Failed to create NEAR dev account");
      });
  }

  private constructor(derivationPath: string, near: Near, account: Account, accessKeys: Array<string>) {
    this.derivationPath = derivationPath;
    this.near = near;
    this.account = account;
    this.accessKeys = accessKeys;
  }

  private transformActions(actions: any) {
    if (!actions.every((x: any) => x.type === "FunctionCall")) {
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

  async requestSignIn({ contractId, methodNames }: RequestSignInParams) {
    const account = await this.near.account(this.account.accountId);
    const keyPair = utils.KeyPair.fromRandom("ed25519");

    await account.addKey(keyPair.getPublicKey(), contractId, methodNames);

    const accessKeys = [
      ...this.accessKeys,
      keyPair.getPublicKey().toString()
    ];

    localStorage.setItem(
      `WALLET_NEAR_ACCESS_KEYS:${this.derivationPath}`,
      JSON.stringify(accessKeys)
    );

    this.accessKeys = accessKeys;
  }

  getAccountId() {
    return this.account.accountId;
  }

  getPublicKey() {
    return this.account.publicKey;
  }

  async getAccount() {
    return this.near.connection.provider.query({
      request_type: "view_account",
      finality: "optimistic",
      account_id: this.getAccountId()
    });
  }

  async signAndSendTransaction({ chainId, receiverId, actions }: SignAndSendTransactionParams) {
    const accountId = this.getAccountId();
    const publicKey = this.getPublicKey();
    const networkId = this.near.connection.networkId;
    const provider = new providers.JsonRpcProvider(
      NEAR_CHAINS[chainId as TNearChain].rpc
    );

    const [block, accessKey] = await Promise.all([
      provider.block({ finality: "final" }),
      provider.query<AccessKeyView>({
        request_type: "view_access_key",
        finality: "final",
        account_id: accountId,
        public_key: publicKey,
      }),
    ]);

    const transaction = transactions.createTransaction(
      accountId,
      utils.PublicKey.from(publicKey),
      receiverId,
      accessKey.nonce + 1,
      this.transformActions(actions),
      utils.serialize.base_decode(block.header.hash)
    );

    const serializedTx = utils.serialize.serialize(
      transactions.SCHEMA,
      transaction
    );

    const signature = await this.near.connection.signer.signMessage(
      serializedTx,
      accountId,
      networkId
    );

    const signedTx = new transactions.SignedTransaction({
      transaction,
      signature: new transactions.Signature({
        keyType: transaction.publicKey.keyType,
        data: signature.signature,
      }),
    });

    return provider.sendTransaction(signedTx);
  }
}