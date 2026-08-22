// Fallback fonts are not monospace. A terminal clips every glyph into its cell; the DOM renderer lays a row
// out as text runs and trusts the font, so one symbol that the primary font lacks (a progress-bar block, a
// Nerd Font icon) renders a few pixels narrow or wide and shifts everything after it on that row — and when
// an animation swaps such glyphs, the rest of the row jitters. Pinning every non-ASCII narrow glyph to a
// 1ch box restores the grid. Wide cells are already their own `term-wide` boxes.

const ASCII_ONLY = /^[\x20-\x7e]*$/;
export const PIN_CLASS = "vt-pin";
export const PIN_CSS = `.${PIN_CLASS}{display:inline-block;width:calc(1ch + var(--vt-letter-spacing,0px));overflow:hidden;text-align:center;vertical-align:top}`;

const segmenter = "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** Grapheme clusters: a base character plus its combining marks / variation selectors stays one cell. */
function clusters(text: string): string[] {
  if (!segmenter) return [...text];
  const out: string[] = [];
  for (const s of segmenter.segment(text)) out.push(s.segment);
  return out;
}

/** Wrap non-ASCII glyphs in fixed-width boxes. Safe to call after every write: already-pinned runs are skipped. */
export function pinGlyphs(root: ParentNode): void {
  for (const span of root.querySelectorAll<HTMLElement>(".term-row span")) {
    if (span.dataset.pinned === "1" || span.classList.contains("term-wide") || span.classList.contains(PIN_CLASS)) continue;
    if (span.children.length > 0) continue; // only leaf runs hold text
    const text = span.textContent ?? "";
    if (ASCII_ONLY.test(text)) continue;
    const frag = document.createDocumentFragment();
    let ascii = "";
    const flush = () => {
      if (ascii) frag.append(ascii);
      ascii = "";
    };
    for (const c of clusters(text)) {
      if (ASCII_ONLY.test(c)) {
        ascii += c;
        continue;
      }
      flush();
      const pin = document.createElement("span");
      pin.className = PIN_CLASS;
      pin.textContent = c;
      frag.append(pin);
    }
    flush();
    span.replaceChildren(frag);
    span.dataset.pinned = "1";
  }
}
