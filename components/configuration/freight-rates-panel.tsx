'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Ship, Search } from 'lucide-react';
import { toast } from 'sonner';

type FreightRateRow = {
  region: string;
  port: string;
  height_category: string;
  base_rate_usd_per_m3: number | null;
  baf_usd_per_m3?: number | null;
  pcs_usd_per_m3?: number | null;
  ets_usd_per_m3?: number | null;
  notes?: string | null;
};

type FreightRatesCard = {
  title?: string;
  effective_from?: string;
  currency?: string;
  unit?: string;
  source?: string;
  surcharges?: {
    baf_usd_per_m3?: number;
    pcs_usd_per_m3?: number;
    ets_usd_per_m3?: number;
    ets_applies_to?: string[];
    baf_period?: string;
  };
  notes?: string[];
  rates?: FreightRateRow[];
};

function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function FreightRatesPanel() {
  const [card, setCard] = useState<FreightRatesCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'freight_rates')
      .maybeSingle();
    if (error) toast.error(error.message);
    else setCard((data?.value as FreightRatesCard) || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const list = card?.rates || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.region, r.port, r.height_category, r.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [card, search]);

  return (
    <Card id="freight-rates" className="lg:col-span-2">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-base">
          <Ship className="h-4 w-4" />
          Freight rates (NA / Caribbean)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Admin lookup for used-vehicle USD/M³ rates when quoting or entering invoice freight.
          Stored in <code className="text-xs">system_config.freight_rates</code>.
        </p>
        {card && (
          <div className="flex flex-wrap gap-2 pt-1">
            {card.effective_from && (
              <Badge variant="outline">From {card.effective_from}</Badge>
            )}
            {card.unit && <Badge variant="outline">{card.unit}</Badge>}
            {card.surcharges?.baf_usd_per_m3 != null && (
              <Badge variant="outline">BAF {money(card.surcharges.baf_usd_per_m3)}</Badge>
            )}
            {card.surcharges?.pcs_usd_per_m3 != null && (
              <Badge variant="outline">PCS {money(card.surcharges.pcs_usd_per_m3)}</Badge>
            )}
            {card.surcharges?.ets_usd_per_m3 != null && (
              <Badge variant="outline">ETS {money(card.surcharges.ets_usd_per_m3)}</Badge>
            )}
          </div>
        )}
        {card?.source && (
          <p className="text-xs text-muted-foreground">Source: {card.source}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search region, port, height..."
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !card?.rates?.length ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No freight rate card seeded yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Height</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">BAF</TableHead>
                  <TableHead className="text-right">PCS</TableHead>
                  <TableHead className="text-right">ETS</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.region}-${r.port}-${r.height_category}-${i}`}>
                    <TableCell className="font-medium">{r.region}</TableCell>
                    <TableCell>{r.port}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.height_category}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.base_rate_usd_per_m3)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.baf_usd_per_m3)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.pcs_usd_per_m3)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(r.ets_usd_per_m3)}
                    </TableCell>
                    <TableCell className="max-w-[14rem] text-xs text-muted-foreground">
                      {r.notes || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {card?.notes?.length ? (
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {card.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
