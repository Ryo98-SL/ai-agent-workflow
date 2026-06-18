import { useEffect, useMemo, useState } from "react";
import { Database, Loader2, Plus, Trash2 } from "lucide-react";
import { useProductLocale, useTranslation } from "@ai-agent-workflow/i18n";
import type { KnowledgeBaseDto } from "@ai-agent-workflow/api-contracts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workbench/components/ui/dialog";
import { useSession } from "../../../data/useAccount";
import { useDeleteKnowledgeBase, useKnowledgeBases, useUpdateKnowledgeBase } from "../../../data/useKnowledgeBases";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";
import { Button } from "../Button";
import { CreateKnowledgeBaseDialog } from "./CreateKnowledgeBaseDialog";
import { KnowledgeDocumentsSection } from "./KnowledgeDocumentsSection";
import { KnowledgeMetadataFields } from "./KnowledgeMetadataFields";
import { KnowledgeSettingsFields } from "./KnowledgeSettingsFields";
import { LoadingRow, errorMessage } from "./shared";

type KnowledgeBasesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KnowledgeBasesDialog({ open, onOpenChange }: KnowledgeBasesDialogProps) {
  const { locale } = useProductLocale();
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const session = useSession();
  const isAuthed = Boolean(session.data?.user);
  const basesQuery = useKnowledgeBases();
  const bases = useMemo(() => basesQuery.data?.knowledgeBases ?? [], [basesQuery.data?.knowledgeBases]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const selected = useMemo(() => bases.find((base) => base.id === selectedId) ?? bases[0], [bases, selectedId]);

  useEffect(() => {
    if (!selectedId && bases[0]) setSelectedId(bases[0].id);
    if (selectedId && bases.length > 0 && !bases.some((base) => base.id === selectedId)) setSelectedId(bases[0].id);
  }, [bases, selectedId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden border-2 bg-card p-0 shadow-2xl shadow-black/40">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <DialogTitle>{t("knowledge.manage.title", { defaultValue: "Knowledge Bases" })}</DialogTitle>
          <DialogDescription>
            {t("knowledge.manage.description", { defaultValue: "Reusable content for workflow retrieval." })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
          <aside className="flex min-h-0 flex-col border-r border-border bg-muted/30 p-3">
            <Button variant="successSoft" size="md" fullWidth disabled={!isAuthed} onClick={() => setCreateOpen(true)}>
              <Plus size={15} aria-hidden />
              {t("knowledge.manage.add", { defaultValue: "Add knowledge base" })}
            </Button>
            {!isAuthed && (
              <p className="mt-2 shrink-0 text-xs text-muted-foreground">
                {t("knowledge.manage.signInToCreate", { defaultValue: "Sign in to create knowledge bases." })}
              </p>
            )}
            <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {basesQuery.isLoading && <LoadingRow />}
              {bases.map((base) => (
                <button
                  key={base.id}
                  type="button"
                  className={[
                    "flex w-full items-start gap-2 rounded-md border p-3 text-left transition-colors",
                    selected?.id === base.id ? "border-brand bg-brand/10" : "border-border bg-card hover:bg-accent",
                  ].join(" ")}
                  onClick={() => setSelectedId(base.id)}
                >
                  <Database size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{base.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t("knowledge.manage.docCount", {
                        defaultValue: "{{count}} docs",
                        count: base.documentCount,
                      })}{" "}
                      ·{" "}
                      {t("knowledge.manage.charCount", {
                        defaultValue: "{{count}} chars",
                        count: new Intl.NumberFormat(locale).format(base.characterCount),
                      })}
                    </span>
                  </span>
                  {base.readOnly && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                      {t("knowledge.manage.example", { defaultValue: "Example" })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>
          <section className="min-h-0 overflow-y-auto p-5">
            {selected ? (
              <KnowledgeBaseDetail knowledgeBase={selected} isAuthed={isAuthed} />
            ) : (
              <EmptyDetail isAuthed={isAuthed} onCreate={() => setCreateOpen(true)} />
            )}
          </section>
        </div>
      </DialogContent>
      <CreateKnowledgeBaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setCreateOpen(false);
          setSelectedId(id);
        }}
      />
    </Dialog>
  );
}

function EmptyDetail({ isAuthed, onCreate }: { isAuthed: boolean; onCreate: () => void }) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-10 text-center">
      <Database size={28} className="text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">
        {isAuthed
          ? t("knowledge.manage.emptyAuthed", { defaultValue: "No knowledge base yet." })
          : t("knowledge.manage.emptySignedOut", {
              defaultValue: "Sign in to create your own knowledge bases.",
            })}
      </p>
      {isAuthed && (
        <Button variant="successSoft" size="sm" onClick={onCreate}>
          <Plus size={15} aria-hidden />
          {t("knowledge.manage.add", { defaultValue: "Add knowledge base" })}
        </Button>
      )}
    </div>
  );
}

function KnowledgeBaseDetail({ knowledgeBase, isAuthed }: { knowledgeBase: KnowledgeBaseDto; isAuthed: boolean }) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const updateBase = useUpdateKnowledgeBase();
  const deleteBase = useDeleteKnowledgeBase();
  const readOnly = knowledgeBase.readOnly || !isAuthed;
  const [name, setName] = useState(knowledgeBase.name);
  const [description, setDescription] = useState(knowledgeBase.description ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setName(knowledgeBase.name);
    setDescription(knowledgeBase.description ?? "");
    setConfirmingDelete(false);
  }, [knowledgeBase.id, knowledgeBase.name, knowledgeBase.description]);

  // Close the delete popover on Escape before the parent dialog handles it.
  useEffect(() => {
    if (!confirmingDelete) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      setConfirmingDelete(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [confirmingDelete]);

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <KnowledgeMetadataFields
          idPrefix="kb-detail"
          name={name}
          description={description}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          disabled={readOnly}
        />
        {!readOnly && (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              variant="success"
              size="sm"
              disabled={updateBase.isPending || !name.trim()}
              onClick={() =>
                updateBase.mutate({ id: knowledgeBase.id, request: { name: name.trim(), description: description || null } })
              }
            >
              {updateBase.isPending && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {t("knowledge.manage.save", { defaultValue: "Save" })}
            </Button>
            <div className="relative">
              <Button
                variant="dangerGhost"
                size="sm"
                aria-haspopup="dialog"
                aria-expanded={confirmingDelete}
                onClick={() => setConfirmingDelete((value) => !value)}
              >
                <Trash2 size={15} aria-hidden />
                {t("knowledge.manage.delete", { defaultValue: "Delete" })}
              </Button>
              {confirmingDelete && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setConfirmingDelete(false)}
                  />
                  <div
                    role="dialog"
                    aria-label={t("knowledge.manage.confirmDeleteAria", {
                      defaultValue: "Confirm delete knowledge base",
                    })}
                    className="absolute right-0 top-full z-50 mt-2 w-64 rounded-md border border-border bg-popover p-3 text-left shadow-xl shadow-black/40"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {t("knowledge.manage.confirmDeleteTitle", { defaultValue: "Delete this knowledge base?" })}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("knowledge.manage.confirmDeleteDescription", {
                        defaultValue: "This permanently removes the knowledge base and all its documents.",
                      })}
                    </p>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                        {t("knowledge.manage.cancel", { defaultValue: "Cancel" })}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteBase.isPending}
                        onClick={() => deleteBase.mutate(knowledgeBase.id)}
                      >
                        {deleteBase.isPending && <Loader2 size={15} className="animate-spin" aria-hidden />}
                        {t("knowledge.manage.delete", { defaultValue: "Delete" })}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {(updateBase.error || deleteBase.error) && (
          <p className="text-xs text-destructive">{errorMessage(updateBase.error ?? deleteBase.error)}</p>
        )}
      </div>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("knowledge.manage.settings", { defaultValue: "Settings" })}
        </h3>
        <KnowledgeSettingsFields mode="read" settings={knowledgeBase.settings} />
      </section>

      <KnowledgeDocumentsSection knowledgeBase={knowledgeBase} readOnly={readOnly} />
    </div>
  );
}
