'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase/client';
import type { AuctionListing, AuctionBid, Supplier } from '@/lib/types';
import { CheckCircle2, ChevronRight, Gavel, Loader2, Plus, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const resultStyles: Record<AuctionListing['result'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200', won: 'bg-emerald-50 text-emerald-700 border-emerald-200', lost: 'bg-slate-100 text-slate-600 border-slate-200', cancelled: 'bg-red-50 text-red-700 border-red-200',
};
const bidStatusStyles: Record<AuctionBid['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200', approved: 'bg-blue-50 text-blue-700 border-blue-200', rejected: 'bg-red-50 text-red-700 border-red-200', won: 'bg-emerald-50 text-emerald-700 border-emerald-200', lost: 'bg-slate-100 text-slate-600 border-slate-200',
};

const emptyForm = { supplier_id: '', chassis_number: '', make: '', model: '', model_year: '', auction_date: '', lot_number: '', start_price: '', currency: 'JPY', notes: '' };

export default function AuctionsPage() {
  const { profile } = useAuth();
  const [listings, setListings] = useState<AuctionListing[]>([]);
  const [bids, setBids] = useState<Record<string, AuctionBid[]>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [listingsRes, suppliersRes] = await Promise.all([
      supabase.from('auction_listings').select('*').order('auction_date', { ascending: false }),
      supabase.from('suppliers').select('id, name, supplier_code').eq('supplier_type', 'auction_house').order('name'),
    ]);
    if (listingsRes.error) toast.error(`Unable to load listings: ${listingsRes.error.message}`);
    else {
      const listingData = (listingsRes.data || []) as AuctionListing[];
      setListings(listingData);
      const bidsRes = await supabase.from('auction_bids').select('*').in('listing_id', listingData.map((l) => l.id)).order('created_at', { ascending: false });
      if (!bidsRes.error && bidsRes.data) {
        const bidMap: Record<string, AuctionBid[]> = {};
        (bidsRes.data as AuctionBid[]).forEach((bid) => { if (!bidMap[bid.listing_id]) bidMap[bid.listing_id] = []; bidMap[bid.listing_id].push(bid); });
        setBids(bidMap);
      }
    }
    if (suppliersRes.data) setSuppliers(suppliersRes.data as Supplier[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((l) => {
      const matchesResult = resultFilter === 'all' || l.result === resultFilter;
      const matchesSearch = !q || [l.listing_code, l.chassis_number, l.make, l.model, l.lot_number].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return matchesResult && matchesSearch;
    });
  }, [listings, search, resultFilter]);

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

  const stats = { total: listings.length, pending: listings.filter((l) => l.result === 'pending').length, won: listings.filter((l) => l.result === 'won').length, bids: Object.values(bids).flat().length };

  return (
    <div className="space-y-6">
      <PageHeader title="Auction Stock" description="Auction house directory, watchlists, bidding, and bid approval workflow" actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />New listing</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
        { label: 'Total listings', value: stats.total, tone: 'bg-blue-50 text-blue-600' }, { label: 'Pending', value: stats.pending, tone: 'bg-amber-50 text-amber-600' },
        { label: 'Won', value: stats.won, tone: 'bg-emerald-50 text-emerald-600' }, { label: 'Total bids', value: stats.bids, tone: 'bg-cyan-50 text-cyan-600' },
      ].map((s) => <Card key={s.label} className="border-border/60"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></CardContent></Card>)}</div>
      <Card className="border-border/60"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, chassis, make, lot..." /></div><Select value={resultFilter} onValueChange={setResultFilter}><SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All results</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="won">Won</SelectItem><SelectItem value="lost">Lost</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div></CardContent></Card>
      <Card className="overflow-hidden border-border/60">{loading ? <div className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading listings...</div> : filtered.length === 0 ? <div className="flex flex-col items-center justify-center p-14 text-center"><Gavel className="mb-3 h-10 w-10 text-muted-foreground/50" /><h3 className="font-semibold">No auction listings found</h3><p className="mt-1 text-sm text-muted-foreground">Create a listing or adjust your filters.</p></div> : <div className="divide-y divide-border/70">{filtered.map((listing) => <div key={listing.id} className="p-4"><div className="flex items-center gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Gavel className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{listing.make} {listing.model}</p><Badge variant="outline" className={resultStyles[listing.result]}>{listing.result}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{listing.listing_code} · {listing.chassis_number || 'No chassis'}{listing.auction_date ? ` · ${format(new Date(listing.auction_date), 'MMM d, yyyy')}` : ''}</p></div><div className="text-right"><p className="text-sm font-semibold">{listing.start_price ? `${listing.currency} ${listing.start_price.toLocaleString()}` : 'No start price'}</p>{listing.result === 'pending' && <div className="mt-1 flex gap-1"><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => placeBid(listing.id)} disabled={submitting}>Bid</Button><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markResult(listing, 'won')}>Won</Button><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markResult(listing, 'lost')}>Lost</Button></div>}</div></div>{bids[listing.id] && bids[listing.id].length > 0 && <div className="mt-3 ml-14 space-y-1.5">{bids[listing.id].map((bid) => <div key={bid.id} className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-1.5"><Badge variant="outline" className={bidStatusStyles[bid.status]}>{bid.status}</Badge><span className="text-sm font-medium">{bid.currency} {bid.bid_amount.toLocaleString()}</span><span className="text-xs text-muted-foreground">{format(new Date(bid.created_at), 'MMM d, h:mm a')}</span>{bid.status === 'pending' && <><Button size="sm" variant="outline" className="ml-auto h-6 px-2 text-xs" onClick={() => approveBid(bid)}><CheckCircle2 className="mr-1 h-3 w-3" />Approve</Button><Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => rejectBid(bid)}><XCircle className="mr-1 h-3 w-3" />Reject</Button></>}</div>)}</div>}</div>)}</div>}</Card>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New auction listing</DialogTitle></DialogHeader><form onSubmit={submitListing} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Auction house</Label><Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}><SelectTrigger><SelectValue placeholder="Select auction house" /></SelectTrigger><SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Lot number</Label><Input value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required /></div><div className="space-y-2"><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required /></div><div className="space-y-2"><Label>Year</Label><Input type="number" value={form.model_year} onChange={(e) => setForm({ ...form, model_year: e.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Auction date</Label><Input type="date" value={form.auction_date} onChange={(e) => setForm({ ...form, auction_date: e.target.value })} /></div><div className="space-y-2"><Label>Start price</Label><Input type="number" value={form.start_price} onChange={(e) => setForm({ ...form, start_price: e.target.value })} /></div><div className="space-y-2"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div></div><div className="space-y-2"><Label>Chassis number</Label><Input value={form.chassis_number} onChange={(e) => setForm({ ...form, chassis_number: e.target.value })} /></div><div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div><DialogFooter><Button type="submit" disabled={submitting || !form.make.trim() || !form.model.trim()}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Create listing'}</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}
