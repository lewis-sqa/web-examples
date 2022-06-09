import {
  connect,
  keyStores,
  transactions as nearTransactions,
  providers,
  utils,
  Near
} from "near-api-js";
import { AccessKeyView } from "near-api-js/lib/providers/provider";
import { SignedTransaction } from "near-api-js/lib/transaction";
import BN from "bn.js";

import { NEAR_CHAINS, TNearChain } from "@/data/NEARData";
import { signClient } from '@/utils/WalletConnectUtil'

interface SignInParams {
  chainId: string;
  topic: string;
  contractId: string;
  methodNames: Array<string>;
}

interface SignOutParams {
  chainId: string;
  topic: string;
}

interface Transaction {
  signerId: string;
  receiverId: string;
  actions: Array<any>;
}

interface IsAccessKeyValidForTransactionParams {
  accessKey: AccessKeyView;
  transaction: Transaction;
}

interface GetAccessKeyForTransactionParams {
  chainId: string;
  topic: string;
  transaction: Transaction;
}

interface IsSilentlySignableParams {
  chainId: string;
  topic: string;
  transactions: Array<Transaction>;
}

interface SignTransactionsParams {
  chainId: string;
  transactions: Array<Transaction>;
}

interface SignAndSendTransactionParams {
  chainId: string;
  signerId: string;
  receiverId: string;
  actions: Array<any>;
}

interface SignAndSendTransactionsParams {
  chainId: string;
  transactions: Array<Transaction>;
}

interface Account {
  accountId: string;
  publicKey: string;
}

interface StoredAccount {
  accountId: string;
  publicKey: string;
  privateKey: string;
}

const getJsonItem = <Value extends unknown>(path: string) => {
  const item = localStorage.getItem(path);

  return item ? JSON.parse(item) as Value : null;
}

export class NearWallet {
  private near: Near;
  private accounts: Array<StoredAccount>;

