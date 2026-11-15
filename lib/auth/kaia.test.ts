import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { beforeAll, describe, expect, it } from "vitest";
import { createKaiaMessage, kaiaMessageAddress, recoverPersonalSignAddress } from "@/lib/auth/kaia";

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret";
});

describe("kaia personal_sign", () => {
  it("recovers the address that signed the issued challenge", () => {
    const { secretKey } = secp256k1.keygen();
    const publicKey = secp256k1.getPublicKey(secretKey, false);
    const address = `0x${bytesToHex(keccak_256(publicKey.slice(1)).slice(-20))}`;
    const message = createKaiaMessage(address);
    const prefix = utf8ToBytes(`\u0019Ethereum Signed Message:\n${utf8ToBytes(message).length}`);
    const hash = keccak_256(new Uint8Array([...prefix, ...utf8ToBytes(message)]));
    const signature = secp256k1.sign(hash, secretKey, { prehash: false, format: "recovered" });
    expect(kaiaMessageAddress(message)).toBe(address);
    expect(recoverPersonalSignAddress(message, `0x${bytesToHex(signature)}`)).toBe(address);
  });
});
