/**
 * Tweet-ready demo: Kitty Graphics in tcut
 * Shows inline terminal images rendered with the Ghostty core.
 */
import { defineVideo } from "tcut";

// A colorful 32x32 gradient square PNG (looks good at small size)
const GRADIENT_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAB2klEQVRYR+2XsU7DMBCG" +
  "/zOhsLAgMTAwsLCwMLCwsDAwILGwsDCwsLAwMLCwsLCwsLCwsCAhMbCwsLCwsLCwsDAg" +
  "sbCwsLCwsLCwMLCwsLCwsLCwILGwsLCwsLCwsLAwILGwsLCwsLCwsDAwsLCwsLCwsCCx" +
  "sLCwsLCwsLAwMLCwsLCwsLAgsb//AAAAAElFTkSuQmCC";

// A nice tcut logo-style icon (16x16 cyan square)
const ICON_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAPklEQVQ4y2Ng+M/A8J+B" +
  "gYGBgYmBgQEKGBgYGP4zMDAw/P/PwECcAf8ZGBj+MzAwMDD8Z2BgYPjPQKIXAACqwQkB" +
  "u8HbCAAAAABJRU5ErkJggg==";

// A red heart icon (16x16)  
const HEART_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAASklEQVQ4y2NgGAWjYDgD" +
  "RgYGBgYmBob/DAz/GRj+MzD8Z2D4z8DAwPCfgeE/AwMDA8N/Bob/DAwMDP8ZGP4zMDAw" +
  "/Gdg+M8wCkYBAACoQQkBYd8I1AAAAABJRU5ErkJggg==";

const ESC = "\x1b";

export default defineVideo(
  {
    output: ["/opt/cursor/artifacts/kitty-demo.mp4", "/opt/cursor/artifacts/kitty-demo.gif"],
    theme: "catppuccin-mocha",
    preset: "x",  // 1280x720
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
    await t.print("## 🎬 tcut now supports Kitty graphics!");
    await t.sleep("1.2s");

    // Show inline image
    await t.type("# Display an inline image in the terminal");
    await t.enter();
    await t.wait();
    await t.sleep("400ms");

    // Send Kitty graphics - first image
    await t.raw(`${ESC}_Ga=T,f=100;${GRADIENT_PNG}${ESC}\\`);
    await t.sleep("300ms");
    await t.raw("\r\n");
    await t.sleep("800ms");

    // Second image with text
    await t.type("echo '✨ Images render inline!'");
    await t.enter();
    await t.wait();
    await t.sleep("600ms");

    // Send another image
    await t.raw(`${ESC}_Ga=T,f=100;${ICON_PNG}${ESC}\\`);
    await t.sleep("200ms");
    await t.raw(` `);
    await t.raw(`${ESC}_Ga=T,f=100;${HEART_PNG}${ESC}\\`);
    await t.sleep("200ms");
    await t.raw("\r\n");

    await t.sleep("1s");

    // Take snapshot
    await t.snapshot("/opt/cursor/artifacts/kitty-demo-snapshot.png");

    // Final message
    await t.type("echo 'Powered by wterm 0.4 + Ghostty core 🚀'");
    await t.enter();
    await t.wait();

    await t.sleep("1.5s");
  },
);
