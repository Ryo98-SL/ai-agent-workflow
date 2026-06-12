import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, MessageSquareText, Send, Settings2 } from "lucide-react";
import type { ResumeRunRequest } from "@ai-agent-workflow/api-contracts";
import {
  resolveMemorySettings,
  type MemorySummarySettings,
  type StartNode,
  type WorkflowFile,
} from "@ai-agent-workflow/workflow-domain";
import { Textarea } from "@workbench/components/ui/textarea";
import { Input } from "@workbench/components/ui/input";
import type { ChatTurn, DebugState, NodeExecutionState } from "../types";
import { deriveChatAnswer } from "../hooks/useWorkflowExecution";
import { Button } from "./Button";
import { HumanReviewForm } from "./HumanReviewForm";
import { RunOutput } from "./RunOutput";

type ChatPanelProps = {
  workflow: WorkflowFile;
  startNode?: StartNode;
  transcript: ChatTurn[];
  debugState: DebugState;
  nodeStates: Map<string, NodeExecutionState>;
  conversationTurns: number;
  onSendMessage: (query: string, baseInput: Record<string, string>) => void;
  onResumeRun?: (runId: string, request: ResumeRunRequest) => void;
  onNewConversation?: () => void;
  onMemorySummaryChange?: (summary: MemorySummarySettings) => void;
  readOnly?: boolean;
};

/**
 * Chat Mode debug surface: a Dify-style transcript driven by `{{userInput.query}}`.
 * Start fields (if any) are collected once at conversation start; each message
 * then runs the workflow with the chat query. The newest turn renders live from
 * the active run; finalized turns keep an expandable execution trace.
 */
