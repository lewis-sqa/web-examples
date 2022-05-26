import { NEAR_SIGNING_METHODS } from '@/data/NEARData'
import { formatJsonRpcError, formatJsonRpcResult } from '@json-rpc-tools/utils'
import { RequestEvent } from '@walletconnect/types'
import { ERROR } from '@walletconnect/utils'
import { nearWallet } from '@/utils/NearWalletUtil'

export async function approveNearRequest(requestEvent: RequestEvent) {
  const { method, params, id } = requestEvent.request
  const { chainId } = requestEvent

  switch (method) {
    case NEAR_SIGNING_METHODS.NEAR_SIGN_TRANSACTION: {
      console.log("approve", { method, params, id });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const [signedTx] = await nearWallet.signTransactions({
        chainId,
        transactions: [{
          signerId: params.signerId,
          receiverId: params.receiverId,
          actions: params.actions
        }]
      });

      return formatJsonRpcResult(id, signedTx.encode());
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_TRANSACTIONS: {
      console.log("approve", { method, params, id });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const signedTxs = await nearWallet.signTransactions({
        chainId,
        transactions: params.transactions
      });

      return formatJsonRpcResult(
        id,
        signedTxs.map((signedTx) => signedTx.encode())
      );
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_IN: {
      console.log("approve", { method, params, id });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const accounts = await nearWallet.signIn({
        chainId,
        contractId: params.contractId,
        methodNames: params.methodNames || [],
        accounts: params.accounts
      });

      return formatJsonRpcResult(id, accounts);
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_OUT: {
      console.log("approve", { method, params, id });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const accounts = await nearWallet.signOut({
        chainId,
        accounts: params.accounts
      });

      return formatJsonRpcResult(id, accounts);
    }
    default:
      throw new Error(ERROR.UNKNOWN_JSONRPC_METHOD.format().message)
  }
}

export function rejectNearRequest(request: RequestEvent['request']) {
  const { id } = request

  return formatJsonRpcError(id, ERROR.JSONRPC_REQUEST_METHOD_REJECTED.format().message)
}
