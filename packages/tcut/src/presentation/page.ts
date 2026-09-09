import type { PresentationManifest } from "./model";

export function presentationPage(manifest: PresentationManifest, prefix: string, audience: boolean): string {
  const data = JSON.stringify({ manifest, prefix, audience }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>tcut — Present</title><link rel="icon" href="data:,">
<style>
:root{color-scheme:dark;--bg:#0a0a0a;--surface:#111;--raised:#171717;--line:#222;--line-2:#2c2c2c;--fg:#f2f2f2;--fg-2:#9b9b9b;--fg-3:#666;--rec:#e5484d;--radius:3px;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;line-height:1.45;color:var(--fg);background:var(--bg);-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}body{margin:0}button,input,textarea,select{font:inherit;color:inherit}[hidden]{display:none!important}
button{height:30px;padding:0 12px;border:1px solid transparent;border-radius:var(--radius);background:transparent;color:var(--fg-2);cursor:pointer;display:inline-flex;gap:6px;align-items:center;justify-content:center;white-space:nowrap;transition:background-color .12s,color .12s,border-color .12s}
button:hover{background:var(--raised);color:var(--fg)}button:disabled{opacity:.4;cursor:default;background:transparent}
button.primary{background:var(--fg);border-color:var(--fg);color:var(--bg);font-weight:500}button.primary:hover{background:#fff;border-color:#fff;color:var(--bg)}button.primary:disabled{background:var(--fg);color:var(--bg)}
button.recording,button.recording:hover{background:transparent;border-color:var(--rec);color:var(--rec)}
button[aria-pressed=true]{color:var(--fg);background:var(--raised)}
input,select,textarea{background:var(--surface);color:var(--fg);border:1px solid var(--line-2);border-radius:var(--radius);padding:6px 8px;min-width:0}
select{height:30px;padding:0 8px;background:transparent;border-color:transparent;color:var(--fg-2)}select:hover{color:var(--fg);background:var(--raised)}
input[type=checkbox]{accent-color:var(--fg);width:14px;height:14px}input[type=range]{-webkit-appearance:none;appearance:none;height:16px;padding:0;border:0;background:transparent;cursor:pointer}input[type=range]::-webkit-slider-runnable-track{height:2px;background:var(--line-2)}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;margin-top:-4px;border-radius:50%;background:var(--fg);border:0}input[type=range]:focus-visible{outline:none}input[type=range]:focus-visible::-webkit-slider-thumb{outline:1px solid var(--fg);outline-offset:2px}
a{color:var(--fg);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--line-2)}a:hover{text-decoration-color:var(--fg)}
:is(button,a,input,textarea,select,summary):focus-visible{outline:1px solid var(--fg);outline-offset:2px}
.eyebrow,.label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-3);margin:0}
.muted{color:var(--fg-2)}.mono,.brand,.take-clock,.scrub span,.stage-status,.step-button span{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-variant-numeric:tabular-nums}

header{height:48px;border-bottom:1px solid var(--line);padding:0 20px;display:flex;gap:14px;align-items:center}
.brand{font-size:13px;font-weight:600;letter-spacing:-.01em;color:var(--fg)}.brand span{display:none}
.file{color:var(--fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:36%}.file::before{content:"/";margin-right:10px;color:var(--line-2)}
.header-actions{margin-left:auto;display:flex;gap:2px;align-items:center}.header-actions .primary{margin-left:10px}
details{position:relative}summary{list-style:none;cursor:pointer;height:30px;padding:0 12px;display:inline-flex;align-items:center;color:var(--fg-2);border-radius:var(--radius)}summary::-webkit-details-marker{display:none}summary:hover,details[open]>summary{background:var(--raised);color:var(--fg)}
.menu{position:absolute;right:0;top:calc(100% + 6px);min-width:240px;z-index:20;display:grid;gap:2px;padding:6px;background:var(--surface);border:1px solid var(--line-2);border-radius:4px;box-shadow:0 8px 24px #0009}
.menu button{justify-content:flex-start;width:100%}.menu label{display:flex;gap:8px;align-items:center;height:30px;padding:0 10px;color:var(--fg-2)}.menu label[for]{color:var(--fg-3);font-size:11px;letter-spacing:.06em;text-transform:uppercase;height:auto;padding:8px 10px 2px}.menu input[type=text]{margin:0 4px 4px;width:calc(100% - 8px)}

.workspace{padding:0 20px}.stage-column{min-width:0}
.stage-status{display:flex;gap:16px;align-items:center;height:36px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-3)}.stage-status #status{margin-left:auto;text-transform:none;letter-spacing:0}
.stage{position:relative;aspect-ratio:${manifest.width}/${manifest.height};max-height:calc(100dvh - 300px);min-height:220px;background:#000;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;margin:auto;overflow:hidden}
.stage video{width:100%;height:100%;object-fit:contain;display:block}.stage .loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000c;color:var(--fg-2);font-size:12px}
.scrub{display:flex;gap:12px;align-items:center;height:36px;font-size:11px;color:var(--fg-3)}.scrub input{width:100%}
.transport{display:flex;gap:2px;align-items:center;justify-content:center;height:44px;border-top:1px solid var(--line)}.transport .grow{display:none}.transport label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg-3);margin-left:12px}.transport .primary{margin-left:10px}
.keyboard{font-size:11px;color:var(--fg-3);text-align:center;margin:0 0 6px;font-family:ui-monospace,"SF Mono",Menlo,monospace}

