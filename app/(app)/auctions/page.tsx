'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StockListFilters, type StockListFiltersValue } from '@/components/stock/stock-list-filters';
import { StockListPagination } from '@/components/stock/stock-list-pagination';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import type { AuctionListing, AuctionBid } from '@/lib/types';
import type { AuctionHousePick } from '@/lib/auction-houses';
import { fetchAuctionHouses } from '@/lib/auction-houses';
import { AuctionHouseSelect } from '@/components/auctions/auction-house-select';
import {
  clampStockPage,
  DEFAULT_STOCK_PAGE_SIZE,
  parseStockPage,
  parseStockPageSize,
  type StockPageSize,
} from '@/lib/stock-list-paging';
import { CheckCircle2, Gavel, Loader2, Plus, XCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { toast } from 'sonner';

const AUCTION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'cancelled', label: 'Cancelled' },
];

const emptyListFilters = (): StockListFiltersValue => ({
  search: '',
  status: '',
  make: '',
  model: '',
  customer: '',
  agent: '',
});

const resultStyles: Record<AuctionListing['result'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200', won: 'bg-emerald-50 text-emerald-700 border-emerald-200', lost: 'bg-slate-100 text-slate-600 border-slate-200', cancelled: 'bg-red-50 text-red-700 border-red-200',
};
const bidStatusStyles: Record<AuctionBid['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200', approved: 'bg-blue-50 text-blue-700 border-blue-200', rejected: 'bg-red-50 text-red-700 border-red-200', won: 'bg-emerald-50 text-emerald-700 border-emerald-200', lost: 'bg-slate-100 text-slate-600 border-slate-200',
};

const emptyForm = { supplier_id: '', chassis_number: '', make: '', model: '', model_year: '', auction_date: '', lot_number: '', start_price: '', currency: 'JPY', notes: '' };

function AuctionsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<AuctionListing[]>([]);
  const [bids, setBids] = useState<Record<string, AuctionBid[]>>({});
  const [auctionHouses, setAuctionHouses] = useState<AuctionHousePick[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [listFilters, setListFilters] = useState<StockListFiltersValue>(() => ({
    ...emptyListFilters(),
    search: searchParams.get('q') || '',
    status: searchParams.get('status') || '',
    make: searchParams.get('make') || '',
    model: searchParams.get('model') || '',
  }));
  const [page, setPage] = useState(() => parseStockPage(searchParams.get('page')));
  const [pageSize, setPageSize] = useState<StockPageSize>(() =>
    parseStockPageSize(searchParams.get('pageSize'))
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<AuctionListing | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [listingsRes, housesRes] = await Promise.all([
      supabase.from('auction_listings').select('*').order('auction_date', { ascending: false }),
      fetchAuctionHouses(supabase, { activeOnly: true }),
    ]);
    if (listingsRes.error) toast.error(`Unable to load listings: ${listingsRes.error.message}`);
    else {
      const listingData = (listingsRes.data || []) as AuctionListing[];
      setListings(listingData);
      if (listingData.length > 0) {
        const bidsRes = await supabase.from('auction_bids').select('*').in('listing_id', listingData.map((l) => l.id)).order('created_at', { ascending: false });
        if (!bidsRes.error && bidsRes.data) {
          const bidMap: Record<string, AuctionBid[]> = {};
          (bidsRes.data as AuctionBid[]).forEach((bid) => { if (!bidMap[bid.listing_id]) bidMap[bid.listing_id] = []; bidMap[bid.listing_id].push(bid); });
          setBids(bidMap);
        }
      }
    }
    if (housesRes.error) toast.error(`Unable to load auction houses: ${housesRes.error.message}`);
    else setAuctionHouses(housesRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const syncListQuery = useCallback(
    (next: {
      filters?: StockListFiltersValue;
      page?: number;
      pageSize?: StockPageSize;
    }) => {
      const filters = next.filters ?? listFilters;
      const nextPage = next.page ?? page;
      const nextSize = next.pageSize ?? pageSize;
      const params = new URLSearchParams();
      if (filters.search.trim()) params.set('q', filters.search.trim());
      if (filters.status) params.set('status', filters.status);
      if (filters.make) params.set('make', filters.make);
      if (filters.model) params.set('model', filters.model);
      if (nextPage > 1) params.set('page', String(nextPage));
      if (nextSize !== DEFAULT_STOCK_PAGE_SIZE) params.set('pageSize', String(nextSize));
      const qs = params.toString();
      router.replace(qs ? `/auctions?${qs}` : '/auctions', { scroll: false });
    },
    [listFilters, page, pageSize, router]
  );

  const filtered = useMemo(() => {
    const q = listFilters.search.trim().toLowerCase();
    const statusFilter = listFilters.status || 'all';
    const makeFilter = listFilters.make.trim().toLowerCase();
    const modelFilter = listFilters.model.trim().toLowerCase();
    return listings.filter((l) => {
      const matchesResult = statusFilter === 'all' || l.result === statusFilter;
      const matchesSearch =
        !q ||
        [l.listing_code, l.chassis_number, l.make, l.model, l.lot_number]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      const matchesMake = !makeFilter || (l.make || '').trim().toLowerCase() === makeFilter;
      const matchesModel = !modelFilter || (l.model || '').trim().toLowerCase() === modelFilter;
      return matchesResult && matchesSearch && matchesMake && matchesModel;
    });
  }, [listings, listFilters]);

  const safePage = clampStockPage(page, filtered.length, pageSize);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const makeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of listings) {
      const m = (l.make || '').trim();
      if (m) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
  }, [listings]);

  const modelOptions = useMemo(() => {
    const makeFilter = listFilters.make.trim().toLowerCase();
    const set = new Set<string>();
    for (const l of listings) {
      if (makeFilter && (l.make || '').trim().toLowerCase() !== makeFilter) continue;
      const m = (l.model || '').trim();
      if (m) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }));
  }, [listings, listFilters.make]);

  const filterSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onListFiltersChange = (next: StockListFiltersValue) => {
    setListFilters(next);
    setPage(1);
    if (filterSyncTimer.current) clearTimeout(filterSyncTimer.current);
    filterSyncTimer.current = setTimeout(() => {
      syncListQuery({ filters: next, page: 1 });
    }, 250);
  };

  const onPageChange = (nextPage: number) => {
    setPage(nextPage);
    syncListQuery({ page: nextPage });
  };

  const onPageSizeChange = (nextSize: StockPageSize) => {
    setPageSize(nextSize);
    setPage(1);
    syncListQuery({ page: 1, pageSize: nextSize });
  };

  const submitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.make.trim() || !form.model.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('auction_listings').insert({
      supplier_id: form.supplier_id || null, chassis_number: form.chassis_number.trim() || null, make: form.make.trim(), model: form.model.trim(),
      model_year: form.model_year ? Number(form.model_year) : null, auction_date: form.auction_date || null, lot_number: form.lot_number.trim() || null,
      start_price: form.start_price ? Number(form.start_price) : null, currency: form.currency, notes: form.notes.trim() || null, created_by: profile.id,
    });
    setSubmitting(false);
    if (error) { toast.error(`Could not create listing: ${error.message}`); return; }
    toast.success('Auction listing created');
    setForm(emptyForm); setCreateOpen(false); loadData();
  };

  const placeBid = async (listingId: string) => {
    if (!profile) return;
    const amount = prompt('Enter bid amount:');
    if (!amount || isNaN(Number(amount))) return;
    setSubmitting(true);
    const listing = listings.find((l) => l.id === listingId);
    const { error } = await supabase.from('auction_bids').insert({ listing_id: listingId, bid_amount: Number(amount), currency: listing?.currency || 'JPY', created_by: profile.id });
    setSubmitting(false);
    if (error) { toast.error(`Could not place bid: ${error.message}`); return; }
    toast.success('Bid placed'); loadData();
  };

  const approveBid = async (bid: AuctionBid) => {
    if (!profile) return;
    const { error } = await supabase.from('auction_bids').update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() }).eq('id', bid.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Bid approved'); loadData();
  };

  const rejectBid = async (bid: AuctionBid) => {
    const { error } = await supabase.from('auction_bids').update({ status: 'rejected' }).eq('id', bid.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Bid rejected'); loadData();
  };

  const markResult = async (listing: AuctionListing, result: AuctionListing['result']) => {
    const { error } = await supabase.from('auction_listings').update({ result, updated_at: new Date().toISOString() }).eq('id', listing.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Listing marked as ${result}`); loadData();
  };

  const openEdit = async () => {
    if (!selected) return;
    if (selected.supplier_id && !auctionHouses.some((h) => h.id === selected.supplier_id)) {
      const { data } = await supabase
        .from('suppliers')
        .select('id, name, supplier_code, city, country, status')
        .eq('id', selected.supplier_id)
        .eq('supplier_type', 'auction_house')
        .maybeSingle();
      if (data) {
        setAuctionHouses((prev) => [...prev, data as AuctionHousePick].sort((a, b) => a.name.localeCompare(b.name)));
      }
    }
    setForm({ supplier_id: selected.supplier_id || '', chassis_number: selected.chassis_number || '', make: selected.make || '', model: selected.model || '', model_year: selected.model_year ? String(selected.model_year) : '', auction_date: selected.auction_date || '', lot_number: selected.lot_number || '', start_price: selected.start_price ? String(selected.start_price) : '', currency: selected.currency, notes: selected.notes || '' });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('auction_listings').update({ supplier_id: form.supplier_id || null, chassis_number: form.chassis_number.trim() || null, make: form.make.trim(), model: form.model.trim(), model_year: form.model_year ? Number(form.model_year) : null, auction_date: form.auction_date || null, lot_number: form.lot_number.trim() || null, start_price: form.start_price ? Number(form.start_price) : null, currency: form.currency, notes: form.notes.trim() || null, updated_at: new Date().toISOString() }).eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not update: ${error.message}`); return; }
    const updated = { ...selected, make: form.make.trim(), model: form.model.trim(), chassis_number: form.chassis_number.trim() || null, notes: form.notes.trim() || null };
    setSelected(updated); setListings((items) => items.map((i) => i.id === updated.id ? updated : i));
    toast.success('Listing updated'); setEditOpen(false);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.from('auction_listings').delete().eq('id', selected.id);
    setSubmitting(false);
    if (error) { toast.error(`Could not delete: ${error.message}`); return; }
    toast.success('Listing deleted'); setDeleteOpen(false); setSelected(null); loadData();
  };

  const stats = { total: listings.length, pending: listings.filter((l) => l.result === 'pending').length, won: listings.filter((l) => l.result === 'won').length, bids: Object.values(bids).flat().length };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auction Stock"
        description="Auction house directory, watchlists, bidding, and bid approval workflow"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New listing</Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total listings', value: stats.total }, { label: 'Pending', value: stats.pending },
        { label: 'Won', value: stats.won }, { label: 'Total bids', value: stats.bids },
      ].map((s) => (
        <Card key={s.label} className="erp-stat-card rounded-md shadow-sm">
          <CardContent className="p-3.5 sm:p-4">
            <p className="erp-stat-label">{s.label}</p>
            <p className="erp-stat-value">{s.value}</p>
          </CardContent>
        </Card>
      ))}</div>
      <StockListFilters
        total={filtered.length}
        totalLabel="Total stocks"
        value={listFilters}
        onChange={onListFiltersChange}
        statusOptions={AUCTION_STATUS_OPTIONS}
        makeOptions={makeOptions}
        modelOptions={modelOptions}
        searchPlaceholder="Search stock ID, chassis, make…"
        showCustomer={false}
        showAgent={false}
      />
      <Card className="overflow-hidden border-border/60">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Loading listings...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <Gavel className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold">No auction listings found</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create a listing to get started.</p>
            <div className="mt-4">
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />New listing
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/70">
              {paged.map((listing) => (
                <div key={listing.id} className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Gavel className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{listing.make} {listing.model}</p>
                        <Badge variant="outline" className={resultStyles[listing.result]}>{listing.result}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {listing.listing_code} · {listing.chassis_number || 'No chassis'}
                        {listing.auction_date ? ` · ${format(new Date(listing.auction_date), 'MMM d, yyyy')}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {listing.start_price
                          ? `${listing.currency} ${listing.start_price.toLocaleString()}`
                          : 'No start price'}
                      </p>
                      {listing.result === 'pending' && (
                        <div className="mt-1 flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => placeBid(listing.id)} disabled={submitting}>Bid</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markResult(listing, 'won')}>Won</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markResult(listing, 'lost')}>Lost</Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {bids[listing.id] && bids[listing.id].length > 0 && (
                    <div className="mt-3 ml-14 space-y-1.5">
                      {bids[listing.id].map((bid) => (
                        <div key={bid.id} className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-1.5">
                          <Badge variant="outline" className={bidStatusStyles[bid.status]}>{bid.status}</Badge>
                          <span className="text-sm font-medium">{bid.currency} {bid.bid_amount.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(bid.created_at), 'MMM d, h:mm a')}</span>
                          {bid.status === 'pending' && (
                            <>
                              <Button size="sm" variant="outline" className="ml-auto h-6 px-2 text-xs" onClick={() => approveBid(bid)}>
                                <CheckCircle2 className="mr-1 h-3 w-3" />Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => rejectBid(bid)}>
                                <XCircle className="mr-1 h-3 w-3" />Reject
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 pb-4">
              <StockListPagination
                page={safePage}
                pageSize={pageSize}
                total={filtered.length}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </div>
          </>
        )}
      </Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent fullscreen><DialogHeader><DialogTitle>New auction listing</DialogTitle></DialogHeader><form onSubmit={submitListing} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Auction house</Label><AuctionHouseSelect value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })} houses={auctionHouses} onHousesChange={setAuctionHouses} disabled={submitting} /></div><div className="space-y-2"><Label>Lot number</Label><Input value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required /></div><div className="space-y-2"><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required /></div><div className="space-y-2"><Label>Year</Label><Input type="number" value={form.model_year} onChange={(e) => setForm({ ...form, model_year: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Auction date</Label><Input type="date" value={form.auction_date} onChange={(e) => setForm({ ...form, auction_date: e.target.value })} /></div><div className="space-y-2"><Label>Start price</Label><Input type="number" value={form.start_price} onChange={(e) => setForm({ ...form, start_price: e.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="space-y-2"><Label>Chassis number</Label><Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} /></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="submit" disabled={submitting || !form.make.trim() || !form.model.trim()}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create listing'}</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent fullscreen><DialogHeader><DialogTitle>Edit auction listing</DialogTitle></DialogHeader><form onSubmit={submitEdit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Auction house</Label><AuctionHouseSelect value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })} houses={auctionHouses} onHousesChange={setAuctionHouses} disabled={submitting} /></div><div className="space-y-2"><Label>Lot number</Label><Input value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required /></div><div className="space-y-2"><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required /></div><div className="space-y-2"><Label>Year</Label><Input type="number" value={form.model_year} onChange={(e) => setForm({ ...form, model_year: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Auction date</Label><Input type="date" value={form.auction_date} onChange={(e) => setForm({ ...form, auction_date: e.target.value })} /></div><div className="space-y-2"><Label>Start price</Label><Input type="number" value={form.start_price} onChange={(e) => setForm({ ...form, start_price: e.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="space-y-2"><Label>Chassis number</Label><Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} /></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save changes'}</Button></DialogFooter></form></DialogContent></Dialog>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete listing?" description="This will permanently remove the auction listing and its bids." confirmLabel="Delete permanently" destructive loading={submitting} onConfirm={confirmDelete} />
    </div>
  );
}

export default function AuctionsPageRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />Loading listings...
        </div>
      }
    >
      <AuctionsPage />
    </Suspense>
  );
}
