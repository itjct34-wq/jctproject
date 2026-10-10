import { createHmac, timingSafeEqual } from 'crypto';
export function agentTotp(agentId:string,counter:number):string {
 const secret=process.env.AGENT_TOTP_SECRET;
 if(!secret) throw new Error('AGENT_TOTP_SECRET is not configured');
 const digest=createHmac('sha1',secret).update(agentId+':'+counter).digest();
 const offset=digest[digest.length-1]&0x0f;
 const binary=((digest[offset]&0x7f)<<24)|((digest[offset+1]&0xff)<<16)|((digest[offset+2]&0xff)<<8)|(digest[offset+3]&0xff);
 return String(binary%1_000_000).padStart(6,'0');
}
export function verifyAgentTotp(agentId:string,code:string,now=Date.now()):boolean {
 if(!/^\d{6}$/.test(code)) return false;
 const counter=Math.floor(now/30000);
 const expected=Buffer.from(agentTotp(agentId,counter));
 const actual=Buffer.from(code);
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
