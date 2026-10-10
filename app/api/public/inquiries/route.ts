import { NextRequest,NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.object({
 full_name:z.string().trim().min(2).max(160),
 email:z.string().trim().email().max(254),
 phone:z.string().trim().max(40).nullable().optional(),
 company_name:z.string().trim().max(200).nullable().optional(),
 destination_country:z.string().trim().max(120).nullable().optional(),
 destination_port:z.string().trim().max(120).nullable().optional(),
 vehicle_make:z.string().trim().max(100).nullable().optional(),
 vehicle_model:z.string().trim().max(100).nullable().optional(),
 year_from:z.number().int().min(1950).max(2100).nullable().optional(),
 year_to:z.number().int().min(1950).max(2100).nullable().optional(),
 budget_min:z.number().min(0).max(1e12).nullable().optional(),
 budget_max:z.number().min(0).max(1e12).nullable().optional(),
 currency:z.string().regex(/^[A-Z]{3}$/),
 incoterm:z.string().trim().min(2).max(20),
 quantity:z.number().int().min(1).max(1000),
 message:z.string().trim().min(5).max(8000),
 website_url:z.string().optional()
}).refine(d=>!d.year_from||!d.year_to||d.year_from<=d.year_to,{message:'Year range is invalid',path:['year_to']})
.refine(d=>d.budget_min==null||d.budget_max==null||d.budget_min<=d.budget_max,{message:'Budget range is invalid',path:['budget_max']});
function listValue(value:unknown):string[]|null{
 if(Array.isArray(value))return value.filter((v):v is string=>typeof v==='string');
 if(value&&typeof value==='object'){
  const obj=value as Record<string,unknown>;
  for(const k of ['enabled','countries','values','options','methods'])if(Array.isArray(obj[k]))return (obj[k] as unknown[]).filter((v):v is string=>typeof v==='string');
 }
 return null;
}
export async function POST(request:NextRequest){
 try{
  const body=await request.json();
  if(typeof body.website_url==='string'&&body.website_url.trim())return NextResponse.json({error:'Invalid submission'},{status:400});
  const parsed=schema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:'Please check the inquiry fields.',details:parsed.error.flatten().fieldErrors},{status:400});
  const {website_url,...data}=parsed.data;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret)return NextResponse.json({error:'Inquiry service is not configured.'},{status:503});
  const ip=(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'unknown').split(',')[0].trim();
  const ipHash=createHash('sha256').update(secret).update(':inquiry:').update(ip).digest('hex');
  const db=await createServerClient();
  const since=new Date(Date.now()-10*60*1000).toISOString();
  const {count}=await db.from('inquiry_submission_attempts').select('id',{count:'exact',head:true}).eq('ip_hash',ipHash).gte('attempted_at',since);
  if((count||0)>=5)return NextResponse.json({error:'Too many inquiries from this connection. Please try again in 10 minutes.'},{status:429});
  const {data:config}=await db.from('system_config').select('key,value').in('key',['currencies','freight_destinations','incoterms']);
  const configs=Object.fromEntries((config||[]).map(r=>[r.key,r.value]));
  const currencies=listValue(configs.currencies)||['JPY','USD','EUR','GBP','PKR'];
  const destinations=listValue(configs.freight_destinations)||[];
  const terms=listValue(configs.incoterms)||['FOB','CFR','CIF','EXW'];
  if(!currencies.includes(data.currency))return NextResponse.json({error:'Please select a supported currency.'},{status:400});
  if(!terms.includes(data.incoterm))return NextResponse.json({error:'Please select a supported trade term.'},{status:400});
  if(data.destination_country&&destinations.length&&!destinations.includes(data.destination_country))return NextResponse.json({error:'Please select a configured destination country.'},{status:400});
  await db.from('inquiry_submission_attempts').insert({ip_hash:ipHash});
  const {data:created,error}=await db.from('inquiries').insert({
   full_name:data.full_name,email:data.email.toLowerCase(),phone:data.phone||null,company_name:data.company_name||null,
   destination_country:data.destination_country||null,destination_port:data.destination_port||null,
   vehicle_make:data.vehicle_make||null,vehicle_model:data.vehicle_model||null,year_from:data.year_from??null,year_to:data.year_to??null,
   budget_min:data.budget_min??null,budget_max:data.budget_max??null,
   quantity:data.quantity,currency:data.currency,incoterm:data.incoterm,
   message:data.message,status:'new',source:'website'
  }).select('inquiry_code').single();
  if(error)return NextResponse.json({error:'Could not save inquiry. Please try again.'},{status:500});
  return NextResponse.json({success:true,inquiry_code:created.inquiry_code},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Inquiry service temporarily unavailable.'},{status:500});}
}
