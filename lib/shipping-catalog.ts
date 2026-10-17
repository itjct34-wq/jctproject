import type { SupabaseClient } from '@supabase/supabase-js';

export type ShippingLineRow = {
  id: string;
  name: string;
  code: string | null;
  country: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
};

export type VesselRow = {
  id: string;
  name: string;
  shipping_line_id: string | null;
  imo_number: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
};

export type VoyageRow = {
  id: string;
  voyage_number: string;
  vessel_id: string | null;
  shipping_line_id: string | null;
  etd: string | null;
  eta: string | null;
  status: 'active' | 'inactive' | 'completed';
  notes: string | null;
};

export type VehicleMakeRow = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  sort_order: number;
};

export type VehicleModelRow = {
  id: string;
  make_id: string;
  name: string;
  status: 'active' | 'inactive';
  sort_order: number;
};

export async function fetchShippingLines(supabase: SupabaseClient, activeOnly = true) {
  let q = supabase.from('shipping_lines').select('*').order('name');
  if (activeOnly) q = q.eq('status', 'active');
  const { data, error } = await q.limit(500);
  return { data: (data || []) as ShippingLineRow[], error };
}

export async function fetchVessels(supabase: SupabaseClient, activeOnly = true, lineId?: string | null) {
  let q = supabase.from('vessels').select('*').order('name');
  if (activeOnly) q = q.eq('status', 'active');
  if (lineId) q = q.eq('shipping_line_id', lineId);
  const { data, error } = await q.limit(500);
  return { data: (data || []) as VesselRow[], error };
}

export async function fetchVoyages(supabase: SupabaseClient, activeOnly = true, vesselId?: string | null) {
  let q = supabase.from('voyages').select('*').order('voyage_number');
  if (activeOnly) q = q.in('status', ['active']);
  if (vesselId) q = q.eq('vessel_id', vesselId);
  const { data, error } = await q.limit(500);
  return { data: (data || []) as VoyageRow[], error };
}

export async function fetchVehicleMakes(supabase: SupabaseClient, activeOnly = true) {
  let q = supabase.from('vehicle_makes').select('*').order('sort_order').order('name');
  if (activeOnly) q = q.eq('status', 'active');
  const { data, error } = await q.limit(500);
  return { data: (data || []) as VehicleMakeRow[], error };
}

export async function fetchVehicleModels(
  supabase: SupabaseClient,
  makeId?: string | null,
  activeOnly = true
) {
  let q = supabase.from('vehicle_models').select('*').order('sort_order').order('name');
  if (activeOnly) q = q.eq('status', 'active');
  if (makeId) q = q.eq('make_id', makeId);
  const { data, error } = await q.limit(1000);
  return { data: (data || []) as VehicleModelRow[], error };
}
