import {
  InMemorySigner,
  keyStores,
  providers,
  Signer,
  transactions as nearTransactions,
  utils
} from "near-api-js";
import { AccessKeyView } from "near-api-js/lib/providers/provider";
import BN from "bn.js";

import { signClient } from "@/utils/WalletConnectUtil";
import { NEAR_CHAINS, TNearChain } from "@/data/NEARData";

const MAX_ACCOUNTS = 2;

interface Account {
  accountId: string;
  publicKey: string;
}

interface Transaction {
  signerId: string;
  receiverId: string;
  actions: Array<any>;
}

interface ValidateAccessKeyParams {
  accessKey: AccessKeyView;
  transaction: Transaction;
}

interface GetAccessForTransactionParams {
  chainId: string;
  topic: string;
  transaction: Transaction;
}

interface TransactionAccess {
  accessKey: AccessKeyView;
  signer: Signer;
}

interface SignInParams {
  chainId: string;
  topic: string;
  contractId: string;
  methodNames: Array<string>;
}

interface SignAndSendTransactionParams {
  chainId: string;
  topic: string;
  transaction: Transaction;
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

  private transformAccessKeyPermission(permission: any) {
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
            this.transformAccessKeyPermission(accessKey.permission)
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

  validateAccessKey({ accessKey, transaction }: ValidateAccessKeyParams): boolean {
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
          topic,
          transaction: {
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
          }
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

  async getAccessForTransaction({
    chainId,
    topic,
    transaction
  }: GetAccessForTransactionParams): Promise<TransactionAccess | null> {
    const session = signClient.session.get(topic);
    const provider = new providers.JsonRpcProvider(NEAR_CHAINS[chainId as TNearChain].rpc);
    const keystore = new keyStores.BrowserLocalStorageKeyStore(window.localStorage, `${chainId}:${topic}`);
    const accountIds = session.namespaces.near.accounts.map((x) => x.split(":")[2]);
    const networkId = chainId.split(":")[1];

    // Ensure the signerId is valid based on the accounts we have access to.
    if (!accountIds.includes(transaction.signerId)) {
      return null;
    }

    const keyPairs: Array<utils.KeyPair> = [
      // Ensure FunctionCall key pair is first.
      await keystore.getKey(networkId, transaction.signerId),
      // Fallback to FullAccess key pair.
      await this.vault.getKey(networkId, transaction.signerId),
    ];

    for (let i = 0 ; i < keyPairs.length; i += 1) {
      const keyPair = keyPairs[i];

      // Note: type for KeyStore.getKey is actually nullable.
      if (!keyPair) {
        continue;
      }

      const publicKey = keyPair.getPublicKey().toString();
      const accessKey = await provider.query<AccessKeyView>({
        request_type: "view_access_key",
        finality: "final",
        account_id: transaction.signerId,
        public_key: publicKey,
      });

      if (this.validateAccessKey({ accessKey, transaction })) {
        return {
          accessKey,
          signer: new InMemorySigner(keystore),
        };
      }
    }

    return null;
  }

  async signAndSendTransaction({
    chainId,
    topic,
    transaction
  }: SignAndSendTransactionParams): Promise<providers.FinalExecutionOutcome> {
    const access = await this.getAccessForTransaction({ chainId, topic, transaction });

    if (!access) {
      throw new Error("Failed to find matching access key for transaction");
    }

    const provider = new providers.JsonRpcProvider(NEAR_CHAINS[chainId as TNearChain].rpc);
    const networkId = chainId.split(":")[1];
    const { accessKey, signer } = access;

    const permission = accessKey.permission === "FullAccess" ? "FullAccess" : "FunctionCall";
    console.log("Found valid access key", { transaction, permission, accessKey });

    const block = await provider.block({ finality: "final" });
    const publicKey = await signer.getPublicKey(transaction.signerId, networkId);

    const tx = nearTransactions.createTransaction(
      transaction.signerId,
      publicKey,
      transaction.receiverId,
      accessKey.nonce + 1,
      this.transformActions(transaction.actions),
      utils.serialize.base_decode(block.header.hash)
    );

    const [, signedTx] = await nearTransactions.signTransaction(
      tx,
      signer,
      transaction.signerId,
      networkId
    );

    return provider.sendTransaction(signedTx);
  }
}
