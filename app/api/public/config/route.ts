import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ALLOWED=['currencies','freight_destinations','incoterms','shipment_types','shipping_options'];
function values(value:unknown,keys:string[]):string[]{
 if(Array.isArray(value))return value.filter((v):v is string=>typeof v==='string');
 if(value&&typeof value==='object'){const o=value as Record<string,unknown>;for(const k of keys)if(Array.isArray(o[k]))return (o[k] as unknown[]).filter((v):v is string=>typeof v==='string');}
 return [];
}
export async function GET(){
 const fallback={freight_destinations:['Australia','Bangladesh','Ghana','Kenya','Malaysia','New Zealand','Pakistan','Singapore','South Africa','Sri Lanka','Tanzania','Thailand','United Arab Emirates','United Kingdom','Zambia'],currencies:['JPY','USD','EUR','GBP','PKR'],incoterms:['FOB','CFR','CIF','EXW'],shipment_types:['RORO','Container','Bulk']};
 try{
  const db=await createServerClient();
  const {data,error}=await db.from('system_config').select('key,value').in('key',ALLOWED);
  if(error)throw error;
  const raw=Object.fromEntries((data||[]).map(r=>[r.key,r.value]));
  const currencies=values(raw.currencies,['enabled','values','options']);
  const destinations=values(raw.freight_destinations,['countries','values','options']);
  const incoterms=values(raw.incoterms,['enabled','values','options']);
  const shipmentTypes=values(raw.shipment_types,['enabled','values','options','methods']);
  const shipping=raw.shipping_options&&typeof raw.shipping_options==='object'?raw.shipping_options as Record<string,unknown>:{};
  return NextResponse.json({
   currencies:currencies.length?currencies:fallback.currencies,
   freight_destinations:destinations.length?destinations:fallback.freight_destinations,
   incoterms:incoterms.length?incoterms:fallback.incoterms,
   shipment_types:shipmentTypes.length?shipmentTypes:fallback.shipment_types,
   shipping_options:shipping
  },{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300'}});
 }catch{return NextResponse.json({...fallback,shipping_options:{methods:['RORO','Container'],incoterms:['FOB','CFR','CIF'],ports_of_loading:['Nagoya, Japan','Yokohama, Japan','Kobe, Japan']}});}
}
