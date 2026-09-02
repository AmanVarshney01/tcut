/**
 * Demo: Kitty graphics protocol (inline images)
 *
 * This example demonstrates tcut's support for Kitty terminal images with the Ghostty core.
 * It sends a tiny inline image using the Kitty graphics protocol and takes a snapshot.
 *
 * The image is a 16x16 red square PNG, generated inline (no external binary needed).
 * This works in terminals that support Kitty graphics (Ghostty, kitty, WezTerm, etc.).
 */
import { defineVideo } from "tcut";

// A minimal 16x16 red square PNG (79 bytes), base64 encoded
// This is the smallest valid PNG that displays a visible colored square.
const TINY_RED_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAADklEQVQoz2P4z8DAwMAAAAQJAQA1MAwzAAAAAElFTkSuQmCC";

// Alternative: A 32x32 gradient PNG for more visual interest
const GRADIENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAQklEQVRIx2P4z8DAQBJg" +
  "Ykglw6gBowYMZgOY/jMwMDAw/P/PwED0C1gY/v+HcP7/Z/hPmhd+M/z/z8BA4tsHowYA" +
  "AAf/BQHkHW3TAAAAAElFTkSuQmCC";

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
    const ESC = "\x1b";

    await t.type("# Sending image via Kitty graphics protocol...");
    await t.enter();
    await t.wait();
    await t.sleep("300ms");

    // Send the Kitty graphics escape sequence with the PNG
    // Format: ESC _G <parameters>; <base64 payload> ESC \
    const kittyGraphics = `${ESC}_Ga=T,f=100;${GRADIENT_PNG_BASE64}${ESC}\\`;
    await t.raw(kittyGraphics);

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
