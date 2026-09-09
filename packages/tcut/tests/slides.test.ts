import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { MARKER } from "../src/cast";
import { resolveConfig } from "../src/config";
import { buildHtml } from "../src/export/html";
import { buildSvg } from "../src/export/svg";
import { record } from "../src/recorder";

const dir = "/tmp/tcut-slides-test";

const slideMarkers = (rec: { events: Array<[number, string, string]> }) =>
  rec.events.filter((e) => e[1] === "m" && e[2].startsWith(MARKER.slide)).map((e) => JSON.parse(e[2].slice(MARKER.slide.length)));

describe("t.slide", () => {
  test("records a card, a chapter, and holds the clock", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const rec = await record(resolveConfig({ output: `${dir}/x.mp4`, endPause: 0, typingSpeed: 0, cols: 60, rows: 12 }), async (t) => {
      await t.slide("Record", { eyebrow: "1", subtitle: "A real shell.", duration: "300ms", fade: "100ms" });
      await t.run("echo one");
      await t.slide("No chapter", { duration: "200ms", fade: "50ms", chapter: false });
    });
    const cards = slideMarkers(rec);
    expect(cards.map((c) => c.heading)).toEqual(["Record", "No chapter"]);
    expect(cards[0]).toMatchObject({ eyebrow: "1", subtitle: "A real shell.", fade: 100 });
    expect(cards[0]!.duration).toBeGreaterThanOrEqual(300);
    // The first card names a chapter; the opted-out one does not.
    const chapters = rec.events.filter((e) => e[1] === "m" && e[2].startsWith(MARKER.chapter)).map((e) => e[2].slice(MARKER.chapter.length));
    expect(chapters).toEqual(["Record"]);
  }, 60_000);

  test("during() runs behind the card and the card covers it", async () => {
    await mkdir(dir, { recursive: true });
    let ran = false;
    const rec = await record(resolveConfig({ output: `${dir}/y.mp4`, endPause: 0, typingSpeed: 0, cols: 60, rows: 12 }), async (t) => {
      await t.slide("Setup", {
        duration: "200ms",
        fade: "50ms",
        during: async () => {
          ran = true;
          await t.run("sleep 0.6");
        },
      });
    });
    expect(ran).toBe(true);
    const card = slideMarkers(rec)[0]!;
    // The work took longer than the requested hold, so the card was stretched to cover all of it.
    expect(card.duration).toBeGreaterThan(600);
  }, 60_000);

  test("cards are drawn in svg and shipped to the html player", async () => {
    await mkdir(dir, { recursive: true });
    const config = resolveConfig({ output: `${dir}/z.svg`, endPause: 0, typingSpeed: 0, cols: 60, rows: 12 });
    const rec = await record(config, async (t) => {
      await t.slide("Deploy to the cloud", { eyebrow: "3", subtitle: "It converges the account.", duration: "400ms", fade: "100ms" });
      await t.run("echo done");
    });
    const svg = await buildSvg(rec, config);
    expect(svg.svg).toContain("Deploy to the cloud");
    expect(svg.svg).toContain("It converges the account.");
    const html = await buildHtml(rec, config);
    expect(html).toContain('"heading":"Deploy to the cloud"');
    expect(html).toContain('id="slide"');
  }, 60_000);
});
