'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-provider';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, FileText, Loader2, Paperclip, Upload } from 'lucide-react';

export type AttachmentEntity = 'invoices' | 'quotations' | 'payments' | 'expenses' | 'documents';

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
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function safeFileName(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-120) || 'attachment';
}

export function RecordAttachments({ entityType, entityId }: { entityType: AttachmentEntity; entityId: string }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('record_attachments')
      .select('id, entity_type, entity_id, file_name, object_path, content_type, size_bytes, uploaded_by, created_at')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Could not load attachments: ' + error.message);
    else setRows((data || []) as AttachmentRow[]);
    setLoading(false);
  }, [entityId, entityType]);

  useEffect(() => { void load(); }, [load]);

  const uploadFile = async (file?: File) => {
    if (!file || !profile) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Maximum attachment size is 20 MB.');
      return;
    }
    const allowed = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/csv',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!allowed.includes(file.type)) {
      toast.error('File type not allowed. Use PDF, image, text, CSV, Word or Excel.');
      return;
    }
    setUploading(true);
    const objectPath = `${entityType}/${entityId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage.from('record-attachments').upload(objectPath, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) {
      setUploading(false);
      toast.error('Upload failed: ' + uploadError.message);
      return;
    }
    const { error: rowError } = await supabase.from('record_attachments').insert({
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name,
      object_path: objectPath,
      content_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      uploaded_by: profile.id,
    });
    setUploading(false);
    if (rowError) {
      await supabase.storage.from('record-attachments').remove([objectPath]);
      toast.error('File uploaded but could not be linked: ' + rowError.message);
      return;
    }
    toast.success('Attachment uploaded');
    await load();
  };

  const download = async (row: AttachmentRow) => {
    setOpeningId(row.id);
    const { data, error } = await supabase.storage.from('record-attachments').createSignedUrl(row.object_path, 60);
    setOpeningId(null);
    if (error || !data?.signedUrl) {
      toast.error('Could not open attachment: ' + (error?.message || 'No signed URL returned'));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="rounded-xl border border-border/70 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Attachments</h3>
          <span className="text-xs text-muted-foreground">{rows.length}</span>
        </div>
        <label className="inline-flex cursor-pointer items-center">
          <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx" disabled={uploading} onChange={(e) => { void uploadFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          <span className="pointer-events-none inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            {uploading ? 'Uploading…' : 'Upload file'}
          </span>
        </label>
      </div>
      {loading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading attachments…</p> :
        rows.length === 0 ? <p className="text-xs text-muted-foreground">No attachments uploaded yet.</p> :
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.file_name}</p>
                <p className="text-xs text-muted-foreground">{(row.size_bytes / 1024).toFixed(0)} KB · {new Date(row.created_at).toLocaleDateString()}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Download ${row.file_name}`} disabled={openingId === row.id} onClick={() => void download(row)}>
                {openingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            </li>
          ))}
        </ul>}
      <p className="text-[11px] text-muted-foreground">Private files. Downloads use short-lived signed links and respect your record permissions. Maximum 20 MB per file.</p>
    </section>
  );
}
