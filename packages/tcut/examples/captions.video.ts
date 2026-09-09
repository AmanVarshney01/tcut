import { defineVideo } from "../src/index";

// bun packages/tcut/src/cli.ts packages/tcut/examples/captions.video.ts
export default defineVideo({
  output: "out/captions-demos/styles.mp4",
  width: 960, height: 600, cols: 70, rows: 18, fps: 30,
  font: { family: "JetBrains Mono", size: 18, lineHeight: 1.3 },
  theme: "catppuccin-mocha",
  title: "tcut / subtitle styles", windowBar: "colorful",
  padding: 24, margin: 32, borderRadius: 16,
  typingSpeed: "20ms", endPause: "300ms", cursor: { blink: false },
}, async (t) => {
  await t.caption("Classic captions. Clear and readable.", { style: "classic", duration: "3s" });
  await t.run('printf "01  CLASSIC\\nA familiar subtitle with a dark background.\\n"');
  await t.sleep("2s");

  await t.clear();
  await t.caption("Make every word stand out", { style: "tiktok", duration: "3s" });
  await t.run('printf "02  TIKTOK\\nBold type. One highlighted word at a time.\\n"');
  await t.sleep("2s");

  await t.clear();
  await t.caption("Big moment? Make it POP.", { style: "pop", duration: "2s" });
  await t.run('printf "03  POP\\nA punchy entrance for your big moments.\\n"');
  await t.sleep("800ms");
  await t.caption("Your colors. Your emphasis.", { style: "pop", color: "#ff91cf", duration: "1.6s" });
  await t.sleep("1.7s");

  await t.clear();
  await t.caption("Minimal. Just the words you need.", { style: "minimal" });
  await t.run('printf "04  MINIMAL\\nQuiet typography. No background box.\\n"');
  await t.sleep("2s");
  await t.caption(null);
  await t.sleep("300ms");
});
