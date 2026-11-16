import { describe, expect, it } from "vitest";
import { relayerConfig } from "../src/modules/chain/worker.js";

const key = `0x${"11".repeat(32)}`;

describe("relayerConfig", () => {
  it("accepts a complete configuration and defaults to Fuji", () => {
    expect(relayerConfig({ RELAYER_PRIVATE_KEY: key, FUJI_RPC_URL: "https://rpc.example.test/ext/bc/C/rpc" }))
      .toEqual({ privateKey: key, rpcUrl: "https://rpc.example.test/ext/bc/C/rpc", chainId: 43113 });
  });

  it.each([
    [{}],
    [{ RELAYER_PRIVATE_KEY: key }],
    [{ RELAYER_PRIVATE_KEY: "0x1234", FUJI_RPC_URL: "https://rpc.example.test" }],
    [{ RELAYER_PRIVATE_KEY: key, FUJI_RPC_URL: "not a url" }],
    [{ RELAYER_PRIVATE_KEY: key, FUJI_RPC_URL: "ftp://rpc.example.test" }],
    [{ RELAYER_PRIVATE_KEY: key, FUJI_RPC_URL: "https://rpc.example.test", CHAIN_ID: "abc" }],
  ])("rejects %j without echoing secrets", (env) => {
    expect(() => relayerConfig(env)).toThrow(/^Invalid relayer configuration$/);
  });
});
