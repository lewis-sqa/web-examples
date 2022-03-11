import { NEAR_SIGNING_METHODS } from '@/data/NEARData'
import { formatJsonRpcError, formatJsonRpcResult } from '@json-rpc-tools/utils'
import { RequestEvent } from '@walletconnect/types'
import { ERROR } from '@walletconnect/utils'
import { nearWallet, transformActions } from '@/utils/NearWalletUtil'

export async function approveNearRequest(requestEvent: RequestEvent) {
  const { method, params, id } = requestEvent.request

  switch (method) {
    case NEAR_SIGNING_METHODS.NEAR_SIGN_AND_SEND_TRANSACTION:
      console.log("approve", { method, params, id });

      if (!params.actions.every((x) => x.type === "FunctionCall")) {
        throw new Error("Invalid actions");
      }

      // @ts-ignore
      if (!nearWallet.isSignedIn()) {
        await nearWallet.requestSignIn({ contractId: params.receiverId });
      }

      const account = nearWallet.account();

      // @ts-ignore
      const res = await account.signAndSendTransaction({
        receiverId: params.receiverId,
        actions: transformActions(params.actions)
      });

      return formatJsonRpcResult(id, res)

    default:
      throw new Error(ERROR.UNKNOWN_JSONRPC_METHOD.format().message)
  }
}

export function rejectNearRequest(request: RequestEvent['request']) {
  const { id } = request

  return formatJsonRpcError(id, ERROR.JSONRPC_REQUEST_METHOD_REJECTED.format().message)
}
