import { Lock, Maximize2, Redo2, Undo2, Unlock, ZoomIn, ZoomOut } from "lucide-react";
import { useReactFlow, useViewport } from "@xyflow/react";
import type * as React from "react";
import { ButtonGroup, ButtonGroupSeparator } from "@workbench/components/ui/button-group";
import { Button } from "./Button";

type WorkflowCanvasControlsProps = {
  canRedo: boolean;
  canUndo: boolean;
  isInteractive: boolean;
  maxZoom: number;
  minZoom: number;
  onRedo: () => void;
  onToggleInteractive: () => void;
  onUndo: () => void;
};

const ZOOM_EDGE_TOLERANCE = 0.001;

export function WorkflowCanvasControls({
  canRedo,
  canUndo,
  isInteractive,
  maxZoom,
  minZoom,
  onRedo,
  onToggleInteractive,
  onUndo,
}: WorkflowCanvasControlsProps) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();
  const canZoomIn = zoom < maxZoom - ZOOM_EDGE_TOLERANCE;
  const canZoomOut = zoom > minZoom + ZOOM_EDGE_TOLERANCE;

  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <ButtonGroup aria-label="Canvas history controls">
        <CanvasControlButton title="Undo canvas edit (Cmd/Ctrl+Z)" aria-label="Undo canvas edit" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={16} aria-hidden />
        </CanvasControlButton>
        <ButtonGroupSeparator />
        <CanvasControlButton
          title="Redo canvas edit (Cmd/Ctrl+Shift+Z)"
          aria-label="Redo canvas edit"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={16} aria-hidden />
        </CanvasControlButton>
      </ButtonGroup>

      <ButtonGroup aria-label="Canvas viewport controls">
        <CanvasControlButton title="Zoom in" aria-label="Zoom in" disabled={!canZoomIn} onClick={() => zoomIn()}>
          <ZoomIn size={16} aria-hidden />
        </CanvasControlButton>
        <ButtonGroupSeparator />
        <CanvasControlButton title="Zoom out" aria-label="Zoom out" disabled={!canZoomOut} onClick={() => zoomOut()}>
          <ZoomOut size={16} aria-hidden />
        </CanvasControlButton>
        <ButtonGroupSeparator />
        <CanvasControlButton title="Fit view" aria-label="Fit view" onClick={() => fitView({ padding: 0.2 })}>
          <Maximize2 size={16} aria-hidden />
        </CanvasControlButton>
        <ButtonGroupSeparator />
        <CanvasControlButton
          title={isInteractive ? "Lock canvas" : "Unlock canvas"}
          aria-label={isInteractive ? "Lock canvas" : "Unlock canvas"}
          onClick={onToggleInteractive}
        >
          {isInteractive ? <Unlock size={16} aria-hidden /> : <Lock size={16} aria-hidden />}
        </CanvasControlButton>
      </ButtonGroup>
    </div>
  );
}

function CanvasControlButton({ className = "", ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="iconMd"
      className={["rounded-md text-foreground hover:bg-accent hover:text-accent-foreground", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
