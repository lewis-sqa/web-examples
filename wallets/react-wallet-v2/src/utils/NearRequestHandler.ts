import { NEAR_SIGNING_METHODS } from '@/data/NEARData'
import { formatJsonRpcError, formatJsonRpcResult } from '@json-rpc-tools/utils'
import { RequestEvent } from '@walletconnect/types'
import { ERROR } from '@walletconnect/utils'
import { nearAddresses, nearWallets } from '@/utils/NearWalletUtil'
import { getWalletAddressFromParams } from "@/utils/HelperUtil";

export async function approveNearRequest(requestEvent: RequestEvent) {
  const { method, params, id } = requestEvent.request
  const { chainId } = requestEvent
  const wallet = nearWallets[getWalletAddressFromParams(nearAddresses, params)]

  switch (method) {
    case NEAR_SIGNING_METHODS.NEAR_REQUEST_SIGN_IN: {
      console.log("approve", {method, params, id});

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const res = await wallet.requestSignIn({
        contractId: params.contractId,
        methodNames: params.methodNames
      });

      return formatJsonRpcResult(id, res);
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_TRANSACTION: {
      console.log("approve", {method, params, id});

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const res = await wallet.signTransaction({
        chainId,
        receiverId: params.receiverId,
        actions: params.actions
      });

      return formatJsonRpcResult(id, Buffer.from(res.encode()).toString('base64'));
    }
    case NEAR_SIGNING_METHODS.NEAR_SIGN_AND_SEND_TRANSACTION: {
      console.log("approve", {method, params, id});

      if (!chainId) {
        throw new Error("Invalid chain id");
      }

      const res = await wallet.signAndSendTransaction({
        chainId,
        receiverId: params.receiverId,
        actions: params.actions
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
