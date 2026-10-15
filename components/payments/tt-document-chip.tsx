'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  listRecordAttachments,
  openRecordAttachmentInNewTab,
  type AttachmentListItem,
} from '@/components/shared/record-attachments';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  paymentId: string;
  /** When true and no file is attached, navigate to edit so the user can upload. */
  canEdit?: boolean;
};

export function TtDocumentChip({ paymentId, canEdit = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<AttachmentListItem[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const openFile = async (row: AttachmentListItem) => {
    setOpeningId(row.id);
    await openRecordAttachmentInNewTab(row.object_path);
    setOpeningId(null);
  };

  const onChipClick = async () => {
    if (busy) return;

    if (popoverOpen) {
      setPopoverOpen(false);
      return;
    }
    if (files.length > 1) {
      setPopoverOpen(true);
      return;
    }

    setBusy(true);
    const attachments = await listRecordAttachments('payments', paymentId);
    setBusy(false);

    if (attachments.length === 0) {
      setFiles([]);
      toast.error('No TT document attached');
      if (canEdit) router.push(`/payments/${paymentId}/edit`);
      return;
    }

    if (attachments.length === 1) {
      setFiles(attachments);
      setBusy(true);
      await openFile(attachments[0]);
      setBusy(false);
      return;
    }

    setFiles(attachments);
    setPopoverOpen(true);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 min-w-[2rem] items-center justify-center rounded bg-red-600 px-1.5 text-[11px] font-bold text-white',
            'transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40',
            'disabled:opacity-70',
          )}
          title="View TT document"
          aria-label="View TT document"
          disabled={busy}
          onClick={() => void onChipClick()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'TT'}
        </button>
      </PopoverAnchor>
      <PopoverContent className="w-64 p-2" align="center" onOpenAutoFocus={(e) => e.preventDefault()}>
        <p className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">TT documents</p>
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                disabled={openingId === file.id}
                onClick={() => void openFile(file)}
              >
                {openingId === file.id ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{file.file_name}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
