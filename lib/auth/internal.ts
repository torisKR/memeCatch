import { AsyncLocalStorage } from "node:async_hooks";

const internalSignup = new AsyncLocalStorage<boolean>();

export function allowInternalSignup<T>(run: () => Promise<T>): Promise<T> {
  return internalSignup.run(true, run);
}

export function internalSignupOpen(): boolean {
  return internalSignup.getStore() === true;
}

export function blockedPublicEmail(email: string): boolean {
  const value = email.toLowerCase();
  return value.endsWith("@auth.memecatch.internal") || value.endsWith("@wallet.memecatch.internal");
}
