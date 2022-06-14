import { COSMOS_SIGNING_METHODS } from '@/data/COSMOSData'
import { EIP155_SIGNING_METHODS } from '@/data/EIP155Data'
import { SOLANA_SIGNING_METHODS } from '@/data/SolanaData'
import { NEAR_SIGNING_METHODS } from '@/data/NEARData'
import { nearWallet } from '@/utils/NearWalletUtil'
import ModalStore from '@/store/ModalStore'
import { signClient } from '@/utils/WalletConnectUtil'
import { SignClientTypes } from '@walletconnect/types'
import { ERROR } from '@walletconnect/utils'
import { useCallback, useEffect } from 'react'
import { formatJsonRpcResult } from "@json-rpc-tools/utils";

export default function useWalletConnectEventsManager(initialized: boolean) {
  /******************************************************************************
   * 1. Open session proposal modal for confirmation / rejection
   *****************************************************************************/
  const onSessionProposal = useCallback(
    (proposal: SignClientTypes.EventArguments['session_proposal']) => {
      ModalStore.open('SessionProposalModal', { proposal })
    },
    []
  )

  /******************************************************************************
   * 3. Open request handling modal based on method that was used
   *****************************************************************************/
  const onSessionRequest = useCallback(
    async (requestEvent: SignClientTypes.EventArguments['session_request']) => {
      console.log('session_request', requestEvent)
      const { id, topic, params } = requestEvent
      const { chainId, request } = params
      const requestSession = signClient.session.get(topic)

      switch (request.method) {
        case EIP155_SIGNING_METHODS.ETH_SIGN:
        case EIP155_SIGNING_METHODS.PERSONAL_SIGN:
          return ModalStore.open('SessionSignModal', { requestEvent, requestSession })

        case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA:
        case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V3:
        case EIP155_SIGNING_METHODS.ETH_SIGN_TYPED_DATA_V4:
          return ModalStore.open('SessionSignTypedDataModal', { requestEvent, requestSession })

        case EIP155_SIGNING_METHODS.ETH_SEND_TRANSACTION:
        case EIP155_SIGNING_METHODS.ETH_SIGN_TRANSACTION:
          return ModalStore.open('SessionSendTransactionModal', { requestEvent, requestSession })

        case COSMOS_SIGNING_METHODS.COSMOS_SIGN_DIRECT:
        case COSMOS_SIGNING_METHODS.COSMOS_SIGN_AMINO:
          return ModalStore.open('SessionSignCosmosModal', { requestEvent, requestSession })

        case SOLANA_SIGNING_METHODS.SOLANA_SIGN_MESSAGE:
        case SOLANA_SIGNING_METHODS.SOLANA_SIGN_TRANSACTION:
          return ModalStore.open('SessionSignSolanaModal', { requestEvent, requestSession })

        case NEAR_SIGNING_METHODS.NEAR_SIGN_IN:
        case NEAR_SIGNING_METHODS.NEAR_SIGN_OUT:
          return ModalStore.open('SessionSignNearModal', { requestEvent, requestSession })

        case NEAR_SIGNING_METHODS.NEAR_SIGN_AND_SEND_TRANSACTION: {
          try {
            const elevated = await nearWallet.isElevatedPermission({
              chainId,
              topic,
              transactions: [{
                signerId: request.params.signerId,
                receiverId: request.params.receiverId,
                actions: request.params.actions
              }]
            });

            if (elevated) {
              return ModalStore.open('SessionSignNearModal', {
                requestEvent,
                requestSession
              });
            }

            return signClient.respond({
              topic,
              response: formatJsonRpcResult(
                id,
                await nearWallet.signAndSendTransaction({
                  chainId,
                  topic,
                  transaction: {
                    signerId: request.params.signerId,
                    receiverId: request.params.receiverId,
                    actions: request.params.actions
                  }
                })
              )
            });
          } catch (err) {
            console.log("err", err);
            return signClient.reject({
              id,
              reason: ERROR.MISSING_OR_INVALID.format({ name: "transaction" })
            });
          }
        }
        case NEAR_SIGNING_METHODS.NEAR_SIGN_AND_SEND_TRANSACTIONS: {
          try {
            const elevated = await nearWallet.isElevatedPermission({
              chainId,
              topic,
              transactions: request.params.transactions
            });

            if (elevated) {
              return ModalStore.open('SessionSignNearModal', {
                requestEvent,
                requestSession
              });
            }

            return signClient.respond({
              topic,
              response: formatJsonRpcResult(
                id,
                await nearWallet.signAndSendTransactions({
                  chainId,
                  topic,
                  transactions: request.params.transactions
                })
              )
            });
          } catch (err) {
            return signClient.reject({
              id,
              reason: ERROR.MISSING_OR_INVALID.format({ name: "transaction" })
            });
          }
        }
      default:
        return ModalStore.open('SessionUnsuportedMethodModal', { requestEvent, requestSession })
    }
  }, [])

  /******************************************************************************
   * Set up WalletConnect event listeners
   *****************************************************************************/
  useEffect(() => {
    if (initialized) {
      signClient.on('session_proposal', onSessionProposal)
      signClient.on('session_request', onSessionRequest)
      // TODOs
      signClient.on('session_ping', data => console.log('ping', data))
      signClient.on('session_event', data => console.log('event', data))
      signClient.on('session_update', data => console.log('update', data))
      signClient.on('session_delete', data => console.log('delete', data))
    }
  }, [initialized, onSessionProposal, onSessionRequest])
}
