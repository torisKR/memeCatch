import { createHmac, timingSafeEqual } from "node:crypto";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

const STATEMENT = "Sign in to MemeCatch with Kaia Wallet.";

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET?.trim();
  if (!value) throw new Error("BETTER_AUTH_SECRET is required");
  return value;
}

export function walletEmail(address: string): string {
  return `${address.toLowerCase()}@wallet.memecatch.internal`;
}

export function walletPassword(address: string): string {
  return createHmac("sha256", secret()).update(`kaia:${address.toLowerCase()}`).digest("hex");
}

export function createKaiaMessage(address: string): string {
  const exp = Date.now() + 5 * 60 * 1000;
  const payload = `${address.toLowerCase()}.${exp}`;
  const mac = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${STATEMENT}\n${payload}.${mac}`;
}

export function kaiaMessageAddress(message: string): string | null {
  const [statement, token] = message.split("\n");
  if (statement !== STATEMENT || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [address, exp, mac] = parts;
  if (!address || !exp || !mac || !/^0x[0-9a-f]{40}$/.test(address)) return null;
  if (Number(exp) < Date.now()) return null;
  const expected = createHmac("sha256", secret()).update(`${address}.${exp}`).digest("hex");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return address;
}

export function recoverPersonalSignAddress(message: string, signature: string): string | null {
  try {
    const bytes = hexToBytes(signature.replace(/^0x/, ""));
    if (bytes.length !== 65) return null;
    const compact = secp256k1.Signature.fromBytes(bytes, "recovered");
    const prefix = utf8ToBytes(`\u0019Ethereum Signed Message:\n${utf8ToBytes(message).length}`);
    const hash = keccak_256(new Uint8Array([...prefix, ...utf8ToBytes(message)]));
    const publicKey = compact.recoverPublicKey(hash).toBytes(false);
    const hashed = keccak_256(publicKey.slice(1));
    return `0x${bytesToHex(hashed.slice(-20))}`;
  } catch {
    return null;
  }
}
