import { describe, expect, test } from "bun:test";
import { fishAbbreviation, isInteractiveInvocation, parseAbbrLine, quoteArg, shellQuote, throughShell, userShell } from "../src/usershell";

describe("user shell", () => {
  test("only an interactive shell invocation counts as the user's shell", () => {
    expect(isInteractiveInvocation("-fish", "-fish")).toBe(true); // login shell
    expect(isInteractiveInvocation("fish", "/opt/homebrew/bin/fish")).toBe(true);
    expect(isInteractiveInvocation("zsh", "/bin/zsh -il")).toBe(true);
    expect(isInteractiveInvocation("bash", "bash run.sh")).toBe(false); // a script runner
    expect(isInteractiveInvocation("bash", "bash -c tcut rec -- ll")).toBe(false); // a one-liner
    expect(isInteractiveInvocation("sh", "/bin/sh -c make")).toBe(false);
  });

  test("quotes argv for the shell that will read it", () => {
    expect(shellQuote(["ls", "-la", "./src"], "zsh")).toBe("ls -la ./src");
    expect(shellQuote(["echo", "hello world"], "bash")).toBe("echo 'hello world'");
    expect(quoteArg("it's", "bash")).toBe("'it'\\''s'");
    expect(quoteArg("it's", "fish")).toBe("'it\\'s'");
    // fish reads backslashes inside single quotes; POSIX shells do not
    expect(quoteArg("a\\\\b", "bash")).toBe("'a\\\\b'");
    expect(quoteArg("a\\\\b", "fish")).toBe("'a\\\\\\\\b'");
    expect(quoteArg("$HOME", "fish")).toBe("'$HOME'");
  });

  test("runs the command interactively in the detected shell, and names the shell portably", () => {
    const zsh = { path: "/bin/zsh", name: "zsh" };
    expect(throughShell(["ls", "-la"], zsh)).toEqual({ argv: ["/bin/zsh", "-ic", "ls -la"], portable: ["zsh", "-ic", "ls -la"] });
  });

  test("parses fish's own `abbr --show` output, including the awkward shapes", () => {
    expect(parseAbbrLine("abbr -a -- lzg lazygit")).toEqual({ name: "lzg", expansion: "lazygit" });
    expect(parseAbbrLine("abbr -a -- gco 'git checkout'")).toEqual({ name: "gco", expansion: "git checkout" });
    // fish switches to double quotes when the expansion contains a single quote
    expect(parseAbbrLine(`abbr -a -- zz "echo it's here"`)).toEqual({ name: "zz", expansion: "echo it's here" });
    // a ` -- ` inside the expansion must not be taken for the separator
    expect(parseAbbrLine("abbr -a -- gd 'git diff -- a b'")).toEqual({ name: "gd", expansion: "git diff -- a b" });
    // the cursor marker is not part of the command
    expect(parseAbbrLine("abbr -a --set-cursor='%' -- L 'less %'")).toEqual({ name: "L", expansion: "less " });
    expect(parseAbbrLine("abbr -a --set-cursor -- L 'less %'")).toEqual({ name: "L", expansion: "less " });
    // kinds that cannot be expanded ahead of time
    expect(parseAbbrLine("abbr -a --regex '^g\\d+$' --function expand_g -- g")).toBeNull();
    expect(parseAbbrLine("abbr -a --position anywhere -- L '| less'")).toBeNull();
    expect(parseAbbrLine("# not an abbr")).toBeNull();
  });

  test("expands a leading fish abbreviation declared inside `if status is-interactive`", async () => {
    const fish = Bun.which("fish");
    if (!fish) return;
    const home = `/tmp/tcut-abbr-test-${process.pid}`;
    await Bun.write(`${home}/fish/config.fish`, "if status is-interactive\n  abbr -a -- tcuttest 'echo expanded'\nend\n");
    const saved = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = home;
    try {
      const shell = { path: fish, name: "fish" };
      expect(fishAbbreviation(shell, "tcuttest")).toBe("echo expanded");
      expect(fishAbbreviation(shell, "not-an-abbr")).toBeNull();
      expect(throughShell(["tcuttest", "x y"], shell).argv).toEqual([fish, "-ic", "echo expanded 'x y'"]);
    } finally {
      if (saved === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = saved;
    }
  });

  test("falls back to $SHELL when the parent is not an interactive shell", () => {
    if (process.platform === "win32") return;
    const saved = process.env.SHELL;
    process.env.SHELL = "/bin/bash";
    try {
      // under `bun test` the parent process is bun, so $SHELL decides
      expect(userShell()).toEqual({ path: "/bin/bash", name: "bash" });
    } finally {
      if (saved === undefined) delete process.env.SHELL;
      else process.env.SHELL = saved;
    }
  });
});
