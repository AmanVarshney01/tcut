import path from "node:path";

// `tcut rec` should record what the user sees in their own terminal: their shell, with its prompt, aliases,
// functions, abbreviations and colour settings. Running the bare binary or a clean shell gives none of that
// ("Executable not found" for an alias, plain output for a coloured one).

export interface UserShell {
  path: string;
  /** bash | zsh | fish — the shells whose `-ic <command>` / `-il` forms load the interactive config. */
  name: string;
}

const INTERACTIVE_SHELLS = new Set(["bash", "zsh", "fish"]);

interface ParentProcess {
  /** Executable as reported by `ps -o comm=` (login shells show a leading dash: "-fish"). */
  command: string;
  /** Full command line as reported by `ps -o args=`. */
  args: string;
}

/** The process that launched tcut (macOS/Linux `ps`). Null when that cannot be read. */
function parentProcess(): ParentProcess | null {
  const field = (name: string): string => Bun.spawnSync(["ps", "-o", `${name}=`, "-p", String(process.ppid)], { env: process.env }).stdout.toString().trim();
  try {
    const command = field("comm");
    if (!command) return null;
    return { command, args: field("args") };
  } catch {
    return null;
  }
}

/**
 * Is this shell invocation the user's interactive session, rather than a script runner? A shell running a
 * script (`bash run.sh`) or a one-liner (`bash -c …`) is not the shell the user lives in — its rc files and
 * aliases are the wrong ones — so only flag-only invocations (`fish`, `-zsh`, `/bin/bash -il`) count.
 */
export function isInteractiveInvocation(comm: string, args: string): boolean {
  if (comm.startsWith("-")) return true; // login shell
  const words = args.split(/\s+/).filter(Boolean);
  const rest = words[0] && !words[0].startsWith("-") ? words.slice(1) : words; // drop argv[0] if present
  for (const w of rest) {
    if (w === "-c" || !w.startsWith("-")) return false;
  }
  return true;
}

/**
 * The shell the user typed tcut into: the parent process when it is an interactive bash/zsh/fish, else $SHELL.
 * Null on Windows or when neither is a known shell.
 */
export function userShell(): UserShell | null {
  if (process.platform === "win32") return null;
  const candidates: string[] = [];
  const parent = parentProcess();
  if (parent) {
    const comm = parent.command.replace(/^-/, "");
    if (INTERACTIVE_SHELLS.has(path.basename(comm)) && isInteractiveInvocation(parent.command, parent.args)) candidates.push(comm);
  }
  if (process.env.SHELL) candidates.push(process.env.SHELL);
  for (const candidate of candidates) {
    const name = path.basename(candidate);
    if (!INTERACTIVE_SHELLS.has(name)) continue;
    const resolved = candidate.includes("/") ? candidate : Bun.which(candidate);
    if (resolved) return { path: resolved, name };
  }
  return null;
}

/** One argument, single-quoted for the given shell. POSIX shells take everything literally; fish reads `\'` and `\\`. */
export function quoteArg(arg: string, shellName: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(arg)) return arg;
  const inner = shellName === "fish" ? arg.replace(/\\/g, "\\\\").replace(/'/g, "\\'") : arg.replace(/'/g, `'\\''`);
  return `'${inner}'`;
}

export function shellQuote(args: string[], shellName: string): string {
  return args.map((a) => quoteArg(a, shellName)).join(" ");
}

export interface FishAbbreviation {
  name: string;
  expansion: string;
}

/** Fish's own quoting, as `abbr --show` prints it: bare, '…' (escapes \' \\) or "…" (escapes \" \\ \$). */
function fishTokens(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let inWord = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quote) {
      if (ch === "\\" && i + 1 < line.length) {
        const next = line[i + 1]!;
        const escapable = quote === "'" ? "\\'" : '\\"$';
        if (escapable.includes(next)) {
          cur += next;
          i++;
          continue;
        }
      }
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (inWord) out.push(cur);
      cur = "";
      inWord = false;
      continue;
    }
    cur += ch;
    inWord = true;
  }
  if (inWord) out.push(cur);
  return out;
}

/**
 * One `abbr --show` line → the abbreviation it declares, or null for the kinds that cannot be expanded up
 * front (regex names, function-computed expansions, anywhere-position). `--set-cursor` markers are removed.
 */
export function parseAbbrLine(line: string): FishAbbreviation | null {
  const tokens = fishTokens(line.trim());
  if (tokens[0] !== "abbr") return null;
  let cursorMarker: string | null = null;
  let i = 1;
  for (; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === "--") {
      i++;
      break;
    }
    if (t === "-a" || t === "--add" || t === "-g" || t === "--global" || t === "-U" || t === "--universal") continue;
    if (t === "--regex" || t === "--function" || t === "-f" || t === "--command") return null;
    if (t === "--position") {
      if (tokens[i + 1] !== "command") return null;
      i++;
      continue;
    }
    if (t.startsWith("--position=")) {
      if (t !== "--position=command") return null;
      continue;
    }
    if (t === "--set-cursor") {
      cursorMarker = "%";
      continue;
    }
    if (t.startsWith("--set-cursor=")) {
      cursorMarker = t.slice("--set-cursor=".length) || "%";
      continue;
    }
    if (t.startsWith("--regex=") || t.startsWith("--function=") || t.startsWith("--command=")) return null;
    if (t.startsWith("-")) continue; // unknown flag: ignore
    break; // name without a `--` separator (older fish)
  }
  const name = tokens[i];
  const expansion = tokens[i + 1];
  if (!name || expansion === undefined) return null;
  return { name, expansion: cursorMarker ? expansion.split(cursorMarker).join("") : expansion };
}

/**
 * fish abbreviations expand only at the prompt, never in `fish -c`; expand a leading one ourselves. The list is
 * read from an interactive fish, because the stock config.fish declares them inside `if status is-interactive`.
 */
export function fishAbbreviation(shell: UserShell, word: string): string | null {
  if (shell.name !== "fish") return null;
  try {
    // env is passed explicitly: Bun.spawnSync otherwise uses the environment as it was at startup.
    const r = Bun.spawnSync([shell.path, "-ic", "abbr --show"], { stdin: "ignore", env: process.env });
    for (const line of r.stdout.toString().split("\n")) {
      const abbr = parseAbbrLine(line);
      if (abbr && abbr.name === word) return abbr.expansion;
    }
  } catch {
    /* no abbreviations available */
  }
  return null;
}

export interface ShellCommand {
  /** What to spawn. */
  argv: string[];
  /** The same command with the shell by name, for scripts that should run on other machines. */
  portable: string[];
}

/** `args` the way the user's shell runs them when typed: interactive, so aliases, functions and abbreviations apply. */
export function throughShell(args: string[], shell: UserShell): ShellCommand {
  const [first, ...rest] = args;
  const expanded = first ? fishAbbreviation(shell, first) : null;
  const line = expanded ? `${expanded} ${shellQuote(rest, shell.name)}`.trim() : shellQuote(args, shell.name);
  return { argv: [shell.path, "-ic", line], portable: [shell.name, "-ic", line] };
}
