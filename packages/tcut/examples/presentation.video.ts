import { defineVideo } from "termcut";

// Prepare and open: bun packages/tcut/src/cli.ts present packages/tcut/examples/presentation.video.ts --open
// Subsequent walkthroughs reuse the recording and prepared clips. --force explicitly records the script again.
export default defineVideo({
  output: "out/presentation-demo.mp4", width: 960, height: 600, cols: 70, rows: 18,
  fps: 30, font: { family: "JetBrains Mono", size: 18, lineHeight: 1.3 },
  theme: "catppuccin-mocha", windowBar: "colorful", title: "tcut / presentation mode",
  margin: 32, padding: 24, borderRadius: 16, cursor: { blink: false },
  typingSpeed: 0, endPause: 0,
}, async (t) => {
  await t.step("Set the scene", async () => {
    await t.slide("A demo at your pace", { subtitle: "Record once. Walk it through naturally.", duration: "1.2s", fade: 0, chapter: false });
  }, { notes: "Introduce the idea. Nothing runs during this presentation — we are playing a recording. Hold here as long as you need." });

  await t.step("Run real code", async () => {
    await t.caption("Real code. A repeatable demo.", { style: "tiktok", duration: "2s" });
    await t.run("bun -e 'console.log([1, 2, 3].map(n => n * 2))'");
    await t.expect(/2, 4, 6/);
    await t.sleep("2s");
  }, { notes: "The command ran once when we prepared the source. Explain the output. Replay this step or go back if someone has a question." });

  await t.step("Show the result", async () => {
    await t.caption("All done. Take your time.", { style: "pop" });
    await t.run("printf '✓ source captured\\n✓ captions included\\n✓ ready to present\\n'");
    await t.sleep("1.8s");
  }, { notes: "Captions are baked into the saved visuals. The presenter controls how long this result stays on screen. Try recording a take now." });

  await t.step("Wrap up", async () => {
    await t.caption(null);
    await t.slide("One source. Your delivery.", { subtitle: "Another take never reruns the commands.", duration: "1.2s", fade: 0, chapter: false });
  }, { notes: "Finish the explanation, then stop your take. Review it or export MP4, WebM or GIF from the take list." });
});
