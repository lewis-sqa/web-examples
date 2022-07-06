import { NEAR_SIGNING_METHODS } from '@/data/NEARData'
import { formatJsonRpcError, formatJsonRpcResult } from '@json-rpc-tools/utils'
import { SignClientTypes } from '@walletconnect/types'
import { ERROR } from '@walletconnect/utils'
import { nearWallet } from '@/utils/NearWalletUtil'
import { transactions } from "near-api-js";

export async function approveNearRequest(
  requestEvent: SignClientTypes.EventArguments['session_request']
) {
  const { params, id, topic } = requestEvent
  const { chainId, request } = params

  switch (request.method) {
    case NEAR_SIGNING_METHODS.NEAR_SIGN_IN: {
      console.log("approve", { id, params });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const accounts = await nearWallet.signIn({
        chainId,
        topic,
        permission: request.params.permission,
        accounts: request.params.accounts,
      });

      return formatJsonRpcResult(id, accounts);
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_OUT: {
      console.log("approve", { id, params });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

     const accounts = await nearWallet.signOut({
       chainId,
       topic,
       accounts: request.params.accounts
     });

      return formatJsonRpcResult(id, accounts);
    }
    case NEAR_SIGNING_METHODS.NEAR_GET_ACCOUNTS: {
      console.log("approve", { id, params });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const accounts = await nearWallet.getAccounts({ topic });

      return formatJsonRpcResult(id, accounts);
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_TRANSACTION: {
      console.log("approve", { id, params });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const [signedTx] = await nearWallet.signTransactions({
        chainId,
        topic,
        transactions: [transactions.Transaction.decode(
          Buffer.from(request.params.transaction),
        )]
      });

      return formatJsonRpcResult(id, signedTx.encode());
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_TRANSACTIONS: {
      console.log("approve", { id, params });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const signedTxs = await nearWallet.signTransactions({
        chainId,
        topic,
        transactions: params.request.params.transactions.map((tx: Uint8Array) => {
          return transactions.Transaction.decode(Buffer.from(tx));
        }),
      });

      return formatJsonRpcResult(id, signedTxs.map((x) => x.encode()));
    }
    default:
      throw new Error(ERROR.UNKNOWN_JSONRPC_METHOD.format().message)
  }
}

export function rejectNearRequest(request: SignClientTypes.EventArguments['session_request']) {
  const { id } = request

  return formatJsonRpcError(id, ERROR.JSONRPC_REQUEST_METHOD_REJECTED.format().message)
}
