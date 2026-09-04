// `tcut doctor`: replay a cast through the emulator and report what the program used — and what tcut cannot show.
import { MARKER, readCast } from "./cast";
import { unsupportedProtocols, extractTitles, countKittyGraphics, type UnsupportedProtocol } from "./osc";
import { loadCore } from "./screen";
import type { CoreName, Recording } from "./types";

export interface UnhandledSequenceSummary {
  /** Final byte of the CSI/ESC sequence, e.g. "h". */
  final: string;
  count: number;
}

export interface DoctorReport {
  cast: string;
  cols: number;
  rows: number;
  durationSeconds: number;
  events: number;
  outputBytes: number;
  /** Terminal features the program used. */
  features: {
    altScreen: boolean;
    mouseTracking: boolean;
    bracketedPaste: boolean;
    appCursorKeys: boolean;
    synchronizedOutput: boolean;
    hyperlinks: number;
    scrollbackLines: number;
    titles: string[];
    /** Kitty graphics APCs detected (rendered with Ghostty core, unsupported with lite core). */
    kittyGraphics: number;
  };
  /** The emulator core: "ghostty" (default, supports Kitty graphics) or "lite". */
  core: CoreName;
  markers: { chapters: number; zoom: number; hidden: number; screenshots: number; browserFrames: number };
  /** Things tcut cannot render faithfully. */
  unsupported: UnsupportedProtocol[];
  /** Escape sequences the lightweight core did not understand (the Ghostty core handles more but does not report). */
  unhandled: UnhandledSequenceSummary[];
  warnings: string[];
}

function unhandledSummary(seqs: Array<{ final: string }>): UnhandledSequenceSummary[] {
  const counts = new Map<string, number>();
  for (const s of seqs) counts.set(s.final, (counts.get(s.final) ?? 0) + 1);
  return [...counts.entries()].map(([final, count]) => ({ final, count })).sort((a, b) => b.count - a.count);
}

export async function diagnoseRecording(rec: Recording, castPath = rec.source ?? "(memory)"): Promise<DoctorReport> {
  const output = rec.events.filter((e) => e[1] === "o").map((e) => e[2]);
  const outputText = output.join("");
  // "Ever used" must not depend on state sampling: a mode entered and left inside one chunk still counts.
  const requested = (code: string): boolean => outputText.includes(`\x1b[?${code}h`);
  const links = new Set<string>();
  const titles: string[] = [];
  let altScreen = false;
  let mouse = false;
  let paste = false;
  let appCursor = false;
  let sync = false;

  // Ghostty (the default renderer core) for feature detection, sampled after every output chunk.
  const core = await loadCore("ghostty");
  core.init(rec.header.width, rec.header.height);
  for (const [, type, data] of rec.events) {
    if (type === "r") {
      const [c, r] = data.split("x").map(Number);
      if (c! > 0 && r! > 0) core.resize(c!, r!);
      continue;
    }
    if (type !== "o") continue;
    core.writeString(data);
    for (const t of extractTitles(data)) if (titles[titles.length - 1] !== t) titles.push(t);
    altScreen ||= core.usingAltScreen() || requested("1049") || requested("47");
    mouse ||= (core.mouseTracking?.() ?? 0) !== 0 || requested("1000") || requested("1002") || requested("1003");
    paste ||= core.bracketedPaste() || requested("2004");
    appCursor ||= core.cursorKeysApp() || requested("1");
    sync ||= (core.synchronizedOutput?.() ?? false) || requested("2026");
    for (let y = 0; y < core.getRows(); y++) {
      for (let x = 0; x < core.getCols(); x++) {
        const uri = core.getCell(y, x).linkUri;
        if (uri) links.add(uri);
      }
    }
  }
  // The lightweight core reports sequences it does not implement.
  const lite = await loadCore("lite");
  lite.init(rec.header.width, rec.header.height);
  for (const chunk of output) lite.writeString(chunk);
  const unhandled = unhandledSummary(lite.getUnhandledSequences());

  const markers = {
    chapters: rec.events.filter((e) => e[1] === "m" && e[2].startsWith(MARKER.chapter)).length,
    zoom: rec.events.filter((e) => e[1] === "m" && e[2].startsWith(MARKER.zoom)).length,
    hidden: rec.events.filter((e) => e[1] === "m" && e[2] === MARKER.hide).length,
    screenshots: rec.events.filter((e) => e[1] === "m" && e[2].startsWith(MARKER.screenshot)).length,
    browserFrames: rec.events.filter((e) => e[1] === "b").length,
  };
  // Detect Kitty graphics usage
  const kittyGraphicsCount = countKittyGraphics(outputText);
  // Determine the core from the recording's config (default: ghostty)
  const configuredCore: CoreName = rec.header.bunVideo?.core ?? "ghostty";
  // Unsupported protocols depend on the core (Kitty graphics is supported with Ghostty)
  const unsupported = unsupportedProtocols(outputText, configuredCore);
  const warnings: string[] = [];
  if (altScreen && rec.events.some((e) => e[1] === "o" && e[2].includes("\x1b[?1049l"))) {
    warnings.push("A full-screen program exited; text it left on the primary screen is normal — use t.hide(() => t.clear()) to tidy the video");
  }
  if (mouse) warnings.push("The program enabled mouse tracking: t.scrollUp()/scrollDown() work here");
  if (!rec.header.bunVideo) warnings.push("No tcut config in the header (foreign asciicast): rendering uses defaults unless you pass --theme/--cols/--rows");

  const duration = rec.header.duration ?? (rec.events.length ? rec.events[rec.events.length - 1]![0] : 0);
  return {
    cast: castPath,
    cols: rec.header.width,
    rows: rec.header.height,
    durationSeconds: Number(duration.toFixed(3)),
    events: rec.events.length,
    outputBytes: new TextEncoder().encode(outputText).length,
    features: {
      altScreen,
      mouseTracking: mouse,
      bracketedPaste: paste,
      appCursorKeys: appCursor,
      synchronizedOutput: sync,
      hyperlinks: links.size,
      scrollbackLines: core.getScrollbackCount(),
      titles,
      kittyGraphics: kittyGraphicsCount,
    },
    core: configuredCore,
    markers,
    unsupported,
    unhandled,
    warnings,
  };
}

