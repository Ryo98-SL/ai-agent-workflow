import { useMemo } from "react";
import Editor from "@monaco-editor/react";

type JsonViewerProps = {
  value: unknown;
  /** Maximum rendered height in pixels before the editor scrolls internally. */
  maxHeight?: number;
};

const LINE_HEIGHT = 18;
const VERTICAL_PADDING = 16;

/**
 * Read-only Monaco editor for inspecting JSON payloads with syntax highlighting.
 * Height auto-fits the content up to `maxHeight`, then scrolls internally.
 */
export function JsonViewer({ value, maxHeight = 240 }: JsonViewerProps) {
  const text = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  const lineCount = text.split("\n").length;
  const height = Math.min(maxHeight, lineCount * LINE_HEIGHT + VERTICAL_PADDING);

  return (
    <div className="overflow-hidden rounded-md border border-slate-800 bg-[#1e1e1e]">
      <Editor
        value={text}
        language="json"
        theme="vs-dark"
        height={height}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          folding: true,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          wrappingIndent: "deepIndent",
          fontSize: 12,
          lineHeight: LINE_HEIGHT,
          renderLineHighlight: "none",
          scrollbar: { alwaysConsumeMouseWheel: false, verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          overviewRulerLanes: 0,
          guides: { indentation: false },
          padding: { top: 8, bottom: 8 },
          contextmenu: false,
        }}
      />
    </div>
  );
}
