import { MemWal } from "@mysten-incubation/memwal";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import fs from "node:fs";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { secretKey } = decodeSuiPrivateKey(process.env.SUI_PRIVATE_KEY);
console.log("app wallet address:", Ed25519Keypair.fromSecretKey(secretKey).getPublicKey().toSuiAddress());
console.log("SUI_NETWORK:", process.env.SUI_NETWORK ?? "(unset → testnet)");
const c = MemWal.create({ key: process.env.MEMWAL_KEY, accountId: process.env.MEMWAL_ACCOUNT_ID, serverUrl: process.env.MEMWAL_SERVER_URL ?? "https://relayer.memory.walrus.xyz", namespace: "topgaffer" });
const { job_ids } = await c.rememberBulkAsync([{ text: "TopGaffer connectivity probe: plain sentence.", namespace: "topgaffer-team-9999999" }], { idempotencyKey: "probe-" + Date.now() });
for (let i = 0; i < 15; i++) {
  await new Promise((r) => setTimeout(r, 8000));
  const { results } = await c.getRememberBulkStatus(job_ids);
  if (["done", "failed"].includes(results[0].status)) { console.log("walrus write:", results[0].status, (results[0].error ?? "").slice(0, 120)); break; }
  if (i === 14) console.log("walrus write still", results[0].status);
}
