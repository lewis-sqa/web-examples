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

      return formatJsonRpcResult(id, signedTx);
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

      return formatJsonRpcResult(id, signedTxs);
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_AND_SEND_TRANSACTION: {
      console.log("approve", { method, params, id });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const res = await nearWallet.signAndSendTransaction({
        chainId,
        signerId: params.signerId,
        receiverId: params.receiverId,
        actions: params.actions
      });

      return formatJsonRpcResult(id, res);
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_AND_SEND_TRANSACTIONS: {
      console.log("approve", { method, params, id });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const res = await nearWallet.signAndSendTransactions({
        chainId,
        transactions: params.transactions,
      });

      return formatJsonRpcResult(id, res);
    }
    default:
      throw new Error(ERROR.UNKNOWN_JSONRPC_METHOD.format().message)
  }
}

export function rejectNearRequest(request: RequestEvent['request']) {
  const { id } = request

  return formatJsonRpcError(id, ERROR.JSONRPC_REQUEST_METHOD_REJECTED.format().message)
}
