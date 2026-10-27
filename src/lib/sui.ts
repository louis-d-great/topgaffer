import "server-only";
import { ChannelCredentials } from "@grpc/grpc-js";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";

/*
 * Sui through Tatum's gRPC gateway (Sui's JSON-RPC is deprecated, and Tatum's
 * gateway speaks native gRPC, not gRPC-web). The app's own wallet pays the gas,
 * so managers never need a wallet or crypto.
 */

type Network = "testnet" | "mainnet";

export const SUI_NETWORK: Network = process.env.SUI_NETWORK === "mainnet" ? "mainnet" : "testnet";

let client: SuiGrpcClient | null = null;

export function sui() {
  if (!client) {
    const key = SUI_NETWORK === "mainnet" ? process.env.TATUM_API_KEY_MAINNET : process.env.TATUM_API_KEY_TESTNET;
    if (!key) throw new Error(`Tatum ${SUI_NETWORK} API key is not configured.`);
    const transport = new GrpcTransport({
      host: `sui-${SUI_NETWORK}-grpc.gateway.tatum.io:443`,
      channelCredentials: ChannelCredentials.createSsl(),
      meta: { "x-api-key": key },
    });
    client = new SuiGrpcClient({ network: SUI_NETWORK, transport });
  }
  return client;
}

function signer() {
  const raw = process.env.SUI_PRIVATE_KEY;
  if (!raw) throw new Error("SUI_PRIVATE_KEY is not configured.");
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
}

const TABLE = "0x2::table::Table<vector<u8>, u64>";

/**
 * Records a plan fingerprint on Sui using only the standard library: a Table
 * holding { fingerprint → gameweek } is created and then frozen, so it can never
 * be edited or deleted. The transaction's checkpoint time proves *when*.
 */
export async function lockFingerprint(fingerprintHex: string, gw: number) {
  const tx = new Transaction();
  const table = tx.moveCall({ target: "0x2::table::new", typeArguments: ["vector<u8>", "u64"] });
  tx.moveCall({
    target: "0x2::table::add",
    typeArguments: ["vector<u8>", "u64"],
    arguments: [table, tx.pure.vector("u8", hexToBytes(fingerprintHex)), tx.pure.u64(gw)],
  });
  tx.moveCall({ target: "0x2::transfer::public_freeze_object", typeArguments: [TABLE], arguments: [table] });

  const result = await sui().signAndExecuteTransaction({ transaction: tx, signer: signer(), include: { effects: true } });
  if (result.$kind === "FailedTransaction") {
    throw new Error(`Sui transaction failed: ${result.FailedTransaction.digest}`);
  }
  const digest = result.Transaction.digest;
  await sui().waitForTransaction({ digest, timeout: 30_000 });
  return { digest, network: SUI_NETWORK, explorerUrl: `https://suiscan.xyz/${SUI_NETWORK}/tx/${digest}` };
}

export async function walletStatus() {
  const address = signer().toSuiAddress();
  const { balance } = await sui().getBalance({ owner: address });
  return { network: SUI_NETWORK, address, balanceSui: Number(BigInt(balance.balance)) / 1e9 };
}

function hexToBytes(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
