import { afterEach, describe, expect, it } from "vitest";
import { isWorkflowCanvasFocus, isWorkflowShortcutEditableTarget } from "../src/workbench/shortcutFocus";

afterEach(() => {
  document.body.innerHTML = "";
  window.getSelection()?.removeAllRanges();
});

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

describe("isWorkflowShortcutEditableTarget", () => {
  it("treats inputs, textareas, selects and contenteditable as editable", () => {
    const host = mount(
      `<input id="i" /><textarea id="t"></textarea><select id="s"></select>` +
        `<div contenteditable="true" id="ce"><span id="inner">x</span></div>` +
        `<div role="textbox" id="rt"></div>`,
    );
    for (const id of ["i", "t", "s", "ce", "inner", "rt"]) {
      expect(isWorkflowShortcutEditableTarget(host.querySelector(`#${id}`))).toBe(true);
    }
  });

  it("treats plain elements as non-editable", () => {
    const host = mount(`<button id="b">x</button><div id="d">x</div>`);
    expect(isWorkflowShortcutEditableTarget(host.querySelector("#b"))).toBe(false);
    expect(isWorkflowShortcutEditableTarget(host.querySelector("#d"))).toBe(false);
    expect(isWorkflowShortcutEditableTarget(null)).toBe(false);
  });
});

describe("isWorkflowCanvasFocus", () => {
  it("treats body/html and ReactFlow descendants as canvas focus", () => {
    const host = mount(`<div class="react-flow"><div id="node">node</div></div>`);
    expect(isWorkflowCanvasFocus(document.body)).toBe(true);
    expect(isWorkflowCanvasFocus(document.documentElement)).toBe(true);
    expect(isWorkflowCanvasFocus(host.querySelector("#node"))).toBe(true);
  });

  it("treats inspector / side-panel focus as NOT canvas focus", () => {
    // The Node Inspector lives outside the .react-flow container.
    const host = mount(`<aside id="inspector"><button id="btn">x</button></aside>`);
    expect(isWorkflowCanvasFocus(host.querySelector("#inspector"))).toBe(false);
    expect(isWorkflowCanvasFocus(host.querySelector("#btn"))).toBe(false);
  });

  it("treats a live text selection as NOT canvas focus (native copy wins)", () => {
    const host = mount(`<aside><code id="ref">{{start1.topic}}</code></aside>`);
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(host.querySelector("#ref")!);
    selection.removeAllRanges();
    selection.addRange(range);
    // Even with focus on body, a non-empty selection means ⌘C should copy text.
    expect(isWorkflowCanvasFocus(document.body)).toBe(false);
  });
});
