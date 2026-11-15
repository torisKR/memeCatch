import { AsyncLocalStorage } from "node:async_hooks";
export { blockedPublicEmail } from "@/lib/auth/reserved-email";

const internalSignup = new AsyncLocalStorage<boolean>();

export function allowInternalSignup<T>(run: () => Promise<T>): Promise<T> {
  return internalSignup.run(true, run);
}

export function internalSignupOpen(): boolean {
  return internalSignup.getStore() === true;
}
