import { useEffect, useState, type FormEvent } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Plus, SlidersHorizontal } from "lucide-react";
import type { KnowledgeBaseDto } from "@ai-agent-workflow/api-contracts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workbench/components/ui/dialog";
import { useCreateKnowledgeBase, useKnowledgeBaseDocuments } from "../../../data/useKnowledgeBases";
import { Button } from "../Button";
import { KnowledgeDocumentsSection } from "./KnowledgeDocumentsSection";
import { KnowledgeMetadataFields } from "./KnowledgeMetadataFields";
import {
  DEFAULT_EDITABLE_SETTINGS,
  KnowledgeSettingsFields,
  type EditableKnowledgeSettings,
} from "./KnowledgeSettingsFields";
import { errorMessage } from "./shared";

type CreateKnowledgeBaseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
};

/**
 * Two-step KB creation wizard. Step 1 collects metadata + tuning settings and creates
 * the KB; step 2 attaches documents to the freshly created KB. Layered above the parent
 * KnowledgeBasesDialog via an elevated overlay/content z-index.
 */
export function CreateKnowledgeBaseDialog({ open, onOpenChange, onCreated }: CreateKnowledgeBaseDialogProps) {
  const createBase = useCreateKnowledgeBase();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [settings, setSettings] = useState<EditableKnowledgeSettings>(DEFAULT_EDITABLE_SETTINGS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createdBase, setCreatedBase] = useState<KnowledgeBaseDto | null>(null);
  const createdDocuments = useKnowledgeBaseDocuments(createdBase?.id);
  const hasDocuments = (createdDocuments.data?.documents.length ?? 0) > 0;

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setSettings(DEFAULT_EDITABLE_SETTINGS);
      setAdvancedOpen(false);
      setCreatedBase(null);
      createBase.reset();
    }
  }, [open]);

  const step = createdBase ? 2 : 1;

  const handleOpenChange = (next: boolean) => {
    // Closing after the KB was created should still surface/select it in the parent list.
    if (!next && createdBase) {
      onCreated(createdBase.id);
      return;
    }
    onOpenChange(next);
  };

  const submitStep1 = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    createBase.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        settings: {
          chunking: { chunkSize: settings.chunkSize, chunkOverlap: settings.chunkOverlap },
          retrieval: { topK: settings.topK, scoreThreshold: settings.scoreThreshold },
        },
      },
      { onSuccess: ({ knowledgeBase }) => setCreatedBase(knowledgeBase) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="z-[210]"
        className="z-[211] flex max-h-[85vh] w-full max-w-md flex-col gap-0 overflow-hidden border-2 bg-card p-0 shadow-2xl shadow-black/40"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <StepDot active={step === 1} done={step > 1} label="1" />
            <span className={step === 1 ? "text-brand" : ""}>Details</span>
            <span className="h-px w-4 bg-border" aria-hidden />
            <StepDot active={step === 2} done={false} label="2" />
            <span className={step === 2 ? "text-brand" : ""}>Documents</span>
          </div>
          {step === 1 ? (
            <>
              <DialogTitle>New knowledge base</DialogTitle>
              <DialogDescription>Name it and tune retrieval, then add documents.</DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="truncate">{createdBase?.name}</DialogTitle>
              <DialogDescription>Add documents now, or finish and add them later.</DialogDescription>
            </>
          )}
        </DialogHeader>

        {step === 1 ? (
          <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submitStep1}>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <KnowledgeMetadataFields
                idPrefix="kb-new"
                name={name}
                description={description}
                onNameChange={setName}
                onDescriptionChange={setDescription}
                autoFocus
              />
              <div className="rounded-md border border-border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setAdvancedOpen((value) => !value)}
                  aria-expanded={advancedOpen}
                >
                  {advancedOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                  <SlidersHorizontal size={14} aria-hidden />
                  Advanced settings
                </button>
                {advancedOpen && (
                  <div className="border-t border-border p-3">
                    <KnowledgeSettingsFields mode="edit" value={settings} onChange={setSettings} />
                  </div>
                )}
              </div>
              {createBase.error && <p className="text-xs text-destructive">{errorMessage(createBase.error)}</p>}
            </div>
            <DialogFooter className="shrink-0 border-t border-border p-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="success" size="sm" disabled={!name.trim() || createBase.isPending}>
                {createBase.isPending ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                ) : (
                  <Plus size={15} aria-hidden />
                )}
                Create &amp; continue
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {createdBase && <KnowledgeDocumentsSection knowledgeBase={createdBase} readOnly={false} />}
            </div>
            <DialogFooter className="shrink-0 items-center border-t border-border p-4 sm:justify-between">
              <span className="text-xs text-muted-foreground">
                {hasDocuments ? "" : "Add at least one document to finish."}
              </span>
              <Button
                type="button"
                variant="success"
                size="sm"
                disabled={!hasDocuments}
                onClick={() => createdBase && onCreated(createdBase.id)}
              >
                <Check size={15} aria-hidden />
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={[
        "flex size-5 items-center justify-center rounded-full text-[10px]",
        done
          ? "bg-brand text-brand-foreground"
          : active
            ? "bg-brand text-brand-foreground"
            : "bg-muted text-muted-foreground",
      ].join(" ")}
      aria-hidden
    >
      {done ? <Check size={12} /> : label}
    </span>
  );
}
