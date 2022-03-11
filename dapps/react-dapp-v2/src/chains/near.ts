import { JsonRpcRequest } from "@walletconnect/jsonrpc-utils";

import { BLOCKCHAIN_LOGO_BASE_URL } from "../constants";

import { NamespaceMetadata, ChainMetadata, ChainRequestRender } from "../helpers";

export const NearMetadata: NamespaceMetadata = {
  "mainnet": {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "near:mainnet.png",
    rgb: "27, 31, 53",
  },
  "testnet": {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "near:testnet.png",
    rgb: "27, 31, 53",
  },
  "betanet": {
    logo: BLOCKCHAIN_LOGO_BASE_URL + "near:betanet.png",
    rgb: "27, 31, 53",
  },
};

export function getChainMetadata(chainId: string): ChainMetadata {
  const reference = chainId.split(":")[1];
  const metadata = NearMetadata[reference];
  if (typeof metadata === "undefined") {
    throw new Error(`No chain metadata found for chainId: ${chainId}`);
  }
  return metadata;
}

export function getChainRequestRender(request: JsonRpcRequest): ChainRequestRender[] {
  let params = [{ label: "Method", value: request.method }];

  switch (request.method) {
    default:
      params = [
        ...params,
        {
          label: "params",
          value: JSON.stringify(request.params, null, "\t"),
        },
      ];
      break;
  }
  return params;
}