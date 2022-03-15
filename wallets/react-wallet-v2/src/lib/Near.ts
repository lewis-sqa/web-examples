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
  private near: Near;
  private account: Account;

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

    return new NearWallet(near, account);
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
    console.log("Signing transaction with", {
      chainId,
      receiverId,
      actions
    });

    const provider = new providers.JsonRpcProvider(NEAR_CHAINS[chainId as TNearChain].rpc);
    const [block, accessKey] = await Promise.all([
      provider.block({ finality: "final" }),
      provider.query<AccessKeyView>({
        request_type: "view_access_key",
        finality: "final",
        account_id: this.account.accountId,
        public_key: this.account.publicKey,
      }),
    ]);

    const transaction = transactions.createTransaction(
      this.getAccountId(),
      utils.PublicKey.from(this.getPublicKey()),
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
      this.getAccountId(),
      this.near.connection.networkId
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