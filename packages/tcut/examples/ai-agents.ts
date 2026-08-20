import { defineVideo } from "tcut";

// Record AI coding agents answering a question about a file. Output is whatever the model says — the *recording*
// is non-deterministic, but once recorded the cast renders identically forever (and can be re-themed).
// Requires `claude` (Claude Code) and/or `codex` on PATH, logged in. Each run spends a few tokens.
const HAS_CLAUDE = Bun.which("claude") !== null;
const HAS_CODEX = Bun.which("codex") !== null;

export default defineVideo(
  {
    output: ["out/ai-agents.mp4", "out/ai-agents.gif", "out/ai-agents.svg"],
    theme: "github-dark",
    cols: 96,
    rows: 22,
    fps: 30,
    typingSpeed: "30ms",
    typingJitter: 0.3,
    windowBar: "colorful",
    title: "claude · codex",
    margin: 28,
    borderRadius: 12,
    marginFill: "#010409",
    waitTimeout: "90s",
  },
  async (t) => {
    await t.hide(async () => {
      await t.run("cd $(mktemp -d)");
      await t.run(`printf 'export const add = (a: number, b: number) => a + b;\\nexport const mul = (a: number, b: number) => a * b;\\n' > math.ts`);
      await t.clear();
    });

    await t.run("cat math.ts");
    await t.sleep("800ms");

    if (HAS_CLAUDE) {
      await t.type(`claude -p "In one sentence, what does math.ts export?"`);
      await t.sleep("300ms");
      await t.enter();
      await t.wait(); // the model's answer prints, then the prompt returns
      await t.expect(/add|mul/i);
      await t.sleep("1.5s");
    }

    if (HAS_CODEX) {
      await t.type(`codex exec --skip-git-repo-check "Add a subtract function to math.ts, then show the file."`);
      await t.sleep("300ms");
      await t.enter();
      await t.wait();
      await t.sleep("600ms");
      await t.run("cat math.ts");
      await t.expect(/subtract|sub/i);
      await t.sleep("2s");
    }
  },
);
