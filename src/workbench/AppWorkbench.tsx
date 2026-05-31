import { useCallback, useMemo, useRef, useState, type SetStateAction } from "react";
import { FilePlus2 } from "lucide-react";
import { executeNode } from "../domain/runtime/runtimeService";
import type { DebugState } from "./types";
import {
  createDefaultWorkflow,
  createNode,
  type OpenAICompatibleSettings,
  parseWorkflowJson,
  serializeWorkflowFile,
  type WorkflowFile,
  type WorkflowNode,
  type WorkflowNodeType,
} from "../domain/workflow/schema";
import { DebugPanel } from "./components/DebugPanel";
import { ModelSettingsPanel } from "./components/ModelSettingsPanel";
import { NodeInspector } from "./components/NodeInspector";
import { NodePalette } from "./components/NodePalette";
import { ProjectFileActions } from "./components/ProjectFileActions";
import { WorkflowCanvas } from "./components/WorkflowCanvas";

export function AppWorkbench() {
  const [workflow, setWorkflow] = useState<WorkflowFile>(() => createDefaultWorkflow());
  const [selectedNodeId, setSelectedNodeId] = useState<string>("llm-1");
  const [debugState, setDebugState] = useState<DebugState>({ status: "idle" });
  const [filePath, setFilePath] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);
  const runController = useRef<AbortController | null>(null);

  const selectedNode = useMemo(
    () => workflow.graph.nodes.find((node) => node.id === selectedNodeId),
    [selectedNodeId, workflow.graph.nodes],
  );

  const markWorkflow = useCallback((updater: SetStateAction<WorkflowFile>) => {
    setWorkflow(updater);
    setDirty(true);
  }, []);

  const updateNode = useCallback(
    (nodeId: string, updater: (node: WorkflowNode) => WorkflowNode) => {
      markWorkflow((current) => ({
        ...current,
        graph: {
          ...current.graph,
          nodes: current.graph.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
        },
      }));
    },
    [markWorkflow],
  );

  const updateModelSettings = useCallback(
    (settings: OpenAICompatibleSettings) => {
      markWorkflow((current) => ({
        ...current,
        settings: {
          ...current.settings,
          modelProvider: settings,
        },
      }));
    },
    [markWorkflow],
  );

  const addNode = useCallback(
    (type: WorkflowNodeType) => {
      const position = { x: 180 + workflow.graph.nodes.length * 32, y: 120 + workflow.graph.nodes.length * 24 };
      const node = createNode(type, position);
      markWorkflow((current) => ({
        ...current,
        graph: { ...current.graph, nodes: [...current.graph.nodes, node] },
      }));
      setSelectedNodeId(node.id);
    },
    [markWorkflow, workflow.graph.nodes.length],
  );

  const handleNewWorkflow = useCallback(() => {
    const next = createDefaultWorkflow();
    setWorkflow(next);
    setSelectedNodeId(next.graph.nodes.find((node) => node.type === "llm")?.id || next.graph.nodes[0]?.id);
    setDebugState({ status: "idle" });
    setFilePath(undefined);
    setDirty(false);
  }, []);

  const handleOpenWorkflow = useCallback(async () => {
    if (!window.agentWorkflow) {
      setDebugState({ status: "error", error: "File dialogs are only available inside Electron." });
      return;
    }

    const result = await window.agentWorkflow.openWorkflow();
    if (!result.ok) {
      if (!result.canceled) {
        setDebugState({ status: "error", error: result.error || "Workflow open was cancelled." });
      }
      return;
    }

    const parsed = parseWorkflowJson(result.content);
    if (!parsed.ok) {
      setDebugState({ status: "error", error: parsed.error });
      return;
    }

    setWorkflow(parsed.data);
    setFilePath(result.filePath);
    setDirty(false);
    setSelectedNodeId(parsed.data.graph.nodes[0]?.id);
    setDebugState({ status: "idle" });
  }, []);

  const saveWorkflow = useCallback(
    async (mode: "save" | "saveAs") => {
      if (!window.agentWorkflow) {
        setDebugState({ status: "error", error: "Saving is only available inside Electron." });
        return;
      }

      const content = serializeWorkflowFile(workflow);
      const result =
        mode === "save" && filePath
          ? await window.agentWorkflow.saveWorkflow(filePath, content)
          : await window.agentWorkflow.saveWorkflowAs(content, filePath);

      if (!result.ok) {
        if (!result.canceled) {
          setDebugState({ status: "error", error: result.error || "Workflow save was cancelled." });
        }
        return;
      }

      const parsed = parseWorkflowJson(content);
      if (parsed.ok) {
        setWorkflow(parsed.data);
      }
      setFilePath(result.filePath);
      setDirty(false);
    },
    [filePath, workflow],
  );

  const runSelectedNode = useCallback(
    async (testVariables: Record<string, string>) => {
      if (!selectedNode || debugState.status === "running") {
        return;
      }

      runController.current?.abort();
      const controller = new AbortController();
      runController.current = controller;
      setDebugState({ status: "running" });

      const result = await executeNode(selectedNode, {
        modelProvider: workflow.settings.modelProvider,
        testVariables,
        signal: controller.signal,
      });
      setDebugState({ status: result.status, result });
    },
    [debugState.status, selectedNode, workflow.settings.modelProvider],
  );

  return (
    <main className="grid h-full min-h-[760px] grid-cols-[260px_minmax(520px,1fr)_360px] grid-rows-[64px_minmax(0,1fr)_260px] bg-slate-50 text-slate-950">
      <header className="col-span-3 flex items-center gap-3 border-b border-slate-200 bg-white px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white">
          <FilePlus2 size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">{workflow.metadata.name}</h1>
          <p className="truncate text-xs text-slate-500">
            {filePath || "Unsaved .agentflow.json"} {dirty ? "• unsaved changes" : ""}
          </p>
        </div>
        <ProjectFileActions
          dirty={dirty}
          filePath={filePath}
          onNew={handleNewWorkflow}
          onOpen={handleOpenWorkflow}
          onSave={() => saveWorkflow("save")}
          onSaveAs={() => saveWorkflow("saveAs")}
        />
      </header>

      <aside className="row-span-2 border-r border-slate-200 bg-white">
        <NodePalette onAddNode={addNode} />
      </aside>

      <section className="min-w-0 border-r border-slate-200">
        <WorkflowCanvas
          workflow={workflow}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onWorkflowChange={markWorkflow}
        />
      </section>

      <aside className="min-w-0 overflow-y-auto bg-white">
        <ModelSettingsPanel settings={workflow.settings.modelProvider} onChange={updateModelSettings} />
        <NodeInspector selectedNode={selectedNode} updateNode={updateNode} />
      </aside>

      <section className="col-span-2 min-h-0 border-t border-slate-200 bg-white">
        <DebugPanel selectedNode={selectedNode} debugState={debugState} onRun={runSelectedNode} />
      </section>
    </main>
  );
}
