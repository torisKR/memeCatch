export class SecretEnvelopeError extends Error { readonly code: string }
export function decodeEncryptionKey(encodedKey: string): Buffer;
export function encryptSecret(secret: string, context: string, encodedKey: string, random?: (size: number) => Buffer): string;
export function decryptSecret(value: string, context: string, encodedKey: string): string;
