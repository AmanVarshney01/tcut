import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { findThemes, resolveTheme, themeNames, themeSlug, themes } from "../src/themes";
import { configPath, keyFor, loadPublishConfig, publicUrlFor, savePublishConfig, signV4, type PublishConfig } from "../src/publish";

describe("themes", () => {
  test("bundles the Ghostty collection plus built-ins", () => {
    expect(themeNames.length).toBeGreaterThan(500);
    expect(themes["catppuccin-mocha"]?.red).toBe("#f38ba8"); // built-in wins
    expect(themes["gruvbox-dark"]).toBeDefined();
    expect(themes["solarized-dark-higher-contrast"]).toBeDefined();
  });
  test("resolves names loosely", () => {
    expect(resolveTheme("Catppuccin Mocha").name).toBe("catppuccin-mocha");
    expect(resolveTheme("GITHUB_DARK").name).toBe("github-dark");
    expect(resolveTheme("Gruvbox Dark").background).toBe(themes["gruvbox-dark"]!.background);
    expect(themeSlug("Rosé Pine Moon")).toBe("ros-pine-moon");
  });
  test("unknown names suggest alternatives", () => {
    expect(() => resolveTheme("catpuccin mocha")).toThrow(/Unknown theme/);
    expect(findThemes("catppuccin").length).toBeGreaterThan(2);
  });
});

describe("publish", () => {
  const dir = "/tmp/tcut-publish-test";
  const cfg: PublishConfig = { endpoint: "https://s3.example.com", bucket: "tcut", accessKeyId: "AK", secretAccessKey: "SK" };
  afterEach(async () => {
    delete process.env.TCUT_CONFIG_DIR;
    delete process.env.TCUT_S3_BUCKET;
    await rm(dir, { recursive: true, force: true });
  });

  test("content-addressed keys and path-style public URLs", async () => {
    await mkdir(dir, { recursive: true });
    await Bun.write(`${dir}/a b.gif`, "same");
    await Bun.write(`${dir}/other.gif`, "same");
    const k1 = await keyFor(cfg, `${dir}/a b.gif`);
    const k2 = await keyFor(cfg, `${dir}/other.gif`);
    expect(k1.split("/")[0]).toBe(k2.split("/")[0]); // same bytes → same hash folder
    expect(k1).toMatch(/^[0-9a-f]{12}\/a b\.gif$/);
    expect(publicUrlFor(cfg, k1)).toBe(`https://s3.example.com/tcut/${k1.split("/")[0]}/a%20b.gif`);
    expect(publicUrlFor({ ...cfg, publicUrl: "https://cdn.example.com/" }, "x/y.mp4")).toBe("https://cdn.example.com/x/y.mp4");
  });

  test("config: file, env overrides, 0600 permissions", async () => {
    process.env.TCUT_CONFIG_DIR = dir;
    expect(await loadPublishConfig()).toBeNull();
    const file = await savePublishConfig(cfg);
    expect(file).toBe(configPath());
    if (process.platform !== "win32") {
      const mode = (await Bun.file(file).stat()).mode & 0o777;
      expect(mode).toBe(0o600);
    }
    expect((await loadPublishConfig())?.bucket).toBe("tcut");
    process.env.TCUT_S3_BUCKET = "override";
    expect((await loadPublishConfig())?.bucket).toBe("override");
  });

  test("SigV4 produces a well-formed Authorization header and is deterministic", () => {
    const when = new Date("2026-08-21T00:00:00Z");
    const url = new URL("https://s3.example.com/tcut?policy=");
    const a = signV4(cfg, "PUT", url, "{}", when);
    const b = signV4(cfg, "PUT", url, "{}", when);
    expect(a).toEqual(b);
    expect(a["x-amz-date"]).toBe("20260821T000000Z");
    expect(a.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AK\/20260821\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    expect(signV4(cfg, "PUT", url, "{\"x\":1}", when).authorization).not.toBe(a.authorization);
  });
});
