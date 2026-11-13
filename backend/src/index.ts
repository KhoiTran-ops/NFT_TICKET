// Khung tối thiểu (TIC-27). BE thay bằng NestJS/Fastify + healthcheck + logger maskPii() ở S0-06 (TIC-32).
import { FUJI_CHAIN_ID } from "@nft-ticket/shared";

export const backendInfo = {
  name: "backend",
  chainId: FUJI_CHAIN_ID,
} as const;
