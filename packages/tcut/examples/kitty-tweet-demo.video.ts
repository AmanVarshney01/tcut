/**
 * Tweet-ready demo: Kitty Graphics in tcut
 * Shows actual inline images rendered with the Ghostty core.
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
    // Setup: create scripts that output Kitty graphics (hidden from video)
    await t.hide(async () => {
      // Script 1: 48x48 colorful gradient
      await t.run(`cat > /tmp/kitty-gradient.ts << 'BUNSCRIPT'
import { encodePng } from "/workspace/packages/tcut/src/renderer/png";
const size = 48;
const px = new Uint8Array(size * size * 4);
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    px[i] = Math.floor((x/size)*255);
    px[i+1] = Math.floor((y/size)*255);
    px[i+2] = Math.floor(128 + Math.sin(x*0.2)*64);
    px[i+3] = 255;
  }
const b64 = Buffer.from(encodePng({data:px,width:size,height:size})).toString("base64");
process.stdout.write(String.fromCharCode(0x1b)+"_Ga=T,f=100;"+b64+String.fromCharCode(0x1b)+"\\\\\\n");
BUNSCRIPT`);

      // Script 2: 48x48 logo-style icon
      await t.run(`cat > /tmp/kitty-logo.ts << 'BUNSCRIPT'
import { encodePng } from "/workspace/packages/tcut/src/renderer/png";
const size = 48;
const px = new Uint8Array(size * size * 4);
const cx = size/2, cy = size/2, r = size/2 - 4;
for (let y = 0; y < size; y++)
  for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const d = Math.sqrt((x-cx)**2 + (y-cy)**2);
    if (d < r) {
      // Inside circle: purple-blue gradient
      px[i] = 100 + Math.floor((x/size)*100);
      px[i+1] = 50 + Math.floor((y/size)*100);
      px[i+2] = 200;
      px[i+3] = 255;
    } else {
      px[i] = px[i+1] = px[i+2] = px[i+3] = 0;
    }
  }
const b64 = Buffer.from(encodePng({data:px,width:size,height:size})).toString("base64");
process.stdout.write(String.fromCharCode(0x1b)+"_Ga=T,f=100;"+b64+String.fromCharCode(0x1b)+"\\\\");
BUNSCRIPT`);
      await t.clear();
    });

    // Opening
    await t.print("## 🎬 tcut now supports Kitty inline images!");
    await t.sleep("1.2s");

    await t.type("# Display images directly in your terminal demos");
    await t.enter();
    await t.wait();
    await t.sleep("500ms");

    // First image
    await t.type("bun /tmp/kitty-gradient.ts");
    await t.enter();
    await t.wait();
    await t.sleep("1s");

    await t.type("# Multiple images work too!");
    await t.enter();
    await t.wait();
    await t.sleep("400ms");

    // Second image
    await t.type("bun /tmp/kitty-logo.ts");
    await t.enter();
    await t.wait();
    await t.sleep("1s");

    // Take snapshot
    await t.snapshot("/opt/cursor/artifacts/kitty-demo-snapshot.png");

    await t.type("echo '✨ Powered by wterm 0.4 + Ghostty!'");
    await t.enter();
    await t.wait();

    await t.sleep("2s");
  },
);
