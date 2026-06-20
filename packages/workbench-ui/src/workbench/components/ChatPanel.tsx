import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Info,
  Loader2,
  MessageSquareText,
  Send,
  Settings2,
  UserCheck,
  Variable,
} from "lucide-react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import type { ResumeRunRequest } from "@ai-agent-workflow/api-contracts";
import {
  resolveMemorySettings,
  type MemorySummarySettings,
  type StartNode,
  type WorkflowFile,
} from "@ai-agent-workflow/workflow-domain";
import { Textarea } from "@workbench/components/ui/textarea";
import { Input } from "@workbench/components/ui/input";
import { WORKBENCH_I18N_NAMESPACE } from "../../i18n";
import type { ChatTurn, DebugState, NodeExecutionState } from "../types";
import { deriveChatAnswer } from "../hooks/useWorkflowExecution";
import { Button } from "./Button";
import { HumanReviewForm } from "./HumanReviewForm";
import { RunOutput } from "./RunOutput";
import { Tooltip } from "./Tooltip";
import { VariableTag } from "./VariableTag";

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
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const startFields = useMemo(() => startNode?.config.fields ?? [], [startNode]);
  const needsSetup = startFields.length > 0;
  // Cross-turn memory only carries context when an LLM/Agent node opts in. Surface
  // that status in the composer hint so users know whether the chat will remember.
  const memoryEnabled = useMemo(
    () =>
      workflow.graph.nodes.some(
        (node) => (node.type === "llm" || node.type === "agent") && node.config.memory === true,
      ),
    [workflow],
  );
  const initialValues = useMemo(
    () => Object.fromEntries(startFields.map((field) => [field.name, field.defaultValue ?? ""])) as Record<string, string>,
    [startFields],
  );
  const [baseValues, setBaseValues] = useState<Record<string, string>>(initialValues);
  // The Start form is only gated for a fresh, empty conversation. An in-progress
  // one is already past the gate — including after the panel remounts (e.g.
  // toggling back from the Workflow tab), so the "开始对话" button never reappears
  // mid-conversation. "New conversation" empties the transcript and re-gates.
  const hasConversation = transcript.length > 0 || conversationTurns > 0;
  const [started, setStarted] = useState(!needsSetup || hasConversation);
  useEffect(() => {
    if (hasConversation) {
      setStarted(true);
    } else {
      setStarted(!needsSetup);
      setBaseValues(initialValues);
    }
  }, [hasConversation, needsSetup, initialValues]);

  const [draft, setDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRunning = debugState.status === "running";
  const isWaiting = debugState.status === "waiting";
  const busy = isRunning || isWaiting;

  // The human-review dock floats over the transcript bottom (it never steals
  // height from the conversation) and can collapse to a thin bar. Each new
  // interrupt opens expanded.
  const [reviewCollapsed, setReviewCollapsed] = useState(false);
  useEffect(() => {
    if (isWaiting) setReviewCollapsed(false);
  }, [isWaiting]);

  // Keep the transcript pinned to the latest message as it streams — but only
  // while the user is already at the bottom. Once they scroll up to read earlier
  // output we stop auto-scrolling so streaming output can't yank them back down;
  // returning to the bottom (or sending a message) re-arms the stick.
  const liveAnswer = deriveChatAnswer(nodeStates);
  const stickToBottomRef = useRef(true);
  const handleTranscriptScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const scrollEl = scrollRef.current;
    if (scrollEl && typeof scrollEl.scrollTo === "function") {
      scrollEl.scrollTo({ top: scrollEl.scrollHeight });
    }
  }, [transcript, liveAnswer]);

  const updateBaseField = (key: string, value: string) => setBaseValues((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const query = draft.trim();
    if (!query || busy || !started) return;
    setDraft("");
    stickToBottomRef.current = true;
    onSendMessage(query, baseValues);
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }
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

      {/* Transcript + floating human-review dock (the dock overlays the bottom
          of the scroll area instead of consuming its height). */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleTranscriptScroll}
          className={[
            "h-full space-y-4 overflow-y-auto px-4 pt-4",
            // Leave room below the last bubble so the collapsed review bar
            // (~3rem incl. its margin) can't cover content when scrolled to bottom.
            isWaiting ? "pb-16" : "pb-4",
          ].join(" ")}
        >
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
              />
            );
          })}
        </div>

        {/* Floating, collapsible human-in-the-loop review. Wrapper is
            pointer-events-none so the transcript stays scrollable around it. */}
        {!readOnly && isWaiting && debugState.waiting && onResumeRun && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
            {reviewCollapsed ? (
              <button
                type="button"
                onClick={() => setReviewCollapsed(false)}
                className="pointer-events-auto flex w-full items-center gap-2 rounded-lg border border-brand/40 bg-background/95 px-3 py-2.5 text-sm font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:bg-brand/5"
              >
                <UserCheck size={15} className="shrink-0 text-brand" aria-hidden />
                <span className="flex-1 truncate text-left">等待你的复核</span>
                <ChevronUp size={16} className="shrink-0 text-muted-foreground" aria-hidden />
              </button>
            ) : (
              // Opaque wrapper so the floating card covers the transcript
              // behind it; the prompt's own bg-brand/5 sits on top for tint.
              <div className="pointer-events-auto rounded-lg bg-background shadow-lg">
                <HumanReviewForm
                  runId={debugState.waiting.runId}
                  interrupt={debugState.waiting.interrupt}
                  onResumeRun={onResumeRun}
                  onCollapse={() => setReviewCollapsed(true)}
                  className="max-h-[22rem] overflow-y-auto"
                />
              </div>
            )}
          </div>
        )}
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
          {/* Compact hint trigger: a hover/focus tooltip carries both the
              `{{userInput.query}}` usage note and the dynamic cross-turn memory
              status, so neither needs a permanent box crowding the composer. */}
          <div className="mb-2 flex justify-end">
            <Tooltip
              placement="top-end"
              content={
                <div className="w-72 rounded-md border border-border bg-background p-3 shadow-lg">
                  <div className="flex gap-2">
                    <Variable size={14} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                    <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
                      {t("chatPanel.queryHintPrefix")}{" "}
                      <VariableTag reference="{{userInput.query}}" className="mx-0.5" />{" "}
                      {t("chatPanel.queryHintSuffix")}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2 border-t border-border pt-2.5">
                    <Brain
                      size={14}
                      className={["mt-0.5 shrink-0", memoryEnabled ? "text-brand" : "text-amber-500"].join(" ")}
                      aria-hidden
                    />
                    <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
                      {memoryEnabled
                        ? `${t("chatPanel.memoryOn")}${summary.enabled ? ` ${t("chatPanel.memoryOnSummary")}` : ""}`
                        : t("chatPanel.memoryOff")}
                    </p>
                  </div>
                </div>
              }
            >
              <button
                type="button"
                aria-label={t("chatPanel.hintAriaLabel")}
                className="inline-flex items-center rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Info size={15} className={memoryEnabled ? "" : "text-amber-500"} aria-hidden />
              </button>
            </Tooltip>
          </div>
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
}: {
  workflow: WorkflowFile;
  turn: ChatTurn;
  answer: string;
  isLive: boolean;
  debugState: DebugState;
  liveNodeStates: Map<string, NodeExecutionState>;
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

      {/* Assistant message */}
      <div className="space-y-1.5">
        <div className="flex justify-start">
          {turn.status === "error" ? (
            <div className="flex max-w-[85%] items-center gap-1.5 rounded-2xl rounded-bl-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle size={14} aria-hidden />
              {turn.error || "运行失败"}
            </div>
          ) : thinking ? (
            <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" aria-hidden />
              思考中…
            </div>
          ) : (
            <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground">
              {answer || (turn.status === "waiting" ? "等待人工复核…" : "")}
            </div>
          )}
        </div>

        {(turn.runId || isLive) && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setShowTrace((value) => !value)}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {showTrace ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
              执行轨迹
            </button>
          </div>
        )}

        {showTrace && (
          <div className="w-[92%] max-w-[760px] rounded-md border border-border bg-background/60 p-2">
            <RunOutput workflow={workflow} debugState={traceDebugState} nodeStates={traceNodeStates} />
          </div>
        )}
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
