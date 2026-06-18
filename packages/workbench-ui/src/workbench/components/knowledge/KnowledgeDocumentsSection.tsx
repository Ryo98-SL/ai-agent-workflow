import { useState } from "react";
import { FileText, Loader2, RefreshCcw, Trash2, Upload } from "lucide-react";
import { useProductLocale, useTranslation } from "@ai-agent-workflow/i18n";
import type { KnowledgeBaseDto, KnowledgeDocumentDto } from "@ai-agent-workflow/api-contracts";
import { Input } from "@workbench/components/ui/input";
import { Textarea } from "@workbench/components/ui/textarea";
import {
  useCreateFileKnowledgeDocument,
  useCreateTextKnowledgeDocument,
  useDeleteKnowledgeDocument,
  useKnowledgeBaseDocuments,
  useReindexKnowledgeDocument,
} from "../../../data/useKnowledgeBases";
import { WORKBENCH_I18N_NAMESPACE } from "../../../i18n";
import { formatWorkbenchDate } from "../../dateFormat";
import { Button } from "../Button";
import { LoadingRow, errorMessage } from "./shared";

/** Add-document panel plus the document list with status/reindex/delete, shared by detail + wizard. */
export function KnowledgeDocumentsSection({
  knowledgeBase,
  readOnly,
}: {
  knowledgeBase: KnowledgeBaseDto;
  readOnly: boolean;
}) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const documents = useKnowledgeBaseDocuments(knowledgeBase.id);
  const list = documents.data?.documents ?? [];

  return (
    <div className="space-y-5">
      {!readOnly && <AddDocumentPanel knowledgeBase={knowledgeBase} />}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("knowledge.documents.title")}
        </h3>
        <div className="space-y-2">
          {documents.isLoading && <LoadingRow />}
          {list.map((document) => (
            <DocumentRow key={document.id} knowledgeBaseId={knowledgeBase.id} document={document} readOnly={readOnly} />
          ))}
          {!documents.isLoading && list.length === 0 && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {readOnly ? t("knowledge.documents.emptyReadOnly") : t("knowledge.documents.emptyEditable")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function AddDocumentPanel({ knowledgeBase }: { knowledgeBase: KnowledgeBaseDto }) {
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const createText = useCreateTextKnowledgeDocument();
  const createFile = useCreateFileKnowledgeDocument();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const submitText = () => {
    if (!title.trim() || !content.trim()) return;
    createText.mutate(
      { knowledgeBaseId: knowledgeBase.id, request: { title: title.trim(), content, mimeType: "text/plain" } },
      {
        onSuccess: () => {
          setTitle("");
          setContent("");
        },
      },
    );
  };

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("knowledge.documents.addTitle")}
      </h3>
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t("knowledge.documents.titlePlaceholder")}
      />
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={t("knowledge.documents.contentPlaceholder")}
        className="min-h-24 resize-y"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="successSoft"
          size="sm"
          disabled={createText.isPending || !title.trim() || !content.trim()}
          onClick={submitText}
        >
          {createText.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <FileText size={14} aria-hidden />}
          {t("knowledge.documents.addText")}
        </Button>
        <label className="inline-flex">
          <input
            className="sr-only"
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            disabled={createFile.isPending}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              createFile.mutate({
                knowledgeBaseId: knowledgeBase.id,
                request: {
                  filename: file.name,
                  mimeType: file.name.endsWith(".md") ? "text/markdown" : "text/plain",
                  sizeBytes: file.size,
                  content: text,
                },
              });
              event.target.value = "";
            }}
          />
          <span className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground hover:bg-accent">
            {createFile.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
            {t("knowledge.documents.upload")}
          </span>
        </label>
      </div>
      {(createText.error || createFile.error) && (
        <p className="text-xs text-destructive">
          {errorMessage(createText.error ?? createFile.error, t("knowledge.requestFailed"))}
        </p>
      )}
    </section>
  );
}

function DocumentRow({
  knowledgeBaseId,
  document,
  readOnly,
}: {
  knowledgeBaseId: string;
  document: KnowledgeDocumentDto;
  readOnly: boolean;
}) {
  const { locale } = useProductLocale();
  const { t } = useTranslation(WORKBENCH_I18N_NAMESPACE);
  const deleteDocument = useDeleteKnowledgeDocument(knowledgeBaseId);
  const reindexDocument = useReindexKnowledgeDocument(knowledgeBaseId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
      <FileText size={16} className="shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{document.title}</p>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">{document.status}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {t("dates.charsUpdated", {
            count: document.characterCount.toLocaleString(locale),
            date: formatWorkbenchDate(document.updatedAt, { locale }),
          })}
        </p>
        {document.errorMessage && <p className="mt-1 text-xs text-destructive">{document.errorMessage}</p>}
      </div>
      {confirmingDelete ? (
        <>
          <span className="text-xs text-muted-foreground">{t("knowledge.documents.deleteConfirm")}</span>
          <Button
            variant="ghost"
            size="sm"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteDocument.isPending}
            onClick={() => deleteDocument.mutate(document.id)}
          >
            {deleteDocument.isPending && <Loader2 size={14} className="animate-spin" aria-hidden />}
            {t("knowledge.documents.delete")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
            {t("knowledge.documents.cancel")}
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="iconSm"
            disabled={readOnly || reindexDocument.isPending}
            onClick={() => reindexDocument.mutate(document.id)}
            aria-label={t("knowledge.documents.reindex")}
          >
            <RefreshCcw size={14} aria-hidden />
          </Button>
          <Button
            variant="dangerGhost"
            size="iconSm"
            disabled={readOnly}
            onClick={() => setConfirmingDelete(true)}
            aria-label={t("knowledge.documents.deleteAria")}
          >
            <Trash2 size={14} aria-hidden />
          </Button>
        </>
      )}
    </div>
  );
}
