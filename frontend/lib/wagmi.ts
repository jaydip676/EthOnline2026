import { http } from "viem";
import { base } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  oneInchWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";

const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "https://mainnet.base.org";

export const chain = base;

export const wagmiConfig = getDefaultConfig({
  appName: "Ladder",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "ladder-ethonline",
  chains: [base],
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
    [base.id]: http(rpc),
  },
  ssr: true,
});
