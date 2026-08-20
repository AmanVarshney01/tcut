import { defineVideo } from "tcut";

// Drives an interactive TUI: `bun create better-t-stack` with arrow keys and Enter.
// Shows wait() against the rendered screen — tcut presses keys only once the prompt is actually visible.
export default defineVideo(
  {
    output: ["out/better-t-stack.mp4", "out/better-t-stack.gif", "out/better-t-stack.svg"],
    theme: "tokyo-night",
    cols: 100,
    rows: 30,
    fps: 30,
    typingSpeed: "25ms",
    typingJitter: 0.3,
    windowBar: "colorful",
    title: "bun create better-t-stack",
    margin: 28,
    borderRadius: 12,
    marginFill: "#0f1016",
    waitTimeout: "120s",
  },
  async (t) => {
    await t.hide(async () => {
      await t.run("cd $(mktemp -d)");
      await t.clear();
    });

    // Most choices are passed as flags so the video stays short; the rest are answered in the TUI.
    await t.type(
      "bun create better-t-stack@latest my-app --backend none --database none --auth none --payments none --examples none --server-deploy none --package-manager bun --no-git --no-install --disable-analytics",
    );
    await t.sleep("400ms");
    await t.enter();

    const screen = { scope: "screen" as const };

    await t.wait(/What are you building\?/, screen);
    await t.sleep("700ms");
    await t.enter(); // Web

    await t.wait(/Choose a web framework/, screen);
    await t.sleep("600ms");
    for (let i = 0; i < 6; i++) {
      await t.down();
      await t.sleep("160ms");
    }
    await t.sleep("500ms");
    await t.enter(); // Astro

    await t.wait(/Pick addons/, screen);
    await t.sleep("700ms");
    await t.enter(); // Turborepo (preselected)

    await t.wait(/Choose web deployment/, screen);
    await t.sleep("600ms");
    // The option list varies between versions: move until the highlighted row (●) is Cloudflare.
    for (let i = 0; i < 8 && !/●\s+Cloudflare/.test(t.screen()); i++) {
      await t.up();
      await t.sleep("180ms");
    }
    await t.expect(/●\s+Cloudflare/);
    await t.sleep("500ms");
    await t.enter(); // Cloudflare

    // Whatever remains (editor prompt, summary…) — accept defaults until the shell prompt is back.
    for (let i = 0; i < 6; i++) {
      const done = await Promise.race([
        t.wait(undefined, { timeout: "2s" }).then(() => true, () => false),
        t.wait(/enter\s+choose|enter\s+select|Y\/n|y\/N/i, { ...screen, timeout: "2s" }).then(() => false, () => null),
      ]);
      if (done === true) break;
      if (done === false) {
        await t.sleep("500ms");
        await t.enter();
      }
    }
    await t.wait(undefined, { timeout: "120s" });
    await t.expect(/Project ready|Next steps|cd my-app/i);
    await t.sleep("1s");

    await t.run("cat my-app/bts.jsonc");
    await t.expect(/"astro"/);
    await t.expect(/"webDeploy": "cloudflare"/);
    await t.sleep("2.5s");
  },
);
