'use client';

import { useState } from 'react';
import { ChevronDown, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  listRecordAttachments,
  openRecordAttachmentInNewTab,
  type AttachmentListItem,
} from '@/components/shared/record-attachments';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type VehicleRemittanceRef = {
  paymentId: string;
  paymentCode: string;
  amount: number;
  currency: string;
  /** Present when the row comes from payment_allocations (required for per-vehicle deallocate). */
  allocationId?: string;
};

type Props = {
  remittances: VehicleRemittanceRef[];
  allocatedLabel?: string;
  /** When set, each row with allocationId shows Deallocate (this vehicle only). */
  canDeallocate?: boolean;
  onDeallocate?: (row: VehicleRemittanceRef) => void;
};

async function openPaymentTt(paymentId: string, paymentCode: string) {
  const attachments = await listRecordAttachments('payments', paymentId);
  if (attachments.length === 0) {
    toast.error(`No TT document on ${paymentCode}`);
    return;
  }
  if (attachments.length === 1) {
    await openRecordAttachmentInNewTab(attachments[0].object_path);
    return attachments;
  }
  return attachments;
}

/** TT chip: opens the single remittance TT, or lists remittances / files when several. */
export function VehicleTtChip({ remittances }: { remittances: VehicleRemittanceRef[] }) {
  const [busy, setBusy] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [files, setFiles] = useState<AttachmentListItem[]>([]);
  const [mode, setMode] = useState<'remits' | 'files'>('remits');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy || remittances.length === 0) return;
    if (popoverOpen) {
      setPopoverOpen(false);
      return;
    }

    if (remittances.length === 1) {
      setBusy(true);
      const result = await openPaymentTt(remittances[0].paymentId, remittances[0].paymentCode);
      setBusy(false);
      if (Array.isArray(result) && result.length > 1) {
        setFiles(result);
        setMode('files');
        setPopoverOpen(true);
      }
      return;
    }

    setMode('remits');
    setPopoverOpen(true);
  };

  const openRemit = async (row: VehicleRemittanceRef) => {
    setOpeningId(row.paymentId);
    const result = await openPaymentTt(row.paymentId, row.paymentCode);
    setOpeningId(null);
    if (Array.isArray(result) && result.length > 1) {
      setFiles(result);
      setMode('files');
    } else {
      setPopoverOpen(false);
    }
  };

  if (!remittances.length) return null;

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded bg-violet-600 px-1.5 text-[10px] font-bold uppercase text-white',
            'transition-colors hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600/40',
            'disabled:opacity-70'
          )}
          title="View TT document"
          aria-label="View TT document"
          disabled={busy}
          onClick={(e) => void onClick(e)}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : 'TT'}
        </button>
      </PopoverAnchor>
      <PopoverContent className="w-72 p-2" align="center" onOpenAutoFocus={(ev) => ev.preventDefault()}>
        {mode === 'files' ? (
          <>
            <p className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">TT documents</p>
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                    disabled={openingId === file.id}
                    onClick={() => {
                      setOpeningId(file.id);
                      void openRecordAttachmentInNewTab(file.object_path).finally(() => setOpeningId(null));
                    }}
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
          </>
        ) : (
          <>
            <p className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">Remittances · open TT</p>
            <ul className="space-y-1">
              {remittances.map((row) => (
                <li key={row.paymentId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                    disabled={openingId === row.paymentId}
                    onClick={() => void openRemit(row)}
                  >
                    <span className="font-semibold text-violet-700">{row.paymentCode}</span>
                    {openingId === row.paymentId ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Dropdown listing remittance codes; each row opens that payment's TT attachment. */
export function VehicleRemittancePopover({
  remittances,
  allocatedLabel,
  canDeallocate = false,
  onDeallocate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [files, setFiles] = useState<AttachmentListItem[]>([]);
  const [fileMode, setFileMode] = useState(false);

  if (!remittances.length) return null;

  const openRemit = async (row: VehicleRemittanceRef) => {
    setOpeningId(row.paymentId);
    const result = await openPaymentTt(row.paymentId, row.paymentCode);
    setOpeningId(null);
    if (Array.isArray(result) && result.length > 1) {
      setFiles(result);
      setFileMode(true);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFileMode(false);
      }}
    >
      <PopoverAnchor asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          {remittances.length} remittance{remittances.length === 1 ? '' : 's'}
          {allocatedLabel ? ` · ${allocatedLabel}` : ''}
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverAnchor>
      <PopoverContent className="w-80 p-2" align="end" onOpenAutoFocus={(ev) => ev.preventDefault()}>
        {fileMode ? (
          <>
            <p className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">TT documents</p>
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                    disabled={openingId === file.id}
                    onClick={() => {
                      setOpeningId(file.id);
                      void openRecordAttachmentInNewTab(file.object_path).finally(() => setOpeningId(null));
                    }}
                  >
                    {openingId === file.id ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{file.file_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">
              Remittances{canDeallocate ? ' · open TT or deallocate from this stock' : ''}
            </p>
            <ul className="space-y-1">
              {remittances.map((row) => (
                <li key={row.allocationId || row.paymentId} className="rounded-md hover:bg-muted">
                  <div className="flex items-center gap-1 px-1 py-0.5">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left text-xs"
                      disabled={openingId === row.paymentId}
                      onClick={() => void openRemit(row)}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold text-violet-700">{row.paymentCode}</span>
                        <span className="ml-1.5 text-muted-foreground">
                          {row.currency} {row.amount.toLocaleString()}
                        </span>
                      </span>
                      {openingId === row.paymentId ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {canDeallocate && row.allocationId && onDeallocate ? (
                      <button
                        type="button"
                        className="shrink-0 rounded px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-destructive hover:bg-destructive/10"
                        title="Deallocate from this vehicle only"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          onDeallocate(row);
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
