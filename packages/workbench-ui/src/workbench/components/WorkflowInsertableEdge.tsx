import { useRef, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";

/** Payload carried on each edge so the midpoint "+" can open the palette. */
export type WorkflowInsertableEdgeData = {
  /**
   * Opens the Node Palette to insert a node onto this edge. Omitted while the
   * canvas is non-interactive (locked / running), which hides the "+". See
   * CONTEXT.md "Edge Insert".
   */
  onInsert?: (edgeId: string, anchor: HTMLElement) => void;
};

const INTERACTION_WIDTH = 24;

/**
 * Workflow edge with a hover-revealed "+" at its midpoint. Clicking the "+"
 * opens the Node Palette to splice a node onto the edge. Rendered through
 * ReactFlow's `BaseEdge` + `EdgeLabelRenderer` so styling, markers, and
 * selection stay handled by ReactFlow rather than a hand-rolled renderer.
 */
export function WorkflowInsertableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const onInsert = (data as WorkflowInsertableEdgeData | undefined)?.onInsert;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} interactionWidth={INTERACTION_WIDTH} />
      {onInsert && (
        <>
          {/* Wide transparent hit area so hovering anywhere on the edge reveals the "+". */}
          <path
            d={edgePath}
            fill="none"
            stroke="transparent"
            strokeWidth={INTERACTION_WIDTH}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={() => buttonRef.current && onInsert(id, buttonRef.current)}
          />
          <EdgeLabelRenderer>
            <button
              ref={buttonRef}
              type="button"
              aria-label="在此边上插入节点"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onClick={() => buttonRef.current && onInsert(id, buttonRef.current)}
              // Mirrors PlusNode (WorkflowNodeCardShell): green pill, white plus,
              // scale-in on reveal. Here the reveal is driven by edge-hover state
              // (the button is portaled out of the edge, so CSS group-hover can't
              // reach it) rather than `group-hover:scale-100`.
              className="nodrag nopan absolute flex size-6 items-center justify-center rounded-full bg-green-500 shadow-sm transition"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) scale(${hovered ? 1 : 0})`,
                pointerEvents: hovered ? "all" : "none",
              }}
            >
              <Plus className="size-4 text-white" aria-hidden />
            </button>
          </EdgeLabelRenderer>
        </>
      )}
    </>
  );
}