export function ChatPanel({
  workflow,
  startNode,
  transcript,
  debugState,
  nodeStates,
  conversationTurns,
  onSendMessage,
  onResumeRun,
  onNewConversation,
  onMemorySummaryChange,
  readOnly = false,
}: ChatPanelProps) {
  const startFields = useMemo(() => startNode?.config.fields ?? [], [startNode]);
  const needsSetup = startFields.length > 0;
  const initialValues = useMemo(
    () => Object.fromEntries(startFields.map((field) => [field.name, field.defaultValue ?? ""])) as Record<string, string>,
    [startFields],
  );
  const [baseValues, setBaseValues] = useState<Record<string, string>>(initialValues);
  // Once a conversation has begun the Start form is locked; "New conversation" resets.
  const [started, setStarted] = useState(!needsSetup);
  useEffect(() => {
    if (transcript.length === 0 && conversationTurns === 0) {
      setStarted(!needsSetup);
      setBaseValues(initialValues);
    }
  }, [transcript.length, conversationTurns, needsSetup, initialValues]);

  const [draft, setDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRunning = debugState.status === "running";
  const isWaiting = debugState.status === "waiting";
  const busy = isRunning || isWaiting;

  // Keep the transcript pinned to the latest message as it streams.
  const liveAnswer = deriveChatAnswer(nodeStates);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [transcript, liveAnswer]);

  const updateBaseField = (key: string, value: string) => setBaseValues((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const query = draft.trim();
    if (!query || busy || !started) return;
    setDraft("");
    onSendMessage(query, baseValues);
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const summary = resolveMemorySettings(workflow).summary;
  const lastIndex = transcript.length - 1;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header: memory status + new conversation + summary settings */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <MessageSquareText size={14} aria-hidden />
          对话调试 · {conversationTurns} 轮
          {summary.enabled && <span className="text-muted-foreground/70">· 记忆压缩开</span>}
        </span>
        <div className="flex items-center gap-1">
          {onMemorySummaryChange && (
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => setShowSettings((value) => !value)}
              aria-label="记忆设置"
              title="记忆设置"
            >
              <Settings2 size={15} aria-hidden />
            </Button>
          )}
          <button
            type="button"
            className="text-xs font-medium text-brand transition-colors hover:text-brand/80 disabled:opacity-50"
            disabled={busy || (transcript.length === 0 && conversationTurns === 0)}
            onClick={() => onNewConversation?.()}
          >
            新对话
          </button>
        </div>
      </div>

      {showSettings && onMemorySummaryChange && (
        <MemorySummaryEditor summary={summary} onChange={onMemorySummaryChange} />
      )}

      {/* Transcript */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {transcript.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MessageSquareText size={28} className="opacity-40" aria-hidden />
            <p className="text-sm">
              {needsSetup && !started ? "填写下方初始输入后开始对话。" : "发送一条消息，开始与工作流对话。"}
            </p>
          </div>
        )}

        {transcript.map((turn, index) => {
          const isLive = index === lastIndex;
          const answer = isLive && turn.status !== "success" ? liveAnswer : turn.answer;
          return (
            <ChatTurnView
              key={turn.id}
              workflow={workflow}
              turn={turn}
              answer={answer}
              isLive={isLive}
              debugState={debugState}
              liveNodeStates={nodeStates}
              onResumeRun={readOnly ? undefined : onResumeRun}
            />
          );
        })}
      </div>

      {/* Start-form gate (once per conversation) */}
      {!readOnly && needsSetup && !started && (
        <div className="space-y-2 border-t border-border p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">初始输入</h3>
          {startFields.map((field) => (
            <label key={field.name} className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {field.label || field.name}
                {field.required ? " *" : ""}
              </span>
              <Input
                value={baseValues[field.name] ?? ""}
                onChange={(event) => updateBaseField(field.name, event.target.value)}
                placeholder={field.defaultValue || field.name}
              />
            </label>
          ))}
          <Button variant="success" size="md" className="w-full" onClick={() => setStarted(true)}>
            开始对话
          </Button>
        </div>
      )}

      {/* Composer */}
      {!readOnly && started && (
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={busy ? "工作流运行中…" : "输入消息，Enter 发送，Shift+Enter 换行"}
              rows={2}
              disabled={busy}
              className="min-h-[2.5rem] flex-1 resize-none"
            />
            <Button
              variant="success"
              size="md"
              disabled={busy || draft.trim().length === 0}
              onClick={submit}
              aria-label="发送"
            >
              {isRunning ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A single user→assistant exchange, with an expandable execution trace. */
function ChatTurnView({
  workflow,
  turn,
  answer,
  isLive,
  debugState,
  liveNodeStates,
  onResumeRun,
}: {
  workflow: WorkflowFile;
  turn: ChatTurn;
  answer: string;
  isLive: boolean;
  debugState: DebugState;
  liveNodeStates: Map<string, NodeExecutionState>;
  onResumeRun?: (runId: string, request: ResumeRunRequest) => void;
}) {
  const [showTrace, setShowTrace] = useState(false);
  const thinking = turn.status === "running" && answer.trim().length === 0;
  const traceNodeStates = isLive ? liveNodeStates : turn.nodeStates ?? new Map<string, NodeExecutionState>();
  const traceDebugState: DebugState = isLive
    ? debugState
    : { status: turn.status, result: turn.result, error: turn.error };

  return (
    <div className="space-y-2">
      {/* User message */}
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-brand-foreground">
          {turn.query}
        </div>
      </div>

      {/* Waiting on a Human Input node: inline review form */}
      {isLive && turn.status === "waiting" && debugState.waiting && onResumeRun && (
        <HumanReviewForm
          runId={debugState.waiting.runId}
          interrupt={debugState.waiting.interrupt}
          onResumeRun={onResumeRun}
        />
      )}

      {/* Assistant message */}
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-1.5">
          {turn.status === "error" ? (
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle size={14} aria-hidden />
              {turn.error || "运行失败"}
            </div>
          ) : thinking ? (
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              思考中…
            </div>
          ) : (
            <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground">
              {answer || (turn.status === "waiting" ? "等待人工复核…" : "")}
            </div>
          )}

          {(turn.runId || isLive) && (
            <button
              type="button"
              onClick={() => setShowTrace((value) => !value)}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {showTrace ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
              执行轨迹
            </button>
          )}

          {showTrace && (
            <div className="rounded-md border border-border bg-background/60 p-2">
              <RunOutput workflow={workflow} debugState={traceDebugState} nodeStates={traceNodeStates} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Inline editor for the workflow-level summary-buffer memory policy. */
function MemorySummaryEditor({
  summary,
  onChange,
}: {
  summary: MemorySummarySettings;
  onChange: (summary: MemorySummarySettings) => void;
}) {
  return (
    <div className="space-y-3 border-b border-border bg-muted/30 px-3 py-3">
      <label className="flex items-center justify-between gap-2 text-xs font-medium text-foreground">
        <span>记忆摘要压缩</span>
        <input
          type="checkbox"
          checked={summary.enabled}
          onChange={(event) => onChange({ ...summary, enabled: event.target.checked })}
          className="size-4 accent-[var(--brand)]"
        />
      </label>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        当历史对话超过阈值时，把较早的轮次压缩为一段摘要，仅保留最近若干轮原文。
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">触发阈值（约 tokens）</span>
          <Input
            type="number"
            min={1}
            value={summary.triggerTokens}
            disabled={!summary.enabled}
            onChange={(event) => onChange({ ...summary, triggerTokens: Math.max(1, Number(event.target.value) || 0) })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-muted-foreground">保留最近轮次</span>
          <Input
            type="number"
            min={0}
            value={summary.keepTurns}
            disabled={!summary.enabled}
            onChange={(event) => onChange({ ...summary, keepTurns: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
      </div>
    </div>
  );
}
