import "@testing-library/jest-dom/vitest";

// jsdom has no matchMedia; ThemeProvider queries it at mount.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

// jsdom lacks Pointer Capture APIs; sonner calls these on toast pointerdown.
for (const method of ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"] as const) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, {
      writable: true,
      configurable: true,
      value: method === "hasPointerCapture" ? () => false : () => {},
    });
  }
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

class EventSourceMock {
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public readonly url: string) {
    const runId = runIdFromUrl(url);
    [
      { type: "node.started", runId, nodeId: "llm1", nodeType: "llm" },
      {
        type: "node.completed",
        runId,
        nodeId: "llm1",
        nodeType: "llm",
        output: "Memory runtime output.",
        data: { text: "Memory runtime output.", usage: null, reasoning: null },
        durationMs: 120,
      },
      { type: "run.completed", runId, status: "succeeded" },
    ].forEach((event, index) => {
      setTimeout(() => {
        this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(event) }));
      }, index);
    });
  }

  close() {}
}

Object.defineProperty(window, "EventSource", {
  writable: true,
  configurable: true,
  value: EventSourceMock,
});

Object.defineProperty(globalThis, "EventSource", {
  writable: true,
  configurable: true,
  value: EventSourceMock,
});

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value() {
    return {
      width: 1024,
      height: 768,
      top: 0,
      left: 0,
      bottom: 768,
      right: 1024,
      x: 0,
      y: 0,
      toJSON: () => {},
    };
  },
});

function runIdFromUrl(url: string) {
  const [, runId = "run-test"] = url.match(/\/runs\/([^/]+)\/stream/) ?? [];
  return runId;
}
