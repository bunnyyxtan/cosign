import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { client, mezoTestnet } from "./chain";

/**
 * DEVELOPMENT ONLY. An EIP-1193 provider backed by a local Mezo testnet key, so the app can be driven in a browser
 * without a wallet extension. Installs only under `vite dev` when VITE_DEV_PRIVATE_KEY is set in the gitignored
 * web/.env.development.local, and never overrides a real wallet. Production builds never load that file.
 */
export function installDevWallet() {
  const key = import.meta.env.VITE_DEV_PRIVATE_KEY as Hex | undefined;
  if (!import.meta.env.DEV || !key || window.ethereum) return;
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: mezoTestnet, transport: http(import.meta.env.VITE_RPC || undefined) });
  window.ethereum = {
    request: async ({ method, params }) => {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return [account.address];
        case "eth_chainId":
          return "0x7b7b";
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          return null;
        case "eth_sendTransaction": {
          const tx = (params as { to: Hex; data?: Hex; value?: Hex; gas?: Hex }[])[0];
          return wallet.sendTransaction({
            to: tx.to,
            data: tx.data,
            value: tx.value ? BigInt(tx.value) : undefined,
            gas: tx.gas ? BigInt(tx.gas) : undefined,
          });
        }
        default:
          return client.request({ method, params } as never);
      }
    },
  };
  console.info(`[dev wallet] ${account.address} on Mezo testnet`);
}
