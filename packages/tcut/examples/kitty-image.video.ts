/**
 * Demo: Kitty graphics protocol (inline images)
 *
 * This example demonstrates tcut's support for Kitty terminal images with the Ghostty core.
 * It sends a tiny inline image using the Kitty graphics protocol and takes a snapshot.
 *
 * The image is a 32x32 gradient PNG, generated inline (no external binary needed).
 * This works in terminals that support Kitty graphics (Ghostty, kitty, WezTerm, etc.).
 */
import { defineVideo } from "tcut";

import { encodePng } from "../src/renderer/png";

const pixels = new Uint8Array(32 * 32 * 4);
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) pixels.set([x * 8, y * 8, 180, 255], (y * 32 + x) * 4);
}
const GRADIENT_PNG_BASE64 = Buffer.from(encodePng({ width: 32, height: 32, data: pixels })).toString("base64");

export default defineVideo(
  {
    output: ["out/kitty-image.mp4", "out/kitty-image.gif"],
    theme: "catppuccin-mocha",
    cols: 60,
    rows: 16,
    typingSpeed: "35ms",
    typingJitter: 0.3,
    windowBar: "colorful",
    title: "Kitty Graphics Demo",
    padding: 20,
    margin: 32,
    borderRadius: 12,
    marginFill: "#11111b",
    fps: 30,
  },
  async (t) => {
    await t.run("echo '🖼️  Kitty Graphics Protocol Demo'");
    await t.sleep("800ms");

    await t.type("# Display an inline image using the Kitty graphics protocol");
    await t.enter();
    await t.wait();
    await t.sleep("500ms");

    // Send a Kitty graphics image using the protocol:
    // ESC _G a=T,f=100,... ; <base64 data> ESC \
    // a=T: transmit and display
    // f=100: format is PNG
    // The image appears inline at the cursor position.

    await t.type("# Sending image via Kitty graphics protocol...");
    await t.enter();
    await t.wait();
    await t.sleep("300ms");

    // Send the Kitty graphics escape sequence with the PNG
    // Format: ESC _G <parameters>; <base64 payload> ESC \
    // Print from the shell: raw() sends input to the program, it does not produce terminal output.
    await t.run(`printf '\\033_Ga=T,f=100,q=2;${GRADIENT_PNG_BASE64}\\033\\\\'`);

    await t.sleep("500ms");

    // Move to next line after the image
    await t.type("echo ''");
    await t.enter();
    await t.wait();

    await t.type("echo '✅ Image displayed inline!'");
    await t.enter();
    await t.wait();

    // Take a snapshot showing the inline image
    await t.snapshot("out/kitty-image-snapshot.png");

    await t.sleep("1.5s");

    // Show that tcut doctor recognizes Kitty graphics
    await t.type("# tcut doctor will report Kitty graphics as a feature");
    await t.enter();
    await t.wait();

    await t.sleep("2s");
  },
);