  static async init() {
    const networkId = "testnet";
    const keyStore = new keyStores.InMemoryKeyStore();
    const near = await connect({
      networkId,
      keyStore,
      nodeUrl: `https://rpc.${networkId}.near.org`,
      helperUrl: `https://helper.${networkId}.near.org`,
      headers: {}
    });

    let accounts: Array<StoredAccount> = [];
    for (let i = 1; i <= 2; i += 1) {
      let account = getJsonItem<StoredAccount>(`NEAR_ACCOUNT_${i}`);

      if (!account) {
        account = await NearWallet.createDevAccount();

        localStorage.setItem(`NEAR_ACCOUNT_${i}`, JSON.stringify(account));
      }

      await keyStore.setKey(
        networkId,
        account.accountId,
        utils.KeyPair.fromString(account.privateKey)
      );

      accounts.push(account);
    }

    return new NearWallet(near, accounts);
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

  private constructor(near: Near, accounts: Array<StoredAccount>) {
    this.near = near;
    this.accounts = accounts;
  }

  isAccessKeyValidForTransaction({ accessKey, transaction }: IsAccessKeyValidForTransactionParams): boolean {
    if (accessKey.permission === "FullAccess") {
      return true;
    }

    const { receiver_id, method_names } = accessKey.permission.FunctionCall;

    if (transaction.receiverId !== receiver_id) {
      return false;
    }

    return transaction.actions.every((action) => {
      if (action.type !== "FunctionCall") {
        return false;
      }

      const { methodName, deposit } = action.params;

      if (method_names.length && method_names.includes(methodName)) {
        return false;
      }

      return parseFloat(deposit) <= 0;
    });
  }

  async getAccessKeyForTransaction({ chainId, topic, transaction }: GetAccessKeyForTransactionParams): Promise<AccessKeyView | null> {
    const session = signClient.session.get(topic);
    const provider = new providers.JsonRpcProvider(NEAR_CHAINS[chainId as TNearChain].rpc);
    const keystore = new keyStores.BrowserLocalStorageKeyStore(window.localStorage, `${chainId}:${topic}`);
    const accountIds = session.namespaces.near.accounts.map((x) => {
      return x.split(":")[2];
    })

    // Check the signerId is valid based on the accounts we have access to.
    if (!accountIds.includes(transaction.signerId)) {
      return null;
    }

    const keyPair = await keystore.getKey(chainId.split(":")[1], transaction.signerId);

    if (keyPair) {
      const publicKey = keyPair.getPublicKey().toString();
      const accessKey = await provider.query<AccessKeyView>({
        request_type: "view_access_key",
        finality: "final",
        account_id: transaction.signerId,
        public_key: publicKey,
      });

      if (this.isAccessKeyValidForTransaction({ accessKey, transaction })) {
        return accessKey
      }
    }

    const account = this.accounts.find((x) => x.accountId === transaction.signerId);

    if (!account) {
      return null;
    }

    return provider.query<AccessKeyView>({
      request_type: "view_access_key",
      finality: "final",
      account_id: transaction.signerId,
      public_key: account.publicKey,
    });
  }

  getAccessKey(permission: any) {
    if (permission === "FullAccess") {
      return nearTransactions.fullAccessKey();
    }

    const { receiverId, methodNames = [] } = permission;
    const allowance = permission.allowance
      ? new BN(permission.allowance)
      : undefined;

    return nearTransactions.functionCallAccessKey(receiverId, methodNames, allowance);
  }

  private transformActions(actions: any) {
    return actions.map((action: any) => {
      switch (action.type) {
        case "FunctionCall": {
          const { methodName, args, gas, deposit } = action.params;

          return nearTransactions.functionCall(methodName,
            args,
            new BN(gas),
            new BN(deposit));
        }
        case "AddKey": {
          const { publicKey, accessKey } = action.params;

          return nearTransactions.addKey(
            utils.PublicKey.from(publicKey),
            this.getAccessKey(accessKey.permission)
          );
        }
        case "DeleteKey": {
          const { publicKey } = action.params;

          return nearTransactions.deleteKey(
            utils.PublicKey.from(publicKey)
          );
        }
        default: throw new Error("Invalid action");
      }
    });
  }

  getAccounts() {
    return this.accounts;
  }

  async signIn({ chainId, topic, contractId, methodNames }: SignInParams): Promise<Array<Account>> {
    const session = signClient.session.get(topic);
    const { accounts } = session.namespaces.near;
    const result: Array<Account> = [];
    const keystore = new keyStores.BrowserLocalStorageKeyStore(
      window.localStorage,
      `${chainId}:${topic}`
    );

    for (let i = 0; i < accounts.length; i += 1) {
      const accountId = accounts[i].split(":")[2];
      const keyPair = utils.KeyPair.fromRandom("ed25519");
      const publicKey = keyPair.getPublicKey().toString();

      try {
        await this.signAndSendTransaction({
          chainId,
          signerId: accountId,
          receiverId: accountId,
          actions: [{
            type: "AddKey",
            params: {
              publicKey,
              accessKey: {
                permission: {
                  receiverId: contractId,
                  methodNames,
                },
              },
            },
          }]
        });

        await keystore.setKey(chainId.split(":")[1], accountId, keyPair);

        result.push({accountId, publicKey});
      } catch (err) {
        console.log(`Failed to create FunctionCall access key for ${accountId}`);
        console.error(err);
      }
    }

    return result;
  }

  async signOut({ chainId, topic }: SignOutParams): Promise<Array<Account>> {
    const session = signClient.session.get(topic);
    const { accounts } = session.namespaces.near;
    const result: Array<Account> = [];
    const keystore = new keyStores.BrowserLocalStorageKeyStore(
      window.localStorage,
      `${chainId}:${topic}`
    );

    for (let i = 0; i < accounts.length; i += 1) {
      const accountId = accounts[i].split(":")[2];
      const keyPair = await keystore.getKey(chainId.split(":")[1], accountId);
      const publicKey = keyPair.getPublicKey().toString();

      try {
        await this.signAndSendTransaction({
          chainId,
          signerId: accountId,
          receiverId: accountId,
          actions: [{
            type: "DeleteKey",
            params: {
              publicKey
            },
          }]
        });

        await keystore.removeKey(chainId.split(":")[1], accountId);
      } catch (err) {
        console.log(`Failed to remove FunctionCall access key for ${accountId}`);
        console.error(err);

        result.push({ accountId, publicKey });
      }
    }

    return result;
  }

  async signTransactions({ chainId, transactions }: SignTransactionsParams) {
    const networkId = this.near.connection.networkId;
    const provider = new providers.JsonRpcProvider(
      NEAR_CHAINS[chainId as TNearChain].rpc
    );

    const signedTxs: Array<SignedTransaction> = [];

    for (let i = 0; i < transactions.length; i += 1) {
      const { signerId, receiverId, actions } = transactions[i];

      const account = this.accounts.find((x) => x.accountId === signerId);

      if (!account) {
        throw new Error("Invalid signer id");
      }

      const [block, accessKey] = await Promise.all([
        provider.block({ finality: "final" }),
        provider.query<AccessKeyView>({
          request_type: "view_access_key",
          finality: "final",
          account_id: account.accountId,
          public_key: account.publicKey,
        }),
      ]);

      const transaction = nearTransactions.createTransaction(
        account.accountId,
        utils.PublicKey.from(account.publicKey),
        receiverId,
        accessKey.nonce + 1,
        this.transformActions(actions),
        utils.serialize.base_decode(block.header.hash)
      );

      const serializedTx = utils.serialize.serialize(
        nearTransactions.SCHEMA,
        transaction
      );

      const signature = await this.near.connection.signer.signMessage(
        serializedTx,
        account.accountId,
        networkId
      );

      signedTxs.push(
        new nearTransactions.SignedTransaction({
          transaction,
          signature: new nearTransactions.Signature({
            keyType: transaction.publicKey.keyType,
            data: signature.signature,
          }),
        })
      );
    }

    return signedTxs;
  }

  async signAndSendTransaction({ chainId, signerId, receiverId, actions }: SignAndSendTransactionParams) {
    const [signedTx] = await this.signTransactions({
      chainId,
      transactions: [{
        signerId,
        receiverId,
        actions
      }]
    });
    const provider = new providers.JsonRpcProvider(
      NEAR_CHAINS[chainId as TNearChain].rpc
    );

    return provider.sendTransaction(signedTx);
  }

  async signAndSendTransactions({ chainId, transactions }: SignAndSendTransactionsParams) {
    const signedTxs = await this.signTransactions({ chainId, transactions });
    const provider = new providers.JsonRpcProvider(
      NEAR_CHAINS[chainId as TNearChain].rpc
    );

    return Promise.all(
      signedTxs.map((signedTx) => provider.sendTransaction(signedTx))
    );
  }
}
