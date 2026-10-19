'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  fetchAuctionHouses,
  formatAuctionHouseLabel,
  type AuctionHousePick,
} from '@/lib/auction-houses';
import { fetchYards, portKeyFromLabel, type YardRow } from '@/lib/yards';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SOURCE_COUNTRIES } from '@/lib/source-countries';

export type StockSourcingForm = {
  source_supplier: string;
  shipping_port_of_loading: string;
  yard_id: string;
  location: string;
  destination_country: string;
  bid_requester_id: string;
  /** Soft assignment to a sales agent (available stock). */
  assigned_agent_id: string;
};

type StaffOpt = { id: string; label: string };

type Props = {
  form: StockSourcingForm;
  onChange: (patch: Partial<StockSourcingForm>) => void;
  staff: StaffOpt[];
  disabled?: boolean;
  /** Pending auction sheet file for create (before vehicle id exists). */
  auctionSheetFile?: File | null;
  onAuctionSheetFile?: (file: File | null) => void;
  /** When editing an existing vehicle, show upload that writes immediately. */
  vehicleId?: string | null;
  onAuctionSheetUploaded?: () => void;
  profileId?: string | null;
  /** Third-party dealership units: hide auction house / sheet / bid requester. */
  variant?: 'stock' | 'third_party';
};

export function StockSourcingFields({
  form,
  onChange,
  staff,
  disabled,
  auctionSheetFile,
  onAuctionSheetFile,
  vehicleId,
  onAuctionSheetUploaded,
  profileId,
  variant = 'stock',
}: Props) {
  const [houses, setHouses] = useState<AuctionHousePick[]>([]);
  const [yards, setYards] = useState<YardRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const isThirdParty = variant === 'third_party';

  useEffect(() => {
    if (isThirdParty) return;
    void fetchAuctionHouses(supabase, { activeOnly: true }).then(({ data }) => setHouses(data));
  }, [isThirdParty]);

  const portKey = portKeyFromLabel(form.shipping_port_of_loading);

  useEffect(() => {
    void fetchYards(supabase, { portName: portKey || null }).then(({ data }) => setYards(data));
  }, [portKey]);

  const filteredYards = useMemo(() => {
    if (!portKey) return yards;
    return yards.filter((y) => y.port_name.toLowerCase() === portKey.toLowerCase());
  }, [yards, portKey]);

  const selectHouse = (houseId: string) => {
    if (houseId === 'none') {
      onChange({ source_supplier: '' });
      return;
    }
    const house = houses.find((h) => h.id === houseId);
    if (!house) return;
    const port = (house.city || '').trim();
    onChange({
      source_supplier: house.name,
      shipping_port_of_loading: port
        ? port.toLowerCase().includes('japan')
          ? port
          : `${port}, Japan`
        : form.shipping_port_of_loading,
      yard_id: '',
      location: '',
    });
  };

  const selectedHouseId =
    houses.find((h) => h.name.toLowerCase() === form.source_supplier.trim().toLowerCase())?.id ||
    'none';

  const uploadAuctionSheet = async (file: File) => {
    if (!vehicleId || !profileId) {
      onAuctionSheetFile?.(file);
      return;
    }
    setUploading(true);
    const { uploadRecordAttachment } = await import('@/components/shared/record-attachments');
    const ok = await uploadRecordAttachment('vehicles', vehicleId, file, profileId, {
      docKind: 'auction_sheet',
    });
    setUploading(false);
    if (ok) {
      onAuctionSheetFile?.(null);
      onAuctionSheetUploaded?.();
    }
  };

  return (
    <section className="space-y-1.5 rounded-xl border border-border/70 p-2">
      <h3 className="text-xs font-semibold">
        {isThirdParty ? 'Origin / destination' : 'Auction / origin / destination'}
      </h3>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {!isThirdParty ? (
          <div className="space-y-0.5">
            <Label className="text-xs">Auction house</Label>
            <Select
              value={selectedHouseId}
              onValueChange={selectHouse}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select auction house" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {houses.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {formatAuctionHouseLabel(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedHouseId || selectedHouseId === 'none' ? (
              <Input
                className="mt-1"
                disabled={disabled}
                value={form.source_supplier}
                onChange={(e) => onChange({ source_supplier: e.target.value })}
                placeholder="Or type auction house name"
              />
            ) : null}
          </div>
        ) : null}
        <div className="space-y-0.5">
          <Label className="text-xs">Source port (POL)</Label>
          <Input
            disabled={disabled}
            value={form.shipping_port_of_loading}
            onChange={(e) =>
              onChange({
                shipping_port_of_loading: e.target.value,
                yard_id: '',
                location: '',
              })
            }
            placeholder={isThirdParty ? 'e.g. Nagoya, Japan' : 'Autofills from auction house'}
            list="stock-source-ports"
          />
          <datalist id="stock-source-ports">
            {['Nagoya, Japan', 'Yokohama, Japan', 'Kobe, Japan', 'Hakata, Japan', 'Osaka, Japan'].map(
              (p) => (
                <option key={p} value={p} />
              )
            )}
          </datalist>
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Yard</Label>
          <Select
            value={form.yard_id || 'none'}
            onValueChange={(v) => {
              if (v === 'none') {
                onChange({ yard_id: '', location: '' });
                return;
              }
              const yard = filteredYards.find((y) => y.id === v);
              onChange({ yard_id: v, location: yard?.name || '' });
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder={portKey ? 'Select yard' : 'Select yard (all ports)'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {filteredYards.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {portKey ? y.name : `${y.name} (${y.port_name})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Destination country</Label>
          <Input
            disabled={disabled}
            value={form.destination_country}
            onChange={(e) => onChange({ destination_country: e.target.value })}
            placeholder="e.g. Pakistan, Kenya"
            list="stock-dest-countries"
          />
          <datalist id="stock-dest-countries">
            {SOURCE_COUNTRIES.map((c) => (
              <option key={c.code} value={c.name} />
            ))}
            {['Pakistan', 'Kenya', 'Uganda', 'Tanzania', 'UAE', 'New Zealand', 'Chile', 'Dominican Republic'].map(
              (n) => (
                <option key={n} value={n} />
              )
            )}
          </datalist>
        </div>
        <div className="space-y-0.5">
          <Label className="text-xs">Agent</Label>
          <Select
            value={form.assigned_agent_id || 'none'}
            onValueChange={(v) => onChange({ assigned_agent_id: v === 'none' ? '' : v })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Assigned sales agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!isThirdParty ? (
          <>
            <div className="space-y-0.5">
              <Label className="text-xs">Bid requester</Label>
              <Select
                value={form.bid_requester_id || 'none'}
                onValueChange={(v) => onChange({ bid_requester_id: v === 'none' ? '' : v })}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Who wanted this bid" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs">Auction sheet</Label>
              <Input
                type="file"
                accept=".pdf,image/*,.xlsx,.xls"
                disabled={disabled || uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (!file) {
                    onAuctionSheetFile?.(null);
                    return;
                  }
                  void uploadAuctionSheet(file);
                }}
              />
              {auctionSheetFile ? (
                <p className="text-xs text-muted-foreground">Queued: {auctionSheetFile.name}</p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
