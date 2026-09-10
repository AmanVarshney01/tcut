import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { MARKER } from "../src/cast";
import { resolveConfig } from "../src/config";
import { buildHtml } from "../src/export/html";
import { buildSvg } from "../src/export/svg";
import { record } from "../src/recorder";
import { SLIDE_END, slidesOnTimeline } from "../src/slides";
import { buildTimeline } from "../src/timeline";

const dir = "/tmp/tcut-slides-test";

const slideMarkers = (rec: { events: Array<[number, string, string]> }) =>
  rec.events.filter((e) => e[1] === "m" && e[2].startsWith(MARKER.slide) && e[2] !== SLIDE_END).map((e) => JSON.parse(e[2].slice(MARKER.slide.length)));

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
    expect(rec.events.filter((e) => e[1] === "m" && e[2] === SLIDE_END)).toHaveLength(2);
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

  test("setup behind the card is typed instantly", async () => {
    await mkdir(dir, { recursive: true });
    const rec = await record(resolveConfig({ output: `${dir}/w.mp4`, endPause: 0, typingSpeed: "40ms", cols: 80, rows: 12 }), async (t) => {
      await t.slide("Setup", {
        duration: "300ms",
        fade: "50ms",
        during: async () => {
          await t.run("echo this-command-would-take-two-seconds-to-type-at-forty-ms-per-key"); // 70 keys
        },
      });
    });
    const card = slideMarkers(rec)[0]!;
    expect(card.duration).toBeLessThan(1500); // not 300 ms + 2.8 s of invisible typing
  }, 60_000);

  test("clear behind a card on an already-empty screen still completes", async () => {
    await mkdir(dir, { recursive: true });
    // Regression: instant typing outran the echo, so `clear` on a bare prompt looked like nothing happened.
    const rec = await record(resolveConfig({ output: `${dir}/v.mp4`, endPause: 0, typingSpeed: 0, cols: 60, rows: 12, waitTimeout: "6s" }), async (t) => {
      await t.hide(async () => { await t.clear(); });
      await t.slide("Two", { duration: "300ms", fade: "50ms", during: async () => { await t.run("clear"); } });
      await t.run("echo ok");
      await t.expect(/ok/);
    });
    expect(rec.events.some((e) => e[1] === "m" && e[2].startsWith("slide:{"))).toBe(true);
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

describe("slides on the timeline", () => {
  const card = JSON.stringify({ heading: "Go", duration: 2000, fade: 400 });
  const events = [
    [0, "o", "a"],
    [1, "m", `slide:${card}`],
    [3, "m", SLIDE_END],
    [3.5, "o", "b"],
    [10, "o", "c"],
  ] as const;

  test("the end marker follows playback speed", () => {
    const cards = slidesOnTimeline(buildTimeline([...events] as never, 2).events);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.start).toBeCloseTo(0.5, 5);
    expect(cards[0]!.end).toBeCloseTo(1.5, 5);
    expect(cards[0]!.fade).toBeCloseTo(0.2, 5); // scaled with the hold
  });

  test("idle compression keeps the hold and still trims the silence around it", () => {
    const tl = buildTimeline([...events] as never, 1, { maxPause: 0.5 });
    const cards = slidesOnTimeline(tl.events);
    expect(cards[0]!.end - cards[0]!.start).toBeCloseTo(2, 5); // the 2 s hold survives
    expect(tl.duration).toBeLessThan(5); // the 6.5 s of silence after it does not
  });

  test("recordings without an end marker fall back to the requested duration", () => {
    const cards = slidesOnTimeline([{ vt: 4, type: "m", data: `slide:${card}` }]);
    expect(cards[0]).toMatchObject({ start: 4, end: 6, fade: 0.4 });
  });
});
