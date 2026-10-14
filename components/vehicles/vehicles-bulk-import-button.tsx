'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  downloadCSVTemplate,
  parseSpreadsheetFile,
  VEHICLE_CSV_HEADERS,
  VEHICLE_CSV_SAMPLES,
} from '@/lib/utils/csv-import';
import { importVehicleSpreadsheetRows } from '@/lib/vehicles/import-spreadsheet';
import {
  inspectVehiclePhotoZip,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_ZIP_BYTES,
  type ZipFolderMatch,
} from '@/lib/utils/vehicle-photo-zip';
import { chassisStorageFolder, imageContentType } from '@/lib/utils/chassis';
import { saveVehicleImages } from '@/lib/utils/vehicle-images';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-provider';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderArchive,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Props = { onDone?: () => void };

export function VehiclesBulkImportButton({ onDone }: Props) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const sheetRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  const [sheetName, setSheetName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [sheetError, setSheetError] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetResult, setSheetResult] = useState<{ ok: number; failed: number; updated: number; errors: string[] } | null>(null);

  const [zipName, setZipName] = useState('');
  const [zipLoading, setZipLoading] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [matches, setMatches] = useState<ZipFolderMatch[]>([]);
  const [unmatchedFolders, setUnmatchedFolders] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [zipError, setZipError] = useState('');
  const [uploadResult, setUploadResult] = useState<{ vehicles: number; photos: number } | null>(null);

  const reset = () => {
    setStep(1);
    setSheetName('');
    setRows([]);
    setPreview([]);
    setSheetError('');
    setSheetResult(null);
    setZipName('');
    setZipProgress('');
    setMatches([]);
    setUnmatchedFolders([]);
    setSkipped([]);
    setZipError('');
    setUploadResult(null);
    if (sheetRef.current) sheetRef.current.value = '';
    if (zipRef.current) zipRef.current.value = '';
  };

  const handleSheetFile = async (file: File) => {
    setSheetResult(null);
    setSheetError('');
    setSheetName(file.name);
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (parsed.rows.length === 0) {
        setSheetError('No data rows found. Download the template and keep the header row.');
        setRows([]);
        setPreview([]);
        return;
      }
      setRows(parsed.rows);
      setPreview(parsed.rows.slice(0, 5));
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : 'Could not read that file');
      setRows([]);
      setPreview([]);
    }
  };

  const importSheet = async () => {
    if (!profile || rows.length === 0) return;
    setSheetLoading(true);
    try {
      const res = await importVehicleSpreadsheetRows(supabase, profile.id, rows);
      setSheetResult(res);
      if (res.ok > 0) {
        toast.success(`Saved ${res.ok} vehicle(s)${res.updated ? ` (${res.updated} updated)` : ''}`);
        onDone?.();
      } else if (res.failed > 0) {
        toast.error('No vehicles were saved. Check the row errors.');
      }
    } catch (err) {
      setSheetResult({
        ok: 0,
        failed: rows.length,
        updated: 0,
        errors: [err instanceof Error ? err.message : 'Import failed'],
      });
    } finally {
      setSheetLoading(false);
    }
  };

  const handleZipFile = async (file: File) => {
    setUploadResult(null);
    setZipError('');
    setMatches([]);
    setUnmatchedFolders([]);
    setSkipped([]);
    setZipName(file.name);
    if (file.size > MAX_PHOTO_ZIP_BYTES) {
      setZipError(`ZIP is too large (max ${Math.round(MAX_PHOTO_ZIP_BYTES / 1024 / 1024)}MB). Split by country or chassis batch.`);
      return;
    }
    setZipLoading(true);
    setZipProgress('Reading ZIP and matching chassis folders…');
    try {
      const { data, error } = await supabase.from('vehicles').select('id, chassis_number');
      if (error) throw error;
      const inspected = await inspectVehiclePhotoZip(file, (data || []) as { id: string; chassis_number: string }[]);
      setMatches(inspected.matches);
      setUnmatchedFolders(inspected.unmatchedFolders);
      setSkipped(inspected.skipped);
      if (inspected.matches.length === 0 && inspected.unmatchedFolders.length === 0) {
        setZipError('No chassis folders with jpg/png/webp photos were found. Folder names must match vehicle chassis numbers.');
      }
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Could not read ZIP');
    } finally {
      setZipLoading(false);
      setZipProgress('');
    }
  };

  const uploadMatchedPhotos = async () => {
    if (matches.length === 0) return;
    setZipLoading(true);
    let vehicles = 0;
    let photos = 0;
    try {
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        if (!match.vehicleId || !match.chassis) continue;
        setZipProgress(`Uploading photos ${i + 1}/${matches.length}: ${match.chassis}`);
        const gallery: { image_url: string; sort_order: number; is_primary: boolean }[] = [];
        const folder = chassisStorageFolder(match.chassis);
        for (let p = 0; p < match.photos.length; p++) {
          const photo = match.photos[p];
          const blob = await photo.asyncBlob();
          if (blob.size > MAX_PHOTO_BYTES) continue;
          const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
          const safe = photo.name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80);
          const path = `${folder}/${String(p + 1).padStart(3, '0')}-${safe || `photo.${ext}`}`;
          const { error } = await supabase.storage.from('vehicle-images').upload(path, blob, {
            upsert: true,
            contentType: imageContentType(photo.name),
          });
          if (error) continue;
          const { data } = supabase.storage.from('vehicle-images').getPublicUrl(path);
          gallery.push({
            image_url: `${data.publicUrl}?t=${Date.now()}`,
            sort_order: gallery.length,
            is_primary: gallery.length === 0,
          });
        }
        if (gallery.length === 0) continue;
        await saveVehicleImages(match.vehicleId, gallery);
        vehicles += 1;
        photos += gallery.length;
      }
      setUploadResult({ vehicles, photos });
      if (photos > 0) {
        toast.success(`Attached ${photos} photo(s) to ${vehicles} vehicle(s)`);
        onDone?.();
      } else {
        toast.error('No photos were uploaded');
      }
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setZipLoading(false);
      setZipProgress('');
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-1.5 h-4 w-4" />
        Bulk import
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) reset();
          setOpen(o);
        }}
      >
        <DialogContent fullscreen className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk import stock</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 text-xs font-medium">
            <button
              type="button"
              className={cn(
                'flex-1 rounded-md border px-2 py-2 text-left',
                step === 1 ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground'
              )}
              onClick={() => setStep(1)}
            >
              1. Upload vehicles
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 rounded-md border px-2 py-2 text-left',
                step === 2 ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground'
              )}
              onClick={() => setStep(2)}
            >
              2. Upload photos ZIP
            </button>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Upload a CSV or Excel sheet first. Mix any source countries in one file. Photos are not required in the sheet — attach them in step 2 as a ZIP of chassis folders.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCSVTemplate('jct-vehicles-template.csv', VEHICLE_CSV_HEADERS, VEHICLE_CSV_SAMPLES)}
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    Download template
                  </Button>
                  <Button type="button" size="sm" onClick={() => sheetRef.current?.click()}>
                    <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                    Choose spreadsheet
                  </Button>
                  <input
                    ref={sheetRef}
                    type="file"
                    accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleSheetFile(f);
                    }}
                  />
                </div>
                {sheetName && (
                  <p className="text-xs flex items-center gap-1.5 text-muted-foreground">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {sheetName} · {rows.length} rows
                  </p>
                )}
              </div>

              {sheetError && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {sheetError}
                </div>
              )}

              {preview.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Preview (first {preview.length} rows)</Label>
                  <div className="mt-1 max-h-40 overflow-auto rounded border text-[11px]">
                    <table className="w-full">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          {VEHICLE_CSV_HEADERS.slice(0, 6).map((h) => (
                            <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i} className="border-t">
                            {VEHICLE_CSV_HEADERS.slice(0, 6).map((h) => (
                              <td key={h} className="px-2 py-1 truncate max-w-[100px]">{row[h] || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {sheetResult && (
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Saved {sheetResult.ok} · updated {sheetResult.updated} · failed {sheetResult.failed}
                  </p>
                  {sheetResult.errors.slice(0, 12).map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  One ZIP. Inside: a folder per chassis (e.g. <code>RU3-1231232/</code> or <code>KDH2015012847/</code>), each holding that vehicle&apos;s jpg/png/webp files. Folder names are matched to chassis (hyphens and case ignored). Max {Math.round(MAX_PHOTO_ZIP_BYTES / 1024 / 1024)}MB. <code>__MACOSX</code> and junk files are skipped.
                </p>
                <Button type="button" size="sm" onClick={() => zipRef.current?.click()} disabled={zipLoading}>
                  <FolderArchive className="mr-1.5 h-4 w-4" />
                  Choose photos ZIP
                </Button>
                <input
                  ref={zipRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleZipFile(f);
                  }}
                />
                {zipName && (
                  <p className="text-xs text-muted-foreground">{zipName}</p>
                )}
              </div>

              {zipProgress && (
                <p className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {zipProgress}
                </p>
              )}

              {zipError && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {zipError}
                </div>
              )}

              {matches.length > 0 && (
                <div className="rounded-lg border p-3 text-sm space-y-1 max-h-40 overflow-auto">
                  <p className="font-medium">Matched chassis</p>
                  {matches.map((m) => (
                    <p key={m.vehicleId} className="text-xs text-muted-foreground">
                      {m.folder} → {m.chassis} · {m.photos.length} photo(s)
                    </p>
                  ))}
                </div>
              )}

              {unmatchedFolders.length > 0 && (
                <div className="rounded-lg border border-destructive/30 p-3 text-sm space-y-1 max-h-32 overflow-auto">
                  <p className="font-medium text-destructive">Unmatched folders</p>
                  {unmatchedFolders.map((f) => (
                    <p key={f} className="text-xs text-muted-foreground">{f}</p>
                  ))}
                </div>
              )}

              {skipped.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {skipped.slice(0, 8).map((s) => <p key={s}>{s}</p>)}
                </div>
              )}

              {uploadResult && (
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Attached {uploadResult.photos} photo(s) to {uploadResult.vehicles} vehicle(s)
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button>
            {step === 1 ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                  Skip to photos ZIP
                </Button>
                <Button
                  type="button"
                  disabled={sheetLoading || rows.length === 0 || !!sheetError}
                  onClick={() => void importSheet()}
                >
                  {sheetLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Import vehicles'}
                </Button>
                {sheetResult && sheetResult.ok > 0 && (
                  <Button type="button" onClick={() => setStep(2)}>Continue to photos</Button>
                )}
              </>
            ) : (
              <Button
                type="button"
                disabled={zipLoading || matches.length === 0 || !!uploadResult}
                onClick={() => void uploadMatchedPhotos()}
              >
                {zipLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : 'Upload matched photos'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
