import { formatMs } from "./duration";

export class WaitTimeoutError extends Error {
  constructor(what: string, timeoutMs: number, screen: string) {
    super(`Timed out after ${formatMs(timeoutMs)} waiting for ${what}.\n\n--- screen ---\n${screen}\n--------------`);
    this.name = "WaitTimeoutError";
  }
}

/** A program named in `requires` is not on the PATH — raised before the shell is even started. */
export class MissingRequirementError extends Error {
  constructor(readonly missing: string[]) {
    super(
      `${missing.length === 1 ? `\`${missing[0]}\` is` : `${missing.map((m) => `\`${m}\``).join(", ")} are`} not on the PATH. Install ${missing.length === 1 ? "it" : "them"}, or remove ${missing.length === 1 ? "it" : "them"} from \`requires\`.`,
    );
    this.name = "MissingRequirementError";
  }
}

export class ExpectationError extends Error {
  constructor(what: string, screen: string) {
    super(`Expected ${what} to match.\n\n--- screen ---\n${screen}\n--------------`);
    this.name = "ExpectationError";
  }
}
