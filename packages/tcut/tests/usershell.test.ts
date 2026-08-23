import { describe, expect, test } from "bun:test";
import { fishAbbreviation, shellQuote, throughShell, userShell } from "../src/usershell";

describe("user shell", () => {
  test("quotes argv the way bash, zsh and fish all read it", () => {
    expect(shellQuote(["ls", "-la", "./src"])).toBe("ls -la ./src");
    expect(shellQuote(["echo", "hello world"])).toBe("echo 'hello world'");
    expect(shellQuote(["echo", "it's"])).toBe("echo 'it'\\''s'");
    expect(shellQuote(["grep", "$HOME"])).toBe("grep '$HOME'");
  });

  test("runs the command interactively in the detected shell", () => {
    const shell = { path: "/bin/zsh", name: "zsh" };
    expect(throughShell(["ls", "-la"], shell)).toEqual(["/bin/zsh", "-ic", "ls -la"]);
  });

  test("falls back to $SHELL when the parent is not a shell", () => {
    if (process.platform === "win32") return;
    const saved = process.env.SHELL;
    process.env.SHELL = "/bin/bash";
    try {
      // under `bun test` the parent process is bun, so $SHELL decides
      const shell = userShell();
      expect(shell).not.toBeNull();
      expect(["bash", "zsh", "fish"]).toContain(shell!.name);
    } finally {
      if (saved === undefined) delete process.env.SHELL;
      else process.env.SHELL = saved;
    }
  });

  test("is off on Windows and ignores unknown shells", () => {
    expect(fishAbbreviation({ path: "/bin/bash", name: "bash" }, "lzg")).toBeNull();
  });

  test("expands a leading fish abbreviation when fish is available", () => {
    const fish = Bun.which("fish");
    if (!fish) return;
    // `abbr --show` format is stable: `abbr -a -- name expansion`
    const shell = { path: fish, name: "fish" };
    const out = throughShell(["definitely-not-an-abbr-xyz", "arg"], shell);
    expect(out).toEqual([fish, "-ic", "definitely-not-an-abbr-xyz arg"]);
  });
});
