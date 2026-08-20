import { defineVideo } from "tcut";

// Produces the media embedded in README.md: `bun src/cli.ts examples/readme.ts`
export default defineVideo(
  {
    output: ["docs/demo.gif", "docs/demo.svg", "docs/demo.png"],
    theme: "catppuccin-mocha",
    cols: 76,
    rows: 16,
    fps: 30,
    typingSpeed: "35ms",
    typingJitter: 0.35,
    windowBar: "colorful",
    title: "tcut",
    padding: 18,
    margin: 28,
    borderRadius: 12,
    marginFill: "#11111b",
    font: { size: 18 },
  },
  async (t) => {
    await t.hide(async () => {
      await t.run("cd $(mktemp -d) && printf '# tcut\\n\\nTerminal videos as code.\\n' > README.md");
      await t.clear();
    });

    await t.run("echo 'Hello from tcut 👋'");
    await t.expect(/Hello from tcut/);
    await t.sleep("700ms");

    await t.type("cat README.md");
    await t.sleep("300ms");
    await t.enter();
    await t.wait();
    await t.sleep("900ms");

    await t.run("bun --version");
    await t.sleep("2s");
  },
);
