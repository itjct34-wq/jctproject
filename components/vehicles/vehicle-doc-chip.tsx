'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  listRecordAttachments,
  openRecordAttachmentInNewTab,
  type AttachmentEntity,
  type AttachmentListItem,
} from '@/components/shared/record-attachments';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  entityType?: AttachmentEntity;
  entityId: string;
  label: string;
  docKinds?: string[];
  className?: string;
  /** Optional leading icon (e.g. DHL document pill). */
  icon?: ReactNode;
  /** When no attachment: navigate here instead of only toasting. */
  fallbackHref?: string;
  /**
   * When true with fallbackHref: navigate immediately (e.g. INV → invoice workspace)
   * instead of listing attachments first.
   */
  preferHref?: boolean;
  emptyMessage?: string;
};

export function VehicleDocChip({
  entityType = 'vehicles',
  entityId,
  label,
  docKinds,
  className,
  icon,
  fallbackHref,
  preferHref = false,
  emptyMessage,
}: Props) {
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

  const onChipClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    if (popoverOpen) {
      setPopoverOpen(false);
      return;
    }

    if (preferHref && fallbackHref) {
      router.push(fallbackHref);
      return;
    }

    if (files.length > 1) {
      setPopoverOpen(true);
      return;
    }

    setBusy(true);
    const attachments = await listRecordAttachments(entityType, entityId, {
      docKinds: docKinds?.length ? docKinds : undefined,
    });
    setBusy(false);

    if (attachments.length === 0) {
      setFiles([]);
      if (fallbackHref) {
        router.push(fallbackHref);
        return;
      }
      toast.error(emptyMessage || `No ${label} document attached`);
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
            'inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded px-2.5 py-1.5 text-xs font-bold uppercase',
            'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            'disabled:opacity-70',
            !className?.includes('text-') && 'text-white',
            className
          )}
          title={preferHref && fallbackHref ? `Open ${label}` : `View / download ${label}`}
          aria-label={preferHref && fallbackHref ? `Open ${label}` : `View / download ${label}`}
          disabled={busy}
          onClick={(e) => void onChipClick(e)}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              {icon}
              {label}
            </>
          )}
        </button>
      </PopoverAnchor>
      <PopoverContent className="w-64 p-2" align="center" onOpenAutoFocus={(ev) => ev.preventDefault()}>
        <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">{label} documents</p>
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
