import { fallback, http, webSocket } from "viem";
import { base, sepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  oneInchWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { CHAIN_ID } from "./addresses";

const rpc =
  process.env.NEXT_PUBLIC_RPC_URL ??
  (CHAIN_ID === 11155111
    ? "wss://ethereum-sepolia-rpc.publicnode.com"
    : "https://base-rpc.publicnode.com");

const chain = CHAIN_ID === 11155111 ? sepolia : base;

function transport() {
  const isWs = rpc.startsWith("ws://") || rpc.startsWith("wss://");
  const httpUrl = isWs ? rpc.replace(/^wss:/, "https:").replace(/^ws:/, "http:") : rpc;
  if (typeof window === "undefined") return http(httpUrl);
  if (isWs) return fallback([webSocket(rpc), http(httpUrl)]);
  return http(rpc);
}

export const wagmiConfig = getDefaultConfig({
  appName: "Ladder",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "ladder-ethonline",
  chains: [chain],
  wallets: [
    {
      groupName: "1inch",
      wallets: [oneInchWallet],
    },
    {
      groupName: "Also on this device",
      wallets: [injectedWallet, metaMaskWallet, walletConnectWallet],
    },
  ],
  transports: {
    [chain.id]: transport(),
  },
  ssr: true,
});

export { chain };
