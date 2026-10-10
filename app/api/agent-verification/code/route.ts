import { NextRequest,NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { agentTotp } from '@/lib/server/agent-totp';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const header=request.headers.get('authorization')||'';
 const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
 if(!token)return NextResponse.json({error:'Not authenticated'},{status:401});
 try{
  const db=await createServerClient();
  const {data:caller,error}=await db.auth.getUser(token);
  if(error||!caller.user)return NextResponse.json({error:'Not authenticated'},{status:401});
  const {data:roleRows}=await db.from('user_roles').select('role_id').eq('user_id',caller.user.id);
  const roleIds=(roleRows||[]).map(r=>r.role_id);
  const {data:roles}=roleIds.length?await db.from('roles').select('name').in('id',roleIds):{data:[] as {name:string}[]};
  const isAdmin=(roles||[]).some(r=>r.name==='super_admin'||r.name==='admin');
  const agentId=request.nextUrl.searchParams.get('agentId');
  let query=db.from('agent_verifications').select('id,agent_code,full_name,verified_until,is_active,totp_enabled,user_id');
  if(agentId&&isAdmin)query=query.eq('id',agentId);
  else query=query.eq('user_id',caller.user.id);
  const {data:agent,error:agentError}=await query.maybeSingle();
  if(agentError||!agent||(!isAdmin&&agent.user_id!==caller.user.id))return NextResponse.json({error:'No linked representative profile found'},{status:404});
  if(!agent.is_active||!agent.totp_enabled||(agent.verified_until&&agent.verified_until<new Date().toISOString().slice(0,10)))return NextResponse.json({error:'Representative profile is inactive or expired'},{status:403});
  const now=Date.now();const counter=Math.floor(now/30000);
  const code=agentTotp(agent.id,counter);
  return NextResponse.json({agent_code:agent.agent_code,full_name:agent.full_name,code,expires_at:new Date((counter+1)*30000).toISOString(),seconds_remaining:30-Math.floor((now%30000)/1000)},{headers:{'Cache-Control':'no-store, max-age=0, must-revalidate','Pragma':'no-cache'}});
 }catch{return NextResponse.json({error:'Verification service unavailable. Check AGENT_TOTP_SECRET.'},{status:503});}
}
