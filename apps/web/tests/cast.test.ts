import { expect, test } from "bun:test";
import { parseCast } from "../src/lib/cast";

test("site playback includes speed, hidden setup, idle compression and the final hold", () => {
  const cast = parseCast([
    { version: 2, width: 80, height: 24, bunVideo: { playbackSpeed: 2, maxPause: 1 } },
    [0, "o", "first"], [2, "m", "hide"], [3, "o", "setup"], [4, "m", "show"],
    [4, "m", "speed:2"], [8, "m", "chapter:Next"], [8, "o", "second"], [12, "m", "end"],
  ].map((line) => JSON.stringify(line)).join("\n"));
  expect(cast.events.map((e) => e.t)).toEqual([0, 1, 2]);
  expect(cast.chapters).toEqual([{ title: "Next", t: 2 }]);
  expect(cast.duration).toBe(3);
});
