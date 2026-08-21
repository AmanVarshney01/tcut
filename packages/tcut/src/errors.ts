import { formatMs } from "./duration";

export class WaitTimeoutError extends Error {
  constructor(what: string, timeoutMs: number, screen: string) {
    super(`Timed out after ${formatMs(timeoutMs)} waiting for ${what}.\n\n--- screen ---\n${screen}\n--------------`);
    this.name = "WaitTimeoutError";
  }
}

export class ExpectationError extends Error {
  constructor(what: string, screen: string) {
    super(`Expected ${what} to match.\n\n--- screen ---\n${screen}\n--------------`);
    this.name = "ExpectationError";
  }
}
