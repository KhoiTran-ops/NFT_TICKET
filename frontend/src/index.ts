// Khung tối thiểu (TIC-27). UI thay bằng Next.js App Router + Tailwind + MSW ở S0-10 (TIC-36).
import { FUJI_CHAIN_ID } from "@nft-ticket/shared";

export const frontendInfo = {
  name: "frontend",
  chainId: FUJI_CHAIN_ID,
} as const;
