import { NEAR_SIGNING_METHODS } from '@/data/NEARData'
import { formatJsonRpcError, formatJsonRpcResult } from '@json-rpc-tools/utils'
import { SignClientTypes } from '@walletconnect/types'
import { ERROR } from '@walletconnect/utils'
import { nearWallet } from '@/utils/NearWalletUtil'

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
        contractId: request.params.contractId,
        methodNames: request.params.methodNames || [],
      });

      return formatJsonRpcResult(id, accounts);
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_OUT: {
      console.log("approve", { id, params });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

     const accounts = await nearWallet.signOut({ chainId, topic });

      return formatJsonRpcResult(id, accounts);
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_AND_SEND_TRANSACTION: {
      console.log("approve", { id, params });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const res = await nearWallet.signAndSendTransaction({
        chainId,
        topic,
        signerId: request.params.signerId,
        receiverId: request.params.receiverId,
        actions: request.params.actions
      });

      return formatJsonRpcResult(id, res);
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_AND_SEND_TRANSACTIONS: {
      console.log("approve", { id, params });

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const res = await nearWallet.signAndSendTransactions({
        chainId,
        topic,
        transactions: request.params.transactions,
      });

      return formatJsonRpcResult(id, res);
    }
    default:
      throw new Error(ERROR.UNKNOWN_JSONRPC_METHOD.format().message)
  }
}

export function rejectNearRequest(request: SignClientTypes.EventArguments['session_request']) {
  const { id } = request

  return formatJsonRpcError(id, ERROR.JSONRPC_REQUEST_METHOD_REJECTED.format().message)
}
