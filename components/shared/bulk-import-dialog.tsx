'use client';

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Download, Loader2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { parseCSV, downloadCSVTemplate } from '@/lib/utils/csv-import';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  headers: string[];
  sampleRow: string[];
  templateFilename: string;
  onImport: (rows: Record<string, string>[]) => Promise<{ ok: number; failed: number; errors: string[] }>;
};

export function BulkImportDialog({
  open,
  onOpenChange,
  title,
  headers,
  sampleRow,
  templateFilename,
  onImport,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = useState('');

  const reset = () => {
    setFileName('');
    setPreview([]);
    setResult(null);
    setParseError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setResult(null);
    setParseError('');
    setFileName(file.name);
    const text = await file.text();
    const { rows } = parseCSV(text);
    if (rows.length === 0) {
      setParseError('No data rows found. Check the CSV format.');
      setPreview([]);
      return;
    }
    setPreview(rows.slice(0, 5));
    (window as unknown as { __bulkRows?: Record<string, string>[] }).__bulkRows = rows;
  };

  const handleImport = async () => {
    const rows = (window as unknown as { __bulkRows?: Record<string, string>[] }).__bulkRows || [];
    if (rows.length === 0) return;
    setLoading(true);
    try {
      const res = await onImport(rows);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file. Download the template for the required columns.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadCSVTemplate(templateFilename, headers, sampleRow)}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Download template
              </Button>
              <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" />
                Choose CSV
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            {fileName && (
              <p className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                {fileName} · {(window as unknown as { __bulkRows?: unknown[] }).__bulkRows?.length || 0} rows
              </p>
            )}
          </div>

          {parseError && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {parseError}
            </div>
          )}

          {preview.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Preview (first {preview.length} rows)</Label>
              <div className="mt-1 max-h-40 overflow-auto rounded border text-[11px]">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      {headers.slice(0, 6).map((h) => (
                        <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        {headers.slice(0, 6).map((h) => (
                          <td key={h} className="px-2 py-1 truncate max-w-[100px]">{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Imported {result.ok} row(s)
              </p>
              {result.failed > 0 && <p className="text-destructive">Failed: {result.failed}</p>}
              {result.errors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground">{e}</p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button type="button" disabled={loading || !fileName || !!parseError} onClick={handleImport}>
            {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</>) : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