.steps{display:flex;gap:2px;margin:0;padding:6px 0;border-top:1px solid var(--line);overflow-x:auto}
.step-button{height:32px;padding:0 10px;color:var(--fg-3);flex:none}.step-button:hover{color:var(--fg)}.step-button[aria-current=step]{color:var(--fg);background:var(--raised)}.step-button span{font-size:12px;white-space:nowrap}

.sidebar{border-top:1px solid var(--line);padding:20px 0;display:grid;grid-template-columns:220px minmax(0,1fr);gap:8px 32px}
h1{font-size:15px;font-weight:500;margin:0;grid-column:1;letter-spacing:-.01em}.sidebar label{grid-column:2;grid-row:1}
.sidebar textarea{grid-column:2;grid-row:2 / span 2;resize:vertical;width:100%;min-height:120px;line-height:1.7;padding:10px 12px;color:var(--fg)}.sidebar textarea::placeholder{color:var(--fg-3)}
.notes-state{font-size:11px;color:var(--fg-3);grid-column:2;min-height:16px}.upnext{display:none}
.take-clock{color:var(--fg)}

.takes{padding:0 20px 20px}.takes-head{display:flex;align-items:baseline;gap:12px;border-top:1px solid var(--line);padding-top:20px}.takes h2{font-size:15px;font-weight:500;margin:0;letter-spacing:-.01em}
.take-list{display:grid;margin-top:8px}.take-row{display:flex;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--line);padding:12px 0}.take-info{flex:1;min-width:160px}.take-info strong{font-weight:500;display:block}.take-info small{color:var(--fg-3);display:block;margin-top:2px;font-size:11px}
.take-actions{display:flex;gap:2px;align-items:center}.take-actions a{font-size:12px;margin-left:8px}.export-status{font-size:11px;flex-basis:100%;color:var(--fg-3)}.take-empty{color:var(--fg-3);margin:12px 0 0;font-size:12px}
.error{background:#1a0f10;color:#f0b0b3;border:1px solid #3a1d1f;padding:10px 14px;margin:12px 20px;border-radius:var(--radius);white-space:pre-wrap;font-size:12px}
.foot{padding:12px 20px;border-top:1px solid var(--line);color:var(--fg-3);font-size:11px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}

.focus .sidebar,.focus .steps,.focus .takes,.focus .keyboard,.focus .foot,.focus .stage-status{display:none}.focus .stage{max-height:calc(100dvh - 180px)}
.audience header,.audience .sidebar,.audience .steps,.audience .transport,.audience .scrub,.audience .keyboard,.audience .takes,.audience .foot,.audience .stage-status{display:none}
.audience .workspace{padding:0}.audience .stage{height:100dvh;max-height:none;aspect-ratio:auto;border:0;background:#000}
.audience-tools{display:none;position:fixed;bottom:12px;right:12px;gap:4px;opacity:0;transition:opacity .15s}.audience .audience-tools{display:flex}.audience:hover .audience-tools,.audience .audience-tools:focus-within{opacity:1}.audience-tools button{background:#111;border-color:var(--line-2)}
.stage:fullscreen{border:0;background:#000;aspect-ratio:auto;max-height:none}.stage:fullscreen video{object-fit:contain}
.review{background:var(--surface);color:var(--fg);border:1px solid var(--line-2);border-radius:4px;width:min(1000px,94vw);padding:12px}.review::backdrop{background:#000b}.review header{height:auto;padding:0 0 12px;border:0}.review video{width:100%;max-height:70vh;background:#000}.review header button{margin-left:auto}

@media(max-width:850px){.workspace,.takes{padding-left:14px;padding-right:14px}header{padding:0 14px;height:auto;min-height:48px;flex-wrap:wrap;row-gap:4px;padding-block:8px}.header-actions{gap:0}.file{font-size:12px}.sidebar{grid-template-columns:1fr;gap:6px}.sidebar label,.sidebar textarea,.notes-state{grid-column:1;grid-row:auto}.stage{max-height:calc(100dvh - 270px)}.foot{padding:12px 14px}.error{margin:12px 14px}}
@media(max-width:540px){.header-actions{width:100%;justify-content:space-between}.header-actions .primary{margin-left:0}.file{max-width:70%}.transport{height:auto;padding:6px 0;flex-wrap:wrap}.transport label{display:none}.stage{min-height:190px}.take-actions{width:100%}.keyboard{display:none}.stage-status{height:auto;padding:8px 0;gap:8px;flex-wrap:wrap}.stage-status #status{margin-left:0}.menu{min-width:220px}}
</style></head><body${audience ? ' class="audience"' : ""}>
<header><div class="brand">tcut</div><div class="file" id="title"></div><div class="header-actions"><button id="toggle-notes" type="button" aria-pressed="false">Notes</button><button id="toggle-takes" type="button" aria-pressed="false">Takes</button><details><summary>View</summary><div class="menu"><button id="focus" type="button" aria-pressed="false">Audience preview</button><button id="audience" type="button">Open audience window</button><button id="fullscreen" type="button">Fullscreen</button></div></details><details id="take-options"><summary>Take options</summary><div class="menu"><label for="take-title">Take title</label><input id="take-title" type="text" value="Take 1" maxlength="200"><label><input id="microphone" type="checkbox">Microphone</label></div></details><button id="record" type="button" class="primary">● Start take</button></div></header>
<div id="error" class="error" role="alert" hidden></div>
<div class="workspace"><main class="stage-column">
<div class="stage-status"><span id="step-count"></span><span id="status" aria-live="polite">Loading recorded demo…</span><span id="take-clock" class="take-clock" aria-live="off" hidden></span></div>
<div class="stage" id="stage"><video id="video" preload="auto" playsinline muted></video><div class="loading" id="loading">Loading recorded step…</div></div>
<div class="scrub"><span id="position">0:00</span><input id="scrub" type="range" min="0" max="1000" value="0" aria-label="Seek within current step"><span id="length">0:00</span></div>
<div class="transport"><button type="button" id="back">Back</button><button type="button" id="replay">Replay</button><span class="grow"></span><label for="speed" class="muted">Speed</label><select id="speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select><button type="button" class="primary" id="advance">Play step</button></div>
<p class="keyboard">Space: play / pause / advance · ← →: change step · R: replay · F: fullscreen</p>
</main><nav id="steps" class="steps" aria-label="Presentation steps"></nav><aside class="sidebar" id="sidebar" hidden><p class="eyebrow">Only you can see this</p><h1 id="step-title"></h1><label for="notes" class="label">Speaker notes</label><textarea id="notes" spellcheck="true" placeholder="What do you want to say here?"></textarea><div id="notes-state" class="notes-state" aria-live="polite"></div><div class="upnext"><p class="eyebrow">Up next</p><p id="upnext"></p><small>Plays, then holds on the result.</small></div></aside></div>
<section class="takes" id="takes" hidden><div class="takes-head"><h2>Your takes</h2><span class="muted" id="take-count"></span></div><p id="take-empty" class="take-empty">Record your pacing, then review or export it here.</p><div id="take-list" class="take-list"></div></section>
<footer class="foot"><span id="source-status">Recorded source · ready to replay</span><span id="audience-status">Presenter view</span></footer>
<div class="audience-tools"><button id="audience-fullscreen" type="button">Fullscreen</button></div>
<dialog class="review" id="review"><header><span id="review-title">Review take</span><button id="close-review" type="button">Close</button></header><video id="review-video" controls playsinline></video></dialog>
<script type="application/json" id="presentation-data">${data}</script><script type="module" src="${prefix}app.js"></script>
</body></html>`;
}
