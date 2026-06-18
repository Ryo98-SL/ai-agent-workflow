import { type FormEvent, useEffect, useState } from "react";
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
  useDeleteKnowledgeBase,
  useUpdateKnowledgeBase,
} from "@ai-agent-workflow/workbench-ui";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { KnowledgeBaseCard } from "./types";

type KnowledgeBaseCardActionsProps = {
  knowledgeBase: KnowledgeBaseCard;
  onActionError: (message: string | null) => void;
};

export function KnowledgeBaseCardActions({ knowledgeBase, onActionError }: KnowledgeBaseCardActionsProps) {
  const { t } = useTranslation("web");
  const updateKnowledgeBase = useUpdateKnowledgeBase();
  const deleteKnowledgeBase = useDeleteKnowledgeBase();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(knowledgeBase.name);
  const [description, setDescription] = useState(knowledgeBase.description ?? "");
  const busy = updateKnowledgeBase.isPending || deleteKnowledgeBase.isPending;
  const readOnly = knowledgeBase.readOnly;

  useEffect(() => {
    setName(knowledgeBase.name);
    setDescription(knowledgeBase.description ?? "");
  }, [knowledgeBase.id, knowledgeBase.name, knowledgeBase.description]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || readOnly || !name.trim()) {
      return;
    }

    onActionError(null);
    try {
      await updateKnowledgeBase.mutateAsync({
        id: knowledgeBase.id,
        request: {
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
        },
      });
      setEditOpen(false);
    } catch (error) {
      onActionError(error instanceof Error ? error.message : t("homepage.knowledge.editInfoError"));
    }
  }

  async function handleDelete() {
    if (deleteKnowledgeBase.isPending || readOnly) {
      return;
    }

    onActionError(null);
    try {
      await deleteKnowledgeBase.mutateAsync(knowledgeBase.id);
      setConfirmOpen(false);
    } catch (error) {
      onActionError(error instanceof Error ? error.message : t("homepage.knowledge.deleteError"));
    }
  }

  const active = menuOpen || confirmOpen || editOpen;
  const revealClassName = active ? "opacity-100" : "opacity-0";
  const activeButtonClassName = active ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-card/90 text-muted-foreground";

  return (
    <>
      <Popover
        open={menuOpen}
        onOpenChange={setMenuOpen}
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
            aria-label={t("homepage.knowledge.cardMenuAria", { name: knowledgeBase.name })}
            title={t("homepage.knowledge.cardMenu")}
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
          <button
            type="button"
            className="flex h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || readOnly}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMenuOpen(false);
              setEditOpen(true);
            }}
          >
            {updateKnowledgeBase.isPending ? (
              <Loader2 size={15} className="animate-spin" aria-hidden />
            ) : (
              <Pencil size={15} aria-hidden />
            )}
            {t("homepage.knowledge.editInfo")}
          </button>
          {readOnly && (
            <p className="px-3 pb-2 text-xs font-medium leading-5 text-muted-foreground">
              {t("homepage.knowledge.readOnlyActionHint")}
            </p>
          )}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            className="flex h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || readOnly}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
          >
            <Trash2 size={15} aria-hidden />
            {t("homepage.knowledge.delete")}
          </button>
        </div>
      </Popover>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={(event) => void handleSave(event)}>
            <DialogHeader>
              <DialogTitle>{t("homepage.knowledge.editInfoTitle")}</DialogTitle>
              <DialogDescription>{t("homepage.knowledge.editInfoDescription")}</DialogDescription>
            </DialogHeader>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-foreground">
                {t("homepage.knowledge.nameLabel")}
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={busy || readOnly}
                  autoFocus
                  className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <label className="block text-sm font-semibold text-foreground">
                {t("homepage.knowledge.descriptionLabel")}
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={busy || readOnly}
                  className="mt-2 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-medium leading-6 text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
            </div>
            <DialogFooter className="mt-5">
              <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={busy}>
                {t("homepage.knowledge.cancel")}
              </Button>
              <Button variant="success" type="submit" disabled={busy || readOnly || !name.trim()}>
                {updateKnowledgeBase.isPending && <Loader2 size={15} className="animate-spin" aria-hidden />}
                {t("homepage.knowledge.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("homepage.knowledge.deleteConfirmTitle", { name: knowledgeBase.name })}</DialogTitle>
            <DialogDescription>{t("homepage.knowledge.deleteConfirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={deleteKnowledgeBase.isPending}>
              {t("homepage.knowledge.cancel")}
            </Button>
            <Button
              variant="dangerGhost"
              onClick={() => void handleDelete()}
              disabled={deleteKnowledgeBase.isPending || readOnly}
            >
              {deleteKnowledgeBase.isPending && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {t("homepage.knowledge.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
