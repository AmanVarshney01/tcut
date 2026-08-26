import { useState } from "react";

export function CopyCommand({ command }: { command: string }) {
  const [state, setState] = useState<"copy" | "copied" | "select">("copy");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setState("copied");
    } catch {
      setState("select");
    }
    setTimeout(() => setState("copy"), 1400);
  };
  return (
    <div className="flex items-stretch overflow-hidden rounded-md bg-mocha text-[#cdd6f4]">
      <code className="flex-1 truncate px-4 py-2.5 text-[0.92rem]">{command}</code>
      <button type="button" onClick={copy} className="shrink-0 border-l border-white/10 px-3 font-mono text-xs text-[#a6adc8] hover:bg-white/5 hover:text-white" aria-label={`Copy “${command}”`}>
        {state}
      </button>
    </div>
  );
}
