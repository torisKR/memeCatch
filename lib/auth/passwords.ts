import { hashPassword, verifyPassword } from "better-auth/crypto";
import bcrypt from "bcryptjs";

/** Supabase dumps store bcrypt. New passwords stay on Better Auth's scrypt. */
export async function verifyStoredPassword(hash: string, password: string): Promise<boolean> {
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    return bcrypt.compare(password, hash);
  }
  return verifyPassword({ hash, password });
}

export async function hashNewPassword(password: string): Promise<string> {
  return hashPassword(password);
}
