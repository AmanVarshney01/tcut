import path from "node:path";

// `tcut rec -- ls` should record what the user sees when they type `ls`: their shell's alias, function or
// abbreviation, with their colour settings. Running the bare binary gives none of that ("Executable not
// found" for an alias, plain output for a coloured one). So the command goes through the shell tcut was
// launched from, interactively, the way the user's own terminal runs it.

export interface UserShell {
  path: string;
  /** bash | zsh | fish — the shells whose `-ic <command>` form loads the interactive config. */
  name: string;
}

const INTERACTIVE_SHELLS = new Set(["bash", "zsh", "fish"]);

/** The process that launched tcut, by executable name (macOS/Linux `ps`). Null when that cannot be read. */
function parentCommand(): string | null {
  try {
    const r = Bun.spawnSync(["ps", "-o", "comm=", "-p", String(process.ppid)]);
    const comm = r.stdout.toString().trim().replace(/^-/, ""); // login shells report as "-fish"
    return comm || null;
  } catch {
    return null;
  }
}

/** The shell the user typed tcut into, falling back to $SHELL. Null on Windows or when neither is a known shell. */
export function userShell(): UserShell | null {
  if (process.platform === "win32") return null;
  const candidates = [parentCommand(), process.env.SHELL].filter((c): c is string => Boolean(c));
  for (const candidate of candidates) {
    const name = path.basename(candidate);
    if (!INTERACTIVE_SHELLS.has(name)) continue;
    const resolved = candidate.includes("/") ? candidate : Bun.which(candidate);
    if (resolved) return { path: resolved, name };
  }
  return null;
}

/** Join argv into one command line; single quotes are understood the same way by bash, zsh and fish. */
export function shellQuote(args: string[]): string {
  return args.map((a) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(" ");
}

/** fish abbreviations expand only at the prompt, not in `fish -c`; expand a leading one ourselves. */
export function fishAbbreviation(shell: UserShell, word: string): string | null {
  if (shell.name !== "fish") return null;
  try {
    const r = Bun.spawnSync([shell.path, "-c", "abbr --show"]);
    for (const line of r.stdout.toString().split("\n")) {
      // `abbr -a -- lzg lazygit` (options may precede `--`; the expansion may be quoted)
      const m = /^abbr .*-- (\S+) (.+)$/.exec(line.trim());
      if (!m || m[1] !== word) continue;
      const expansion = m[2]!;
      return expansion.startsWith("'") && expansion.endsWith("'") ? expansion.slice(1, -1).replace(/\\'/g, "'") : expansion;
    }
  } catch {
    /* no abbreviations available */
  }
  return null;
}

/** `args` as the user's shell would run them when typed: interactive, so aliases, functions and abbreviations apply. */
export function throughShell(args: string[], shell: UserShell): string[] {
  const [first, ...rest] = args;
  const expanded = first ? fishAbbreviation(shell, first) : null;
  const line = expanded ? `${expanded} ${shellQuote(rest)}`.trim() : shellQuote(args);
  return [shell.path, "-ic", line];
}
