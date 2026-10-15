'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ExternalLink, Eye, FileText, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';

export type AttachmentEntity = 'invoices' | 'quotations' | 'payments' | 'expenses' | 'documents' | 'vehicles';

type AttachmentRow = {
  id: string;
  entity_type: AttachmentEntity;
  entity_id: string;
  file_name: string;
  object_path: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
  doc_kind?: string | null;
};

type PreviewState = { url: string; fileName: string; kind: 'image' | 'pdf' };

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_SECONDS = 300;

function safeFileName(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-120) || 'attachment';
}

const ALLOWED_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const UPLOAD_LABELS: Record<AttachmentEntity, string> = {
  payments: 'Upload receipt / document',
  expenses: 'Upload receipt / document',
  documents: 'Upload document',
  invoices: 'Upload file',
  quotations: 'Upload file',
  vehicles: 'Upload courier / shipping document',
};

function previewKind(contentType: string): 'image' | 'pdf' | null {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  return null;
}

async function createSignedUrl(objectPath: string) {
  const { data, error } = await supabase.storage.from('record-attachments').createSignedUrl(objectPath, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    toast.error('Could not open attachment: ' + (error?.message || 'No signed URL returned'));
    return null;
  }
  return data.signedUrl;
}

export type AttachmentListItem = {
  id: string;
  file_name: string;
  object_path: string;
  content_type: string;
  created_at: string;
  doc_kind?: string | null;
};

/** List attachments for a record (newest first). Toasts and returns [] on error. */
export async function listRecordAttachments(
  entityType: AttachmentEntity,
  entityId: string,
  opts?: { docKinds?: string[] }
): Promise<AttachmentListItem[]> {
  let query = supabase
    .from('record_attachments')
    .select('id, file_name, object_path, content_type, created_at, doc_kind')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  if (opts?.docKinds?.length) {
    query = query.in('doc_kind', opts.docKinds);
  }
  const { data, error } = await query;
  if (error) {
    toast.error('Could not load attachments: ' + error.message);
    return [];
  }
  return (data || []) as AttachmentListItem[];
}

