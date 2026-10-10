import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const ALLOWED=['currencies','freight_destinations','incoterms','shipment_types'];
export async function GET(){
 try{
  const db=await createServerClient();
  const {data,error}=await db.from('system_config').select('key,value').in('key',ALLOWED);
  if(error) throw error;
  return NextResponse.json(Object.fromEntries((data||[]).map(r=>[r.key,r.value])),{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300'}});
 }catch{
  return NextResponse.json({freight_destinations:['Australia','Bangladesh','Ghana','Kenya','Malaysia','New Zealand','Pakistan','Singapore','South Africa','Sri Lanka','Tanzania','Thailand','United Arab Emirates','United Kingdom','Zambia'],currencies:['JPY','USD','EUR','GBP','PKR'],incoterms:['FOB','CFR','CIF','EXW'],shipment_types:['RORO','Container','Bulk']});
 }
}
