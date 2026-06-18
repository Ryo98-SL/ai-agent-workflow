import { useState } from "react";
import { useTranslation } from "@ai-agent-workflow/i18n";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Popover,
  useDeleteWorkflow,
  useDuplicateWorkflow,
  useUpdateWorkflowMeta,
  WorkflowMetaEditor,
} from "@ai-agent-workflow/workbench-ui";
import { Copy, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { StudioWorkflowCard } from "./types";

type WorkflowCardActionsProps = {
  workflow: StudioWorkflowCard;
  onActionError: (message: string | null) => void;
};

export function WorkflowCardActions({ workflow, onActionError }: WorkflowCardActionsProps) {
  const { t } = useTranslation("web");
  const duplicateWorkflow = useDuplicateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const updateWorkflowMeta = useUpdateWorkflowMeta();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const busy = duplicateWorkflow.isPending || deleteWorkflow.isPending || updateWorkflowMeta.isPending;

  async function handleDuplicate() {
    if (busy) {
      return;
    }

    onActionError(null);
    try {
      await duplicateWorkflow.mutateAsync({
        id: workflow.id,
        name: t("homepage.studio.duplicateName", { name: workflow.name }),
      });
      setMenuOpen(false);
    } catch (error) {
      onActionError(error instanceof Error ? error.message : t("homepage.studio.duplicateError"));
    }
  }

  async function handleDelete() {
    if (deleteWorkflow.isPending) {
      return;
    }

    onActionError(null);
    try {
      await deleteWorkflow.mutateAsync(workflow.id);
      setConfirmOpen(false);
    } catch (error) {
      onActionError(error instanceof Error ? error.message : t("homepage.studio.deleteError"));
    }
  }

  async function handleSaveMeta(patch: { name?: string; description?: string; icon?: string }) {
    onActionError(null);
    try {
      await updateWorkflowMeta.mutateAsync({ id: workflow.id, patch });
      return true;
    } catch (error) {
      onActionError(error instanceof Error ? error.message : t("homepage.studio.editInfoError"));
      return false;
    }
  }

  const active = menuOpen || confirmOpen || editOpen;
  const revealClassName = active ? "opacity-100" : "opacity-0";
  const activeButtonClassName = active ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-card/90 text-muted-foreground";

  return (
    <>
      <Popover
        open={menuOpen}
        onOpenChange={(nextOpen) => {
          setMenuOpen(nextOpen);
          if (!nextOpen) {
            setEditOpen(false);
          }
        }}
        placement="bottom-end"
        offset={8}
        renderTrigger={({ ref, props }) => (
          <Button
            {...props}
            ref={ref}
            variant="ghost"
            size="iconMd"
            className={[
              "absolute bottom-4 right-4 z-20 size-9 rounded-lg border shadow-sm backdrop-blur transition-opacity hover:!bg-transparent hover:!text-muted-foreground focus-visible:opacity-100 group-hover/card:opacity-100 group-focus-within/card:opacity-100",
              activeButtonClassName,
              revealClassName,
            ].join(" ")}
            aria-label={t("homepage.studio.cardMenuAria", { name: workflow.name })}
            title={t("homepage.studio.cardMenu")}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMenuOpen((open) => !open);
            }}
          >
            <MoreHorizontal size={18} aria-hidden />
          </Button>
        )}
      >
        <div className="w-48 overflow-hidden rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-xl shadow-black/20">
          <WorkflowMetaEditor
            metadata={{ name: workflow.name, description: workflow.description, icon: workflow.icon }}
            onSaveMeta={handleSaveMeta}
            open={editOpen}
            onOpenChange={setEditOpen}
            placement="left-start"
            renderTrigger={({ ref, props, open, setOpen }) => (
              <button
                {...props}
                ref={ref}
                type="button"
                className="flex h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={(event) => {
                  props.onClick?.(event);
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(!open);
                }}
              >
                {updateWorkflowMeta.isPending ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                ) : (
                  <Pencil size={15} aria-hidden />
                )}
                {t("homepage.studio.editInfo")}
              </button>
            )}
          />
          <button
            type="button"
            className="flex h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void handleDuplicate();
            }}
          >
            {duplicateWorkflow.isPending ? (
              <Loader2 size={15} className="animate-spin" aria-hidden />
            ) : (
              <Copy size={15} aria-hidden />
            )}
            {t("homepage.studio.duplicate")}
          </button>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className="flex h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
          >
            <Trash2 size={15} aria-hidden />
            {t("homepage.studio.delete")}
          </button>
        </div>
      </Popover>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("homepage.studio.deleteConfirmTitle", { name: workflow.name })}</DialogTitle>
            <DialogDescription>{t("homepage.studio.deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={deleteWorkflow.isPending}>
              {t("homepage.studio.cancel")}
            </Button>
            <Button variant="dangerGhost" onClick={() => void handleDelete()} disabled={deleteWorkflow.isPending}>
              {deleteWorkflow.isPending && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {t("homepage.studio.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
