/**
 * Tweet-ready demo: Kitty Graphics in tcut
 * Shows that tcut's Ghostty core now supports Kitty graphics protocol.
 */
import { defineVideo } from "tcut";

export default defineVideo(
  {
    output: ["/opt/cursor/artifacts/kitty-demo.mp4", "/opt/cursor/artifacts/kitty-demo.gif"],
    theme: "catppuccin-mocha",
    preset: "x", // 1280x720
    cols: 70,
    rows: 18,
    typingSpeed: "30ms",
    typingJitter: 0.25,
    windowBar: "colorful",
    title: "tcut — Kitty Graphics",
    padding: 24,
    margin: 40,
    borderRadius: 14,
    marginFill: "#11111b",
    shadow: true,
    fps: 30,
    endPause: "2s",
  },
  async (t) => {
    // Opening beat
    await t.print("## 🎬 New in tcut: Kitty graphics support!");
    await t.sleep("1.2s");

    await t.type("# wterm 0.4 brings inline image rendering");
    await t.enter();
    await t.wait();
    await t.sleep("500ms");

    await t.type("# via the Kitty graphics protocol 🖼️");
    await t.enter();
    await t.wait();
    await t.sleep("500ms");

    await t.type("echo ''");
    await t.enter();
    await t.wait();

    // Show what Kitty graphics can do
    await t.type("# Display images inline with: kitten icat image.png");
    await t.enter();
    await t.wait();
    await t.sleep("400ms");

    await t.type("# Or programmatically via the Kitty APC escape sequence");
    await t.enter();
    await t.wait();
    await t.sleep("500ms");

    // Take snapshot
    await t.snapshot("/opt/cursor/artifacts/kitty-demo-snapshot.png");

    await t.type("echo ''");
    await t.enter();
    await t.wait();

    // Show the command that would display an image
    await t.type("echo '✨ tcut doctor now reports Kitty graphics as a feature!'");
    await t.enter();
    await t.wait();
    await t.sleep("600ms");

    // Final message
    await t.type("echo 'Powered by @wterm/ghostty 0.4 🚀'");
    await t.enter();
    await t.wait();

    await t.sleep("1.5s");
  },
);
