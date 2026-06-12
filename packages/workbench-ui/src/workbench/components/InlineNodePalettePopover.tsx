import type { WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import type { AddNodeOptions, WorkflowNodePaletteHandleType } from "../types";
import { FloatingPanel } from "./FloatingPanel";
import { NodePalette } from "./NodePalette";
import { Popover } from "./Popover";

export type InlineNodePaletteState =
  | {
      mode: "fromHandle";
      sourceNodeId: string;
      sourceNodeLabel: string;
      handleType: WorkflowNodePaletteHandleType;
      sourceHandleId?: string;
      anchorElement: HTMLElement;
    }
  | {
      // Edge Insert: opened from the "+" on an edge's midpoint. Splices the chosen
      // node onto the edge. See CONTEXT.md "Edge Insert".
      mode: "insertOnEdge";
      edgeId: string;
      sourceNodeId: string;
      sourceNodeLabel: string;
      sourceHandleId?: string;
      targetNodeId: string;
      anchorElement: HTMLElement;
    };

type InlineNodePalettePopoverProps = {
  hasStartNode: boolean;
  palette: InlineNodePaletteState | null;
  onAddNode: (type: WorkflowNodeType, options?: AddNodeOptions) => void;
  onClose: () => void;
};

export function InlineNodePalettePopover({ hasStartNode, palette, onAddNode, onClose }: InlineNodePalettePopoverProps) {
  const disabledTypes: WorkflowNodeType[] =
    palette?.mode === "insertOnEdge"
      ? ["start", "end"]
      : palette?.handleType === "target"
        ? ["end"]
        : [];

  const description =
    palette?.mode === "insertOnEdge"
      ? `Insert after ${palette.sourceNodeLabel}`
      : palette
        ? `Connect from ${palette.sourceNodeLabel}`
        : undefined;

  const placement = palette?.mode === "insertOnEdge" ? "right" : palette?.handleType === "target" ? "left-start" : "right-start";

  return (
    <Popover
      id="workbench-inline-node-palette"
      open={Boolean(palette)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      referenceElement={palette?.anchorElement ?? null}
      placement={placement}
    >
      <FloatingPanel
        title="Node Palette"
        description={description}
        closeLabel="Close node palette"
        onClose={onClose}
        className="h-[min(70vh,520px)] w-[300px]"
      >
        <div className="h-full">
          <NodePalette
            disabledTypes={disabledTypes}
            hasStartNode={hasStartNode}
            onAddNode={(type) => {
              if (!palette) {
                return;
              }
              if (palette.mode === "insertOnEdge") {
                onAddNode(type, {
                  insertOnEdge: {
                    edgeId: palette.edgeId,
                    sourceNodeId: palette.sourceNodeId,
                    sourceHandleId: palette.sourceHandleId,
                    targetNodeId: palette.targetNodeId,
                  },
                });
              } else {
                onAddNode(type, {
                  sourceNodeId: palette.sourceNodeId,
                  handleType: palette.handleType,
                  sourceHandleId: palette.sourceHandleId,
                });
              }
              onClose();
            }}
          />
        </div>
      </FloatingPanel>
    </Popover>
  );
}
