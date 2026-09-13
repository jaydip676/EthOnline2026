export const SITE_NAME = "Ladder";

export const SITE_DESCRIPTION =
  "CEX-style grid on official 1inch Aqua. Rungs re-arm themselves. Coverage stops underfunded quotes on-chain. Tokens stay in the wallet.";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const ICONS = {
  favicon: "/icons/ladder-favicon.svg",
  mark: "/icons/ladder-icon.svg",
  mark512: "/icons/ladder-icon-512.svg",
  lockup: "/icons/ladder-lockup-light.svg",
  cover: "/icons/ladder-cover-1200x630.png",
  coverSvg: "/icons/ladder_cover_image_1200x630_v3.svg",
} as const;
