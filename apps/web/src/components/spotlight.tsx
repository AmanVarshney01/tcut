import { Block, HighlightedCodeBlock, parseRoot } from "codehike/blocks";
import { Selectable, Selection, SelectionProvider } from "codehike/utils/selection";
import { z } from "zod";
import Content from "@/content/render.md";
import { Code } from "./code";

const Schema = Block.extend({ steps: z.array(Block.extend({ code: HighlightedCodeBlock })) });

/** Spotlight: pick a thing you can do to a recording; the command for it is marked on the right. */
export function RenderSpotlight() {
  const { steps } = parseRoot(Content, Schema);
  return (
    <SelectionProvider className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <ul className="m-0 list-none space-y-1 p-0">
        {steps.map((step, i) => (
          <li key={step.title}>
            <Selectable index={i} selectOn={["click", "hover"]} className="cursor-pointer rounded-md border border-transparent px-3 py-2 data-[selected=true]:border-line data-[selected=true]:bg-desk-2">
              <div className="font-mono text-[0.9rem]">{step.title}</div>
              <div className="text-sm text-ink-2">{step.children}</div>
            </Selectable>
          </li>
        ))}
      </ul>
      <div className="min-w-0">
        <Selection from={steps.map((step) => <Code key={step.title} codeblock={step.code} handlers={["mark"]} />)} />
      </div>
    </SelectionProvider>
  );
}