/** Open an attachment via short-lived signed URL in a new tab (same as View → Open). */
export async function openRecordAttachmentInNewTab(objectPath: string): Promise<boolean> {
  const url = await createSignedUrl(objectPath);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/** Upload a file to the private bucket and link it to a record. Returns true on success (toasts on failure). */
export async function uploadRecordAttachment(
  entityType: AttachmentEntity,
  entityId: string,
  file: File,
  userId: string,
  opts?: { docKind?: string }
): Promise<boolean> {
  if (file.size > MAX_FILE_BYTES) { toast.error('Maximum attachment size is 20 MB.'); return false; }
  if (!ALLOWED_TYPES.includes(file.type)) { toast.error('File type not allowed. Use PDF, image, text, CSV, Word or Excel.'); return false; }
  const objectPath = `${entityType}/${entityId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from('record-attachments').upload(objectPath, file, { contentType: file.type, cacheControl: '3600', upsert: false });
  if (uploadError) { toast.error('Upload failed: ' + uploadError.message); return false; }
  const { error: rowError } = await supabase.from('record_attachments').insert({
    entity_type: entityType, entity_id: entityId, file_name: file.name, object_path: objectPath,
    content_type: file.type || 'application/octet-stream', size_bytes: file.size, uploaded_by: userId,
    ...(opts?.docKind ? { doc_kind: opts.docKind } : {}),
  });
  if (rowError) {
    await supabase.storage.from('record-attachments').remove([objectPath]);
    toast.error('File uploaded but could not be linked: ' + rowError.message);
    return false;
  }
  return true;
}

/**
 * Remove attachment from private storage then delete the `record_attachments` row.
 * Storage delete RLS requires the row to still exist, so storage is removed first.
 */
export async function deleteRecordAttachment(id: string, objectPath: string): Promise<boolean> {
  const { error: storageError } = await supabase.storage.from('record-attachments').remove([objectPath]);
  if (storageError) {
    toast.error('Could not delete file: ' + storageError.message);
    return false;
  }
  const { error: rowError } = await supabase.from('record_attachments').delete().eq('id', id);
  if (rowError) {
    toast.error('File removed but record could not be deleted: ' + rowError.message);
    return false;
  }
  return true;
}

export function useAttachmentCounts(entityType: AttachmentEntity, entityIds: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const idsKey = entityIds.join(',');

  const load = useCallback(async () => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) {
      setCounts({});
      return;
    }
    const { data, error } = await supabase
      .from('record_attachments')
      .select('entity_id')
      .eq('entity_type', entityType)
      .in('entity_id', ids);
    if (error) return;
    const next: Record<string, number> = {};
    for (const row of data || []) {
      next[row.entity_id] = (next[row.entity_id] || 0) + 1;
    }
    setCounts(next);
  }, [entityType, idsKey]);

  useEffect(() => { void load(); }, [load]);

  const setCount = useCallback((entityId: string, count: number) => {
    setCounts((prev) => ({ ...prev, [entityId]: count }));
  }, []);

  return { counts, setCount, reload: load };
}

export function AttachmentCountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 text-[11px] font-medium text-foreground"
      title={`${count} attached file${count === 1 ? '' : 's'}`}
    >
      <Paperclip className="h-3 w-3" />
      {count}
    </span>
  );
}

export function RecordAttachments({
  entityType,
  entityId,
  onCountChange,
  onChanged,
  allowUpload = true,
  allowDelete = allowUpload,
  embedded = false,
  emptyLabel,
}: {
  entityType: AttachmentEntity;
  entityId: string;
  onCountChange?: (count: number) => void;
  /** Fired after a successful upload or delete (e.g. refresh stock doc chips). */
  onChanged?: () => void;
  /** When false, users can view/download only (e.g. sales viewing vehicle courier docs). */
  allowUpload?: boolean;
  /** When false, hide delete controls. Defaults to `allowUpload`. */
  allowDelete?: boolean;
  embedded?: boolean;
  /** When set, empty state is a short line instead of the large dashed dropzone. */
  emptyLabel?: string;
}) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AttachmentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const uploadLabel = UPLOAD_LABELS[entityType];
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('record_attachments')
      .select('id, entity_type, entity_id, file_name, object_path, content_type, size_bytes, uploaded_by, created_at, doc_kind')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Could not load attachments: ' + error.message);
    else {
      const next = (data || []) as AttachmentRow[];
      setRows(next);
      onCountChangeRef.current?.(next.length);
    }
    setLoading(false);
  }, [entityId, entityType]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPreview(null); }, [entityId]);

  const uploadFile = async (file?: File) => {
    if (!file || !profile) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Maximum attachment size is 20 MB.');
      return;
    }
    setUploading(true);
    const ok = await uploadRecordAttachment(entityType, entityId, file, profile.id);
    setUploading(false);
    if (!ok) return;
    toast.success('Attachment uploaded');
    await load();
    onChangedRef.current?.();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const ok = await deleteRecordAttachment(pendingDelete.id, pendingDelete.object_path);
    setDeleting(false);
    if (!ok) return;
    if (preview?.fileName === pendingDelete.file_name) setPreview(null);
    setPendingDelete(null);
    toast.success('Attachment deleted');
    await load();
    onChangedRef.current?.();
  };

  const viewFile = async (row: AttachmentRow) => {
    setOpeningId(row.id);
    const url = await createSignedUrl(row.object_path);
    setOpeningId(null);
    if (!url) return;
    const kind = previewKind(row.content_type);
    if (kind) setPreview({ url, fileName: row.file_name, kind });
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openInNewTab = async (row: AttachmentRow) => {
    setOpeningId(row.id);
    const url = await createSignedUrl(row.object_path);
    setOpeningId(null);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const fileInput = (
    <label className="inline-flex cursor-pointer items-center">
      <input
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
        disabled={uploading}
        onChange={(e) => { void uploadFile(e.target.files?.[0]); e.currentTarget.value = ''; }}
      />
      <span className="pointer-events-none inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
        {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
        {uploading ? 'Uploading…' : uploadLabel}
      </span>
    </label>
  );

  const compactEmpty = Boolean(emptyLabel) || !allowUpload;

  return (
    <section className={embedded ? 'space-y-3' : 'mt-4 space-y-3 rounded-xl border border-border p-4'}>
      {!compactEmpty || rows.length > 0 || allowUpload ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Attached files</h3>
              {!loading && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {rows.length}
                </span>
              )}
            </div>
            {!compactEmpty ? (
              <p className="mt-1 text-xs text-muted-foreground">Receipts, PDFs, and photos for this record. Click View to open.</p>
            ) : null}
          </div>
          {allowUpload && rows.length > 0 ? fileInput : null}
        </div>
      ) : null}

      {preview && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{preview.fileName}</p>
            <div className="flex shrink-0 gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => window.open(preview.url, '_blank', 'noopener,noreferrer')}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPreview(null)}>Close</Button>
            </div>
          </div>
          {preview.kind === 'image' ? (
            <img src={preview.url} alt={preview.fileName} className="max-h-80 w-full rounded-md bg-background object-contain" />
          ) : (
            <iframe title={preview.fileName} src={preview.url} className="h-80 w-full rounded-md bg-background" />
          )}
        </div>
      )}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading attached files…</p>
      ) : rows.length === 0 ? (
        emptyLabel || !allowUpload ? (
          <p className="text-sm text-muted-foreground">{emptyLabel || 'No documents.'}</p>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm font-medium">No file attached yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Upload a receipt or document here, then use View to open it.</p>
            <div className="mt-3 flex justify-center">{fileInput}</div>
          </div>
        )
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/40 p-3">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.file_name}</p>
                <p className="text-xs text-muted-foreground">{row.doc_kind ? `${row.doc_kind} · ` : ''}{(row.size_bytes / 1024).toFixed(0)} KB · {new Date(row.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" size="sm" disabled={openingId === row.id} onClick={() => void viewFile(row)}>
                  {openingId === row.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                  View
                </Button>
                <Button type="button" size="sm" variant="outline" aria-label={`Open ${row.file_name} in a new tab`} disabled={openingId === row.id} onClick={() => void openInNewTab(row)}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                {allowDelete ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Delete ${row.file_name}`}
                    disabled={deleting}
                    onClick={() => setPendingDelete(row)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!compactEmpty || rows.length > 0 ? (
        <p className="text-[11px] text-muted-foreground">Private files. View uses a short-lived signed link and respects your record permissions. Maximum 20 MB per file.</p>
      ) : null}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (
                <>
                  <span className="block font-medium text-foreground">{pendingDelete.file_name}</span>
                  <span className="mt-2 block">This removes the file from storage. This cannot be undone.</span>
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
