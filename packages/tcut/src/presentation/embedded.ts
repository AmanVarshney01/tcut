import js from "../renderer/generated/presenter.js" with { type: "file" };
import css from "../renderer/generated/presenter.css" with { type: "file" };

export async function loadPresenter(): Promise<{ js: string; css: string }> {
  return { js: await Bun.file(js).text(), css: await Bun.file(css).text() };
}
