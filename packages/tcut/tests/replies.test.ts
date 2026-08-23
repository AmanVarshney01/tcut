import { describe, expect, test } from "bun:test";
import { CURSOR_QUERY, hasCursorReport, stripTerminalReplies } from "../src/replies";

const ESC = "\x1b";

describe("terminal replies", () => {
  test("answers to the program's queries are removed, keystrokes stay", () => {
    const replies = `${ESC}[?1;2c${ESC}[?0u${ESC}[>0;95;0c${ESC}]11;rgb:1e1e/1e1e/2e2e${ESC}\\${ESC}P1+r696e646e${ESC}\\`;
    expect(stripTerminalReplies(`${replies}ls\r`)).toBe("ls\r");
    expect(stripTerminalReplies(`${ESC}[A${ESC}b\x03`)).toBe(`${ESC}[A${ESC}b\x03`); // arrows, alt+b, ctrl+c untouched
  });

  test("a cursor position report is only a reply when the program asked — otherwise Shift/Ctrl+F3 would vanish", () => {
    const f3 = `${ESC}[1;2R`; // Shift+F3, the same bytes as "cursor at row 1, column 2"
    expect(stripTerminalReplies(`${f3}abc`)).toBe(`${f3}abc`);
    expect(stripTerminalReplies(`${f3}abc`, { cursorQueried: true })).toBe("abc");
    expect(stripTerminalReplies(`${ESC}[24;80Rabc`)).toBe("abc"); // unambiguous: row 24 is never a modifier
    expect(hasCursorReport(f3)).toBe(true);
    expect(hasCursorReport("abc")).toBe(false);
    expect(CURSOR_QUERY).toBe(`${ESC}[6n`);
  });
});