export async function diagnoseCast(file: string): Promise<DoctorReport> {
  const rec = await readCast(file);
  return diagnoseRecording(rec, file);
}

/** Human-readable report lines. */
export function formatDoctorReport(r: DoctorReport): string[] {
  const yes = (b: boolean) => (b ? "yes" : "no");
  const lines = [
    `${r.cast}: ${r.cols}×${r.rows}, ${r.durationSeconds.toFixed(1)}s, ${r.events} events, ${(r.outputBytes / 1024).toFixed(1)} KB of output`,
    `features: alt screen ${yes(r.features.altScreen)} · mouse ${yes(r.features.mouseTracking)} · bracketed paste ${yes(r.features.bracketedPaste)} · app cursor keys ${yes(r.features.appCursorKeys)} · synchronized output ${yes(r.features.synchronizedOutput)} · ${r.features.hyperlinks} hyperlink(s) · ${r.features.scrollbackLines} scrollback line(s)`,
  ];
  if (r.features.kittyGraphics > 0) {
    const supported = r.core === "ghostty";
    lines.push(`kitty graphics: ${r.features.kittyGraphics} image(s)${supported ? " (rendered with Ghostty core)" : " — requires core: \"ghostty\" to render"}`);
  }
  if (r.features.titles.length) lines.push(`titles: ${r.features.titles.map((t) => JSON.stringify(t)).join(" → ")}`);
  const m = r.markers;
  if (m.chapters || m.zoom || m.hidden || m.screenshots || m.browserFrames) {
    lines.push(`markers: ${m.chapters} chapter(s) · ${m.zoom} zoom · ${m.hidden} hidden section(s) · ${m.screenshots} screenshot(s) · ${m.browserFrames} browser frame(s)`);
  }
  for (const u of r.unsupported) lines.push(`unsupported: ${u.name} ×${u.count} — ${u.note}`);
  if (r.unhandled.length) lines.push(`unhandled by the lite core: ${r.unhandled.map((u) => `${JSON.stringify(u.final)} ×${u.count}`).join(", ")} (use core: "ghostty", the default, for these)`);
  for (const w of r.warnings) lines.push(`note: ${w}`);
  if (!r.unsupported.length && !r.unhandled.length) lines.push("ok: nothing in this recording that tcut cannot show");
  return lines;
}
