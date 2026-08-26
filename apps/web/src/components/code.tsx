import { type AnnotationHandler, getPreRef, type HighlightedCode, type InlineAnnotation, InnerLine, InnerPre, Pre } from "codehike/code";
import { useLayoutEffect, useRef } from "react";

/** `// !mark` — a line or token the text is talking about. */
export const mark: AnnotationHandler = {
  name: "mark",
  Line: ({ annotation, ...props }) => (
    <div className={annotation ? "flex border-l-2 border-amber bg-amber/10" : "flex border-l-2 border-transparent"}>
      <InnerLine merge={props} className="flex-1 px-3" />
    </div>
  ),
  Inline: ({ children }) => <span className="-mx-0.5 rounded bg-amber/20 px-0.5 outline outline-1 outline-amber/40">{children}</span>,
};

/** Keeps the focused lines in view when the block scrolls (walkthrough steps can be longer than the pane). */
const PreWithFocus: AnnotationHandler["PreWithRef"] = (props) => {
  const ref = getPreRef(props);
  const first = useRef(true);
  useLayoutEffect(() => {
    const pre = ref.current;
    if (!pre) return;
    const focused = pre.querySelectorAll<HTMLElement>("[data-focus=true]");
    if (focused.length === 0) return;
    const box = pre.getBoundingClientRect();
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const el of focused) {
      const r = el.getBoundingClientRect();
      top = Math.min(top, r.top - box.top);
      bottom = Math.max(bottom, r.bottom - box.top);
    }
    if (bottom > box.height || top < 0) pre.scrollTo({ top: pre.scrollTop + top - 10, behavior: first.current ? "instant" : "smooth" });
    first.current = false;
  });
  return <InnerPre merge={props} />;
};

/** `// !focus` — the lines this step is about; the rest dims. */
export const focus: AnnotationHandler = {
  name: "focus",
  onlyIfAnnotated: true,
  PreWithRef: PreWithFocus,
  Line: (props) => <InnerLine merge={props} className="px-3 opacity-40 data-[focus]:opacity-100" />,
  AnnotatedLine: ({ annotation: _annotation, ...props }) => <InnerLine merge={props} data-focus={true} />,
};

/** `// !callout[/pattern/] text` — a note pinned under a token. */
export const callout: AnnotationHandler = {
  name: "callout",
  transform: (annotation: InlineAnnotation) => {
    const { name, query, lineNumber, fromColumn, toColumn, data } = annotation;
    return { name, query, fromLineNumber: lineNumber, toLineNumber: lineNumber, data: { ...data, column: (fromColumn + toColumn) / 2 } };
  },
  Block: ({ annotation, children }) => {
    const column = Number(annotation.data.column ?? 0);
    return (
      <>
        {children}
        <div style={{ minWidth: `${column + 4}ch`, marginLeft: "calc(0.75rem - 1ch)" }} className="relative mb-2 mt-1 w-fit max-w-[36ch] whitespace-normal rounded border border-[#45475a] bg-[#181825] px-3 py-1.5 font-sans text-[0.8rem] leading-snug text-[#cdd6f4]">
          <div style={{ left: `${column}ch` }} className="absolute -top-[5px] h-2 w-2 rotate-45 border-l border-t border-[#45475a] bg-[#181825]" />
          {annotation.query}
        </div>
      </>
    );
  },
};

const HANDLERS = { mark, focus, callout } as const;
type HandlerName = keyof typeof HANDLERS;

export interface CodeProps {
  codeblock: HighlightedCode;
  handlers?: readonly HandlerName[];
  className?: string;
}

/** A Code Hike block, highlighted at build time, in the terminal palette regardless of the page theme. */
export function Code({ codeblock, handlers = ["mark"], className = "" }: CodeProps) {
  return <Pre code={codeblock} handlers={handlers.map((h) => HANDLERS[h])} className={`ch-code ${className}`} style={{ background: undefined, color: undefined }} />;
}
