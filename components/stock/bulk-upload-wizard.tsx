'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth-provider';
import { supabase } from '@/lib/supabase/client';
import {
  SOURCE_COUNTRIES,
  countryFlagEmoji,
  loadPortsForCountry,
} from '@/lib/source-countries';
import { BulkUploadHistory } from '@/components/stock/bulk-upload-history';
import { importAuctionSpreadsheetRows } from '@/lib/auctions/import-spreadsheet';
import { recordBulkImportBatch } from '@/lib/stock/bulk-import-batches';
import { importVehicleSpreadsheetRows } from '@/lib/vehicles/import-spreadsheet';
import {
  downloadEasyVehicleWorkbook,
  parseSpreadsheetFile,
  type EasySheetKind,
  AUCTION_CSV_HEADERS,
  THIRD_PARTY_CSV_HEADERS,
  VEHICLE_CSV_HEADERS,
} from '@/lib/utils/csv-import';
import {
  inspectVehiclePhotoZip,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_ZIP_BYTES,
  type ZipFolderMatch,
} from '@/lib/utils/vehicle-photo-zip';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Car,
  CheckCircle2,
  ChevronRight,
  Cog,
  Download,
  FileSpreadsheet,
  FolderArchive,
  Gavel,
  Loader2,
  MapPin,
  Store,
  Upload,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

const KINDS: {
  id: EasySheetKind;
  title: string;
  blurb: string;
  dest: string;
  destLabel: string;
  icon: typeof Car;
}[] = [
  { id: 'car', title: 'Cars', blurb: 'Passenger cars and light vehicles', dest: '/vehicles', destLabel: 'Cars', icon: Car },
  { id: 'machinery', title: 'Machinery', blurb: 'Plant, trucks, and equipment', dest: '/vehicles?category=machinery', destLabel: 'Machinery', icon: Wrench },
  { id: 'parts', title: 'Parts', blurb: 'Spares with SKU or chassis folders', dest: '/vehicles?category=parts', destLabel: 'Parts', icon: Cog },
  {
    id: 'third_party',
    title: 'Third party',
    blurb: 'Dealership once-price units (not auction, not our stock)',
    dest: '/vehicles/third-party',
    destLabel: 'Third party',
    icon: Store,
  },
  { id: 'auctions', title: 'Auction stock', blurb: 'Watchlists and auction lots', dest: '/auctions', destLabel: 'Auction Stock', icon: Gavel },
];

function parseKind(raw: string | null): EasySheetKind | null {
  if (raw === 'car' || raw === 'machinery' || raw === 'parts' || raw === 'auctions' || raw === 'third_party') {
    return raw;
  }
  if (raw === 'auction' || raw === 'auction_stock') return 'auctions';
  if (raw === 'third-party' || raw === 'thirdparty' || raw === 'dealership') return 'third_party';
  return null;
}

type Step = 1 | 2 | 3 | 4;

