import { defineVideo } from "tcut";

export default defineVideo(
  {
    output: ["out/demo.mp4", "out/demo.gif"],
    theme: "catppuccin-mocha",
    cols: 80,
    rows: 20,
    typingSpeed: "40ms",
    typingJitter: 0.4,
    windowBar: "colorful",
    title: "tcut",
    padding: 20,
    margin: 32,
    borderRadius: 12,
    marginFill: "#11111b",
  },
  async (t) => {
    // Setup that should not appear in the video.
    await t.hide(async () => {
      await t.run("cd /tmp && rm -rf bun-video-demo && mkdir bun-video-demo && cd bun-video-demo");
      await t.run("printf 'hello\\nworld\\n' > notes.txt");
      await t.clear();
    });

    await t.run("echo 'Hello from tcut 👋'");
    await t.sleep("800ms");

    await t.run("ls -la --color=always 2>/dev/null || ls -la");
    await t.expect(/notes\.txt/);
    await t.sleep("1s");

    await t.type("cat notes.txt");
    await t.sleep("400ms");
    await t.enter();
    await t.wait();
    await t.screenshot("out/notes.png");
    await t.sleep("1s");

    await t.run("bun --version");
    await t.sleep("2s");
  },
);
