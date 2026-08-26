import { Block, HighlightedCodeBlock, parseRoot } from "codehike/blocks";
import type { HighlightedCode } from "codehike/code";
import { Selectable, SelectionProvider, useSelectedIndex } from "codehike/utils/selection";
import { z } from "zod";
import Content from "@/content/walkthrough.md";
import step1 from "@/assets/walkthrough/step-1.svg?raw";
import step2 from "@/assets/walkthrough/step-2.svg?raw";
import step3 from "@/assets/walkthrough/step-3.svg?raw";
import step4 from "@/assets/walkthrough/step-4.svg?raw";
import step5 from "@/assets/walkthrough/step-5.svg?raw";
import step6 from "@/assets/walkthrough/step-6.svg?raw";
import { Code } from "./code";

const Schema = Block.extend({ steps: z.array(Block.extend({ code: HighlightedCodeBlock })) });
const FRAMES = [step1, step2, step3, step4, step5, step6];

/**
 * Scrollycoding: the script grows step by step on the left; on the right, sticky, the code with the step's
 * lines in focus and — below it — the terminal frame that line produced, rendered by tcut as selectable SVG.
 */
export function Walkthrough() {
  const { steps } = parseRoot(Content, Schema);
  return (
    <SelectionProvider className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-8">
      <div className="min-w-0 lg:mb-[24vh]">
        {steps.map((step, i) => (
          <Selectable key={step.title} index={i} selectOn={["click", "scroll"]} className="mb-14 min-w-0 border-l-2 border-line py-1 pl-5 data-[selected=true]:border-amber lg:mb-[16vh]">
            <h3 className="text-[0.95rem] font-medium">{step.title}</h3>
            <div className="mt-2 text-ink-2">{step.children}</div>
            <div className="mt-4 lg:hidden">
              <Code codeblock={step.code} handlers={["focus", "mark"]} />
              <Frame svg={FRAMES[i] ?? ""} />
            </div>
          </Selectable>
        ))}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-6 space-y-3">
          <StickyPane steps={steps} />
        </div>
      </div>
    </SelectionProvider>
  );
}

/** The code block is one element across steps, so tokens animate to their new place instead of being replaced. */
function StickyPane({ steps }: { steps: Array<{ title?: string; code: HighlightedCode }> }) {
  const [index] = useSelectedIndex();
  const step = steps[index] ?? steps[0];
  if (!step) return null;
  return (
    <div className="space-y-3">
      <Code codeblock={step.code} handlers={["token-transitions", "focus", "mark"]} className="max-h-[22rem]" />
      <Frame svg={FRAMES[index] ?? FRAMES[0] ?? ""} />
    </div>
  );
}

function Frame({ svg }: { svg: string }) {
  return (
    <figure className="frame overflow-hidden rounded-lg bg-mocha">
      {/* the browser normalises the SVG markup, so its innerHTML never equals the raw string byte for byte */}
      <div dangerouslySetInnerHTML={{ __html: svg }} suppressHydrationWarning />
      <figcaption className="px-3 py-1.5 font-mono text-[0.7rem] text-[#6c7086]">the frame this step produced — real text, select it</figcaption>
    </figure>
  );
}
