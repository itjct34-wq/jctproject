import { NextRequest,NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServerClient } from '@/lib/supabase/server';
import { verifyAgentTotp } from '@/lib/server/agent-totp';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 try{
  const body=await request.json();
  const agentCode=typeof body.agent_code==='string'?body.agent_code.trim().toUpperCase():'';
  const code=typeof body.code==='string'?body.code.trim():'';
  if(!/^[A-Z0-9-]{3,40}$/.test(agentCode)||!/^\d{6}$/.test(code))return NextResponse.json({valid:false,message:'Enter the representative ID and current six-digit code.'},{status:400});
  const ip=(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'unknown').split(',')[0].trim();
  const ipHash=createHash('sha256').update(process.env.AGENT_TOTP_SECRET||'rate-limit-fallback').update(':').update(ip).digest('hex');
  const db=await createServerClient();
  const since=new Date(Date.now()-15*60*1000).toISOString();
  const {count}=await db.from('agent_verification_attempts').select('id',{count:'exact',head:true}).eq('ip_hash',ipHash).gte('attempted_at',since);
  if((count||0)>=12)return NextResponse.json({valid:false,message:'Too many attempts. Please try again in 15 minutes.'},{status:429});
  const {data:agent}=await db.from('agent_verifications').select('id,agent_code,full_name,title,email,phone,photo_url,is_active,verified_until,representative_type,totp_enabled').eq('agent_code',agentCode).maybeSingle();
  let valid=false;
  if(agent&&agent.is_active&&agent.totp_enabled&&(!agent.verified_until||agent.verified_until>=new Date().toISOString().slice(0,10))){
   try{valid=verifyAgentTotp(agent.id,code);}catch{return NextResponse.json({valid:false,message:'Verification service is not configured. Please contact the company.'},{status:503});}
  }
  const agentCodeHash=createHash('sha256').update(agentCode).digest('hex');
  await db.from('agent_verification_attempts').insert({agent_code_hash:agentCodeHash,ip_hash:ipHash,succeeded:valid});
  if(!valid||!agent)return NextResponse.json({valid:false,message:'Invalid, expired or inactive verification code. Ask the representative to display their current code.'},{status:401});
  return NextResponse.json({valid:true,agent:{agent_code:agent.agent_code,full_name:agent.full_name,title:agent.title,email:agent.email,phone:agent.phone,photo_url:agent.photo_url,representative_type:agent.representative_type,verified_until:agent.verified_until},verified_at:new Date().toISOString(),expires_in_seconds:Math.max(0,30-Math.floor((Date.now()%30000)/1000))},{headers:{'Cache-Control':'no-store, max-age=0'}});
 }catch{return NextResponse.json({valid:false,message:'Verification service temporarily unavailable.'},{status:500});}
}
