import type { CaptionPresentation } from "../captions";

export const CAPTION_CSS = `
.tcut-caption { position:absolute; left:5%; right:5%; bottom:16px; z-index:7; pointer-events:none; text-align:center; display:flex; justify-content:center; }
.tcut-caption[hidden] { display:none; }
.tcut-caption > span { display:inline-block; max-width:100%; box-sizing:border-box; border-radius:9px; padding:.2em .5em; font-family:Arial,Helvetica,sans-serif; line-height:1.25; white-space:pre-wrap; overflow-wrap:anywhere; text-shadow:0 2px 5px #000a; }
`;

/** Use text nodes, never HTML: captions may contain shell snippets or markup. */
export function paintCaption(el: HTMLElement, caption: CaptionPresentation | null): void {
  el.hidden = caption === null;
  if (!caption) return;
  el.style.top = caption.position === "top" ? `calc(var(--caption-top-inset, 0px) + ${caption.offset}px)` : "auto";
  el.style.bottom = caption.position === "bottom" ? `${caption.offset}px` : "auto";
  const box = document.createElement("span");
  Object.assign(box.style, {
    fontSize: `${caption.fontSize}px`, fontWeight: String(caption.weight), color: caption.color,
    background: caption.background, transform: `scale(${caption.scale})`,
    webkitTextStroke: `${caption.outline}px #111`, paintOrder: "stroke fill",
  });
  let word = 0;
  for (const text of caption.text.split(/(\s+)/)) {
    if (!text) continue;
    const part = document.createElement("span");
    part.textContent = text;
    if (text.trim() && word++ === caption.activeWord) part.style.color = caption.highlightColor;
    box.append(part);
  }
  el.replaceChildren(box);
}
