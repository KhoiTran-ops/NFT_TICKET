// Xuất ABI từ contracts/out (sau `forge build`) và địa chỉ từ contracts/deployments/*.json
// sang packages/shared/src/abi/*.ts và packages/shared/src/addresses.ts.
// Chạy: pnpm --filter contracts abi:export
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sharedSrc = join(root, "..", "packages", "shared", "src");
const CONTRACTS = ["EventRegistry", "TicketRegistry"];
const HEADER = "// File sinh tự động bởi contracts/scripts/export-abi.mjs — không sửa tay.\n";

const lowerFirst = (s) => s[0].toLowerCase() + s.slice(1);

mkdirSync(join(sharedSrc, "abi"), { recursive: true });
const indexLines = [HEADER];
for (const name of CONTRACTS) {
  const artifact = join(root, "out", `${name}.sol`, `${name}.json`);
  if (!existsSync(artifact)) {
    console.error(`Thiếu ${artifact}. Chạy \`forge build\` trước.`);
    process.exit(1);
  }
  const { abi } = JSON.parse(readFileSync(artifact, "utf8"));
  const body = `${HEADER}export const ${lowerFirst(name)}Abi = ${JSON.stringify(abi, null, 2)} as const;\n`;
  writeFileSync(join(sharedSrc, "abi", `${name}.ts`), body);
  indexLines.push(`export * from "./${name}.js";`);
  console.log(`abi/${name}.ts: ${abi.length} mục`);
}
writeFileSync(join(sharedSrc, "abi", "index.ts"), indexLines.join("\n") + "\n");

const deployments = {};
const fuji = join(root, "deployments", "fuji.json");
if (existsSync(fuji)) {
  const d = JSON.parse(readFileSync(fuji, "utf8"));
  deployments[d.chainId] = { EventRegistry: d.EventRegistry, TicketRegistry: d.TicketRegistry, blockNumber: d.blockNumber };
}
const addresses = `${HEADER}import type { Address } from "./chain.js";

export interface ContractAddresses {
  EventRegistry: Address;
  TicketRegistry: Address;
  /** Block deploy, để indexer bắt đầu quét. */
  blockNumber: number;
}

/** Địa chỉ theo chainId. Rỗng nếu chưa deploy. */
export const CONTRACT_ADDRESSES: Partial<Record<number, ContractAddresses>> = ${JSON.stringify(deployments, null, 2)};
`;
writeFileSync(join(sharedSrc, "addresses.ts"), addresses);
console.log(`addresses.ts: ${Object.keys(deployments).length} chain`);
