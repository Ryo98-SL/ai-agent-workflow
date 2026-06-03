import type { WorkflowNodeType } from "@ai-agent-workflow/workflow-domain";
import type { AddNodeOptions, WorkflowNodePaletteHandleType } from "../types";
import { FloatingPanel } from "./FloatingPanel";
import { NodePalette } from "./NodePalette";
import { Popover } from "./Popover";

export type InlineNodePaletteState = {
  sourceNodeId: string;
  sourceNodeLabel: string;
  handleType: WorkflowNodePaletteHandleType;
  anchorElement: HTMLElement;
};

type InlineNodePalettePopoverProps = {
  hasStartNode: boolean;
  palette: InlineNodePaletteState | null;
  onAddNode: (type: WorkflowNodeType, options?: AddNodeOptions) => void;
  onClose: () => void;
};

export function InlineNodePalettePopover({ hasStartNode, palette, onAddNode, onClose }: InlineNodePalettePopoverProps) {
  const disabledTypes: WorkflowNodeType[] = palette?.handleType === "target" ? ["end"] : [];

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
      placement={palette?.handleType === "target" ? "left-start" : "right-start"}
    >
      <FloatingPanel
        title="Node Palette"
        description={palette ? `Connect from ${palette.sourceNodeLabel}` : undefined}
        closeLabel="Close node palette"
        onClose={onClose}
        className="h-[min(70vh,520px)] w-[300px]"
      >
        <div className="h-full">
          <NodePalette
            disabledTypes={disabledTypes}
            hasStartNode={hasStartNode}
            onAddNode={(type) => {
              if (palette) {
                onAddNode(type, { sourceNodeId: palette.sourceNodeId, handleType: palette.handleType });
                onClose();
              }
            }}
          />
        </div>
      </FloatingPanel>
    </Popover>
  );
}