export function BulkUploadWizard() {
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const urlKind = parseKind(searchParams.get('kind'));

  const [step, setStep] = useState<Step>(urlKind ? 2 : 1);
  const [kind, setKind] = useState<EasySheetKind | null>(urlKind);
  const [countryCode, setCountryCode] = useState('JP');
  const [port, setPort] = useState('');
  const [otherPort, setOtherPort] = useState('');

  const sheetRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [sheetName, setSheetName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [sheetError, setSheetError] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetResult, setSheetResult] = useState<{ ok: number; failed: number; updated?: number; errors: string[] } | null>(null);

  const [zipName, setZipName] = useState('');
  const [zipLoading, setZipLoading] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [matches, setMatches] = useState<ZipFolderMatch[]>([]);
  const [unmatchedFolders, setUnmatchedFolders] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [zipError, setZipError] = useState('');
  const [uploadResult, setUploadResult] = useState<{ vehicles: number; photos: number } | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const kindMeta = KINDS.find((k) => k.id === kind) || null;
  const ports = useMemo(() => loadPortsForCountry(countryCode), [countryCode]);
  const country = SOURCE_COUNTRIES.find((c) => c.code === countryCode);
  const resolvedPort = port === '__other__' ? otherPort.trim() : port.trim();
  const previewHeaders =
    kind === 'auctions'
      ? AUCTION_CSV_HEADERS.slice(0, 6)
      : kind === 'third_party'
        ? THIRD_PARTY_CSV_HEADERS.slice(0, 7)
        : VEHICLE_CSV_HEADERS.slice(0, 6);
  const isAuction = kind === 'auctions';
  const isThirdParty = kind === 'third_party';
  const templateHeaders =
    kind === 'auctions'
      ? AUCTION_CSV_HEADERS
      : kind === 'third_party'
        ? THIRD_PARTY_CSV_HEADERS
        : VEHICLE_CSV_HEADERS;

  const pickKind = (next: EasySheetKind) => {
    setKind(next);
    setSheetResult(null);
    setRows([]);
    setPreview([]);
    setSheetName('');
    setSheetError('');
    setStep(2);
  };

  const handleSheetFile = async (file: File) => {
    setSheetResult(null);
    setSheetError('');
    setSheetName(file.name);
    try {
      const parsed = await parseSpreadsheetFile(file);
      if (parsed.rows.length === 0) {
        setSheetError('No data rows found. Download the easy template and keep the header row.');
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
    if (!profile || !kind || rows.length === 0) return;
    if (!country || !resolvedPort) {
      toast.error('Choose source country and load port first.');
      setStep(2);
      return;
    }
    setSheetLoading(true);
    try {
      if (isAuction) {
        const res = await importAuctionSpreadsheetRows(supabase, profile.id, rows, {
          sourceNote: `${country.name} · ${resolvedPort}`,
        });
        setSheetResult(res);
        if (res.ok > 0) {
          toast.success(`Saved ${res.ok} auction listing(s)`);
          await recordBulkImportBatch(supabase, {
            kind: 'auctions',
            source: 'sheet',
            filename: sheetName || 'auction-sheet',
            created_by: profile.id,
            payload: {
              listing_ids: res.createdIds,
              created: res.createdIds.length,
              failed: res.failed,
              country: country.name,
              country_code: country.code,
              port: resolvedPort,
            },
          });
          setHistoryKey((n) => n + 1);
          setStep(4);
        } else if (res.failed > 0) {
          toast.error('No listings were saved. Check the row errors.');
        }
      } else {
        const stockKind = kind === 'third_party' ? 'car' : kind;
        const res = await importVehicleSpreadsheetRows(supabase, profile.id, rows, {
          sourceCountry: country.name,
          sourceCountryCode: country.code,
          location: resolvedPort,
          stockCategory: stockKind,
          procurementSource: isThirdParty ? 'third_party' : 'own_stock',
        });
        setSheetResult(res);
        if (res.ok > 0) {
          toast.success(`Saved ${res.ok} unit(s)${res.updated ? ` (${res.updated} updated)` : ''}`);
          await recordBulkImportBatch(supabase, {
            kind: isThirdParty ? 'third_party' : stockKind,
            source: 'sheet',
            filename: sheetName || (isThirdParty ? 'third-party-sheet' : 'stock-sheet'),
            created_by: profile.id,
            payload: {
              created_vehicle_ids: res.createdIds,
              updated_vehicle_ids: res.updatedIds,
              created: res.createdIds.length,
              updated: res.updated,
              failed: res.failed,
              country: country.name,
              country_code: country.code,
              port: resolvedPort,
            },
          });
          setHistoryKey((n) => n + 1);
          setStep(4);
        } else if (res.failed > 0) {
          toast.error('No stock was saved. Check the row errors.');
        }
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
      let { data, error } = await supabase.from('vehicles').select('id, chassis_number, stock_number, part_sku');
      if (error) {
        ({ data, error } = await supabase.from('vehicles').select('id, chassis_number, stock_number'));
      }
      if (error) throw error;
      const inspected = await inspectVehiclePhotoZip(
        file,
        (data || []) as { id: string; chassis_number: string; stock_number?: string | null; part_sku?: string | null }[]
      );
      setMatches(inspected.matches);
      setUnmatchedFolders(inspected.unmatchedFolders);
      setSkipped(inspected.skipped);
      if (inspected.matches.length === 0 && inspected.unmatchedFolders.length === 0) {
        setZipError('No folders with jpg/png/webp photos were found. Folder names must match chassis, stock number, or part SKU.');
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
    setUploadResult(null);
    setZipError('');
    let vehicles = 0;
    let photos = 0;
    const failNotes: string[] = [];
    const imageIds: string[] = [];
    const vehicleIds: string[] = [];
    const storagePaths: string[] = [];
    const previousCovers: { vehicle_id: string; primary_image_url: string | null }[] = [];
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setZipError('Your session expired. Sign in again, then retry the photos ZIP.');
        return;
      }

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const folderKey = match.chassis || match.folder;
        if (!match.vehicleId || !folderKey) continue;
        setZipProgress(`Uploading photos ${i + 1}/${matches.length}: ${folderKey}`);
        const form = new FormData();
        form.append('vehicle_id', match.vehicleId);
        for (const photo of match.photos) {
          const blob = await photo.asyncBlob();
          if (blob.size > MAX_PHOTO_BYTES) {
            failNotes.push(`${photo.name}: larger than ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)}MB`);
            continue;
          }
          form.append('files', blob, photo.name);
        }
        const res = await fetch('/api/vehicles/gallery', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const payload = (await res.json().catch(() => ({}))) as {
          photos?: number;
          error?: string;
          errors?: string[];
          image_ids?: string[];
          vehicle_id?: string;
          previous_primary_image_url?: string | null;
          storage_paths?: string[];
        };
        if (!res.ok) {
          failNotes.push(`${folderKey}: ${payload.error || res.statusText}`);
          (payload.errors || []).forEach((e) => failNotes.push(e));
          continue;
        }
        const count = Number(payload.photos) || 0;
        if (count > 0) {
          vehicles += 1;
          photos += count;
          vehicleIds.push(match.vehicleId);
          (payload.image_ids || []).forEach((id) => imageIds.push(id));
          (payload.storage_paths || []).forEach((p) => storagePaths.push(p));
          previousCovers.push({
            vehicle_id: match.vehicleId,
            primary_image_url: payload.previous_primary_image_url || null,
          });
        }
        (payload.errors || []).forEach((e) => failNotes.push(e));
      }

      if (photos > 0) {
        setUploadResult({ vehicles, photos });
        toast.success(`Attached ${photos} photo(s) to ${vehicles} unit(s)`);
        if (profile?.id) {
          await recordBulkImportBatch(supabase, {
            kind: 'photos',
            source: 'zip',
            filename: zipName || 'photos.zip',
            created_by: profile.id,
            payload: {
              vehicle_ids: vehicleIds,
              image_ids: imageIds,
              storage_paths: storagePaths,
              previous_covers: previousCovers,
              photos,
              created: vehicles,
              country: country?.name || null,
              country_code: countryCode,
              port: resolvedPort || null,
            },
          });
          setHistoryKey((n) => n + 1);
        }
      } else {
        setZipError(failNotes[0] || 'No photos were uploaded. Folder names must match chassis in the sheet.');
        toast.error('No photos were uploaded');
      }
      if (failNotes.length > 0) setSkipped((prev) => [...failNotes, ...prev]);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setZipLoading(false);
      setZipProgress('');
    }
  };

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'Kind' },
    { n: 2, label: 'Country & port' },
    { n: 3, label: 'Easy sheet' },
    { n: 4, label: isAuction ? 'Photos (optional)' : 'Photos ZIP' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => {
              if (s.n === 1 || kind) setStep(s.n);
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-colors',
              step === s.n
                ? 'border-primary bg-primary text-primary-foreground'
                : step > s.n
                  ? 'border-brand/50 bg-brand/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground'
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">{s.n}</span>
            {s.label}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {KINDS.map((item) => {
            const Icon = item.icon;
            const selected = kind === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => pickKind(item.id)}
                className={cn(
                  'group rounded-xl border-2 bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                  selected ? 'border-brand ring-2 ring-brand/30' : 'border-border hover:border-primary/40'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.blurb}</p>
                    <p className="mt-2 text-xs font-medium text-primary">
                      Lands in {item.destLabel} <ChevronRight className="inline h-3 w-3" />
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {step === 2 && kindMeta && (
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-brand/80 to-info/50" />
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-sm font-semibold">Source for every {kindMeta.title.toLowerCase()} row</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Country and load port apply to the whole sheet. You do not put image URLs in Excel.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Source country</Label>
                <Select
                  value={countryCode}
                  onValueChange={(v) => {
                    setCountryCode(v);
                    setPort('');
                    setOtherPort('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {SOURCE_COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {countryFlagEmoji(c.code)} {c.name} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Load port</Label>
                <Select value={port} onValueChange={setPort}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select port" />
                  </SelectTrigger>
                  <SelectContent>
                    {ports.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                    <SelectItem value="__other__">Other…</SelectItem>
                  </SelectContent>
                </Select>
                {port === '__other__' && (
                  <Input
                    value={otherPort}
                    onChange={(e) => setOtherPort(e.target.value)}
                    placeholder="Type port name"
                  />
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button
                type="button"
                disabled={!resolvedPort}
                onClick={() => setStep(3)}
              >
                Continue to sheet
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && kindMeta && (
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-brand/80 to-info/50" />
          <CardContent className="space-y-4 p-5">
            <div className="rounded-xl border-2 border-dashed border-primary/25 bg-primary/[0.03] p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                Easy Excel for {kindMeta.title}. Country {countryFlagEmoji(countryCode)} {country?.name} · {resolvedPort || 'port pending'}.
                No photo URL columns — photos come from a ZIP next.
              </p>
              <div className="rounded-lg border bg-card/80 p-3">
                <p className="text-xs font-semibold text-foreground">Template headers</p>
                <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {templateHeaders.join(' · ')}
                </p>
                {isThirdParty ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Required: dealership_name, once_price, once_price_currency (JPY/USD), chassis_number, make, model.
                    Import sets procurement_source = third_party.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void downloadEasyVehicleWorkbook(kind!)}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Download styled template
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
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                <div className="mt-1 max-h-44 overflow-auto rounded-lg border text-xs">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-primary text-primary-foreground">
                      <tr>
                        {previewHeaders.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t">
                          {previewHeaders.map((h) => (
                            <td key={h} className="max-w-[110px] truncate px-2 py-1">{row[h] || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {sheetResult && (
              <div className="space-y-1 rounded-lg border p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Saved {sheetResult.ok}
                  {sheetResult.updated != null ? ` · updated ${sheetResult.updated}` : ''}
                  {' · '}failed {sheetResult.failed}
                </p>
                {sheetResult.errors.slice(0, 12).map((e) => (
                  <p key={e} className="text-xs text-muted-foreground">{e}</p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button
                type="button"
                disabled={sheetLoading || rows.length === 0 || !!sheetError}
                onClick={() => void importSheet()}
              >
                {sheetLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import {kindMeta.title.toLowerCase()}
                  </>
                )}
              </Button>
              {sheetResult && sheetResult.ok > 0 && (
                <Button type="button" onClick={() => setStep(4)}>
                  {isAuction ? 'Continue (photos optional)' : 'Continue to photos'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && kindMeta && (
        <Card className="overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-brand/80 to-info/50" />
          <CardContent className="space-y-4 p-5">
            <div className="rounded-xl border-2 border-dashed border-brand/40 bg-brand/[0.06] p-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                {isAuction
                  ? 'Photos are optional for auction stock. You can skip this and open Auction Stock.'
                  : <>
                      One ZIP. Folder per unit (chassis / stock / SKU), e.g. <code>RU3-123123/</code>.
                      Name files: <code>A.</code>/<code>A_</code> auction sheet (ERP only), <code>F.</code> front, <code>B.</code> back.
                      Max {Math.round(MAX_PHOTO_ZIP_BYTES / 1024 / 1024)}MB.
                    </>}
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
              {zipName && <p className="text-xs text-muted-foreground">{zipName}</p>}
            </div>

            {zipProgress && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
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
              <div className="max-h-40 space-y-1 overflow-auto rounded-lg border p-3 text-sm">
                <p className="font-medium">Matched folders</p>
                {matches.map((m) => (
                  <p key={`${m.vehicleId}-${m.folder}`} className="text-xs text-muted-foreground">
                    {m.folder} → {m.chassis} · {m.photos.length} photo(s)
                    {(() => {
                      const a = m.photos.filter((p) => p.role === 'auction_sheet').length;
                      const f = m.photos.filter((p) => p.role === 'front').length;
                      const b = m.photos.filter((p) => p.role === 'back').length;
                      const bits = [
                        a ? `${a}A` : '',
                        f ? `${f}F` : '',
                        b ? `${b}B` : '',
                      ].filter(Boolean);
                      return bits.length ? ` · ${bits.join('/')}` : '';
                    })()}
                  </p>
                ))}
              </div>
            )}
            {unmatchedFolders.length > 0 && (
              <div className="max-h-32 space-y-1 overflow-auto rounded-lg border border-destructive/30 p-3 text-sm">
                <p className="font-medium text-destructive">Unmatched folders</p>
                {unmatchedFolders.map((f) => (
                  <p key={f} className="text-xs text-muted-foreground">{f}</p>
                ))}
              </div>
            )}
            {skipped.length > 0 && (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                {skipped.slice(0, 8).map((s) => <p key={s}>{s}</p>)}
              </div>
            )}
            {uploadResult && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Attached {uploadResult.photos} photo(s) to {uploadResult.vehicles} unit(s)
              </p>
            )}

            {(sheetResult?.ok || 0) > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                Open the matching list:
                <Link href={kindMeta.dest} className="font-semibold text-primary underline-offset-2 hover:underline">
                  {kindMeta.destLabel}
                </Link>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button
                type="button"
                disabled={zipLoading || matches.length === 0}
                onClick={() => void uploadMatchedPhotos()}
              >
                {zipLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
                ) : (
                  'Upload matched photos'
                )}
              </Button>
              {isAuction && (
                <Button type="button" variant="ghost" asChild>
                  <Link href="/auctions">Skip to Auction Stock</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <BulkUploadHistory refreshKey={historyKey} />
    </div>
  );
}
