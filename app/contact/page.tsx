'use client';
import { useEffect,useState } from 'react';
import { PublicShell } from '@/components/public/public-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CurrencySelect } from '@/components/ui/currency-select';
import { toast } from 'sonner';
import { Loader2,Send,CheckCircle2 } from 'lucide-react';
const defaults=['Australia','Bangladesh','Ghana','Kenya','Malaysia','New Zealand','Pakistan','Singapore','South Africa','Sri Lanka','Tanzania','Thailand','United Arab Emirates','United Kingdom','Zambia'];
export default function ContactPage(){
 const [form,setForm]=useState({full_name:'',email:'',phone:'',company_name:'',destination_country:'',destination_port:'',vehicle_make:'',vehicle_model:'',year_from:'',year_to:'',budget_min:'',budget_max:'',currency:'USD',incoterm:'FOB',quantity:'1',message:''});
 const [destinations,setDestinations]=useState(defaults);const [busy,setBusy]=useState(false);const [code,setCode]=useState('');
 useEffect(()=>{fetch('/api/public/config').then(r=>r.ok?r.json():null).then(d=>{if(Array.isArray(d?.freight_destinations)&&d.freight_destinations.length)setDestinations(d.freight_destinations)}).catch(()=>{});},[]);
 const set=(key:string,value:string)=>setForm(p=>({...p,[key]:value}));
 const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setCode('');
 const row={full_name:form.full_name.trim(),email:form.email.trim().toLowerCase(),phone:form.phone.trim()||null,company_name:form.company_name.trim()||null,destination_country:form.destination_country||null,destination_port:form.destination_port.trim()||null,vehicle_make:form.vehicle_make.trim()||null,vehicle_model:form.vehicle_model.trim()||null,year_from:form.year_from?Number(form.year_from):null,year_to:form.year_to?Number(form.year_to):null,budget_min:form.budget_min?Number(form.budget_min):null,budget_max:form.budget_max?Number(form.budget_max):null,currency:form.currency,incoterm:form.incoterm,quantity:Number(form.quantity)||1,message:form.message.trim(),website_url:''};
 const response=await fetch('/api/public/inquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row)});const result=await response.json();setBusy(false);
 if(!response.ok){toast.error(result.error||'Could not submit inquiry. Please try again.');return;}setCode(result.inquiry_code);toast.success('Inquiry received.');};
 return <PublicShell><section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Sales inquiry</p><h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">Tell us what you want to import</h1><p className="mt-3 text-sm text-zinc-400">Submit your requirements once. Our team can track your request, assign an owner, follow up and prepare a quotation.</p>
 {code?<div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-6 text-white"><CheckCircle2 className="h-8 w-8 text-emerald-400"/><h2 className="mt-3 text-xl font-semibold">Inquiry received</h2><p className="mt-2 text-sm">Reference: <strong className="font-mono">{code}</strong></p><Button className="mt-4" onClick={()=>{setCode('');setForm({full_name:'',email:'',phone:'',company_name:'',destination_country:'',destination_port:'',vehicle_make:'',vehicle_model:'',year_from:'',year_to:'',budget_min:'',budget_max:'',currency:'USD',incoterm:'FOB',quantity:'1',message:''})}}>Submit another inquiry</Button></div>:
 <form onSubmit={submit} className="mt-8 space-y-6 rounded-2xl border border-white/10 bg-zinc-950/70 p-5 md:p-7">
 <h2 className="font-semibold text-white">Contact details</h2><div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2"><Label className="text-zinc-300">Full name *</Label><Input required minLength={2} maxLength={160} value={form.full_name} onChange={e=>set('full_name',e.target.value)} /></div>
 <div className="space-y-2"><Label className="text-zinc-300">Email *</Label><Input required type="email" maxLength={254} value={form.email} onChange={e=>set('email',e.target.value)} /></div>
 <div className="space-y-2"><Label className="text-zinc-300">Phone / WhatsApp</Label><Input maxLength={40} value={form.phone} onChange={e=>set('phone',e.target.value)} /></div>
 <div className="space-y-2"><Label className="text-zinc-300">Company</Label><Input maxLength={200} value={form.company_name} onChange={e=>set('company_name',e.target.value)} /></div></div>
 <h2 className="font-semibold text-white">Vehicle and destination</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 <div className="space-y-2"><Label className="text-zinc-300">Destination country</Label><select value={form.destination_country} onChange={e=>set('destination_country',e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white"><option value="">Choose country</option>{destinations.map(c=><option key={c}>{c}</option>)}</select></div>
 <div className="space-y-2"><Label className="text-zinc-300">Destination port</Label><Input maxLength={120} value={form.destination_port} onChange={e=>set('destination_port',e.target.value)} /></div>
 <div className="space-y-2"><Label className="text-zinc-300">Quantity</Label><Input type="number" min="1" max="1000" required value={form.quantity} onChange={e=>set('quantity',e.target.value)} /></div>
 <div className="space-y-2"><Label className="text-zinc-300">Make</Label><Input maxLength={100} value={form.vehicle_make} onChange={e=>set('vehicle_make',e.target.value)} /></div>
 <div className="space-y-2"><Label className="text-zinc-300">Model</Label><Input maxLength={100} value={form.vehicle_model} onChange={e=>set('vehicle_model',e.target.value)} /></div>
 <div className="space-y-2"><Label className="text-zinc-300">Trade term</Label><select value={form.incoterm} onChange={e=>set('incoterm',e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm text-white"><option>FOB</option><option>CFR</option><option>CIF</option><option>EXW</option></select></div>
 <div className="space-y-2"><Label className="text-zinc-300">Year from</Label><Input type="number" min="1950" max="2100" value={form.year_from} onChange={e=>set('year_from',e.target.value)} /></div>
 <div className="space-y-2"><Label className="text-zinc-300">Year to</Label><Input type="number" min="1950" max="2100" value={form.year_to} onChange={e=>set('year_to',e.target.value)} /></div></div>
 <h2 className="font-semibold text-white">Budget</h2><div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label className="text-zinc-300">Currency</Label><CurrencySelect value={form.currency} onValueChange={v=>set('currency',v)}/></div><div className="space-y-2"><Label className="text-zinc-300">Budget minimum</Label><Input type="number" min="0" value={form.budget_min} onChange={e=>set('budget_min',e.target.value)}/></div><div className="space-y-2"><Label className="text-zinc-300">Budget maximum</Label><Input type="number" min="0" value={form.budget_max} onChange={e=>set('budget_max',e.target.value)}/></div></div>
 <div className="space-y-2"><Label className="text-zinc-300">Requirements *</Label><Textarea required minLength={5} maxLength={8000} rows={5} value={form.message} onChange={e=>set('message',e.target.value)} placeholder="Models, specifications, target budget, delivery timing…"/></div>
 <Button type="submit" disabled={busy} className="w-full bg-red-600 hover:bg-red-500 sm:w-auto">{busy?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Submitting…</>:<><Send className="mr-2 h-4 w-4"/>Submit inquiry</>}</Button></form>}
 <p className="mt-6 text-center text-xs text-zinc-500">Prefer to speak directly? <a href="tel:+817022416356" className="text-red-400">+81 70-2241-6356</a></p></section></PublicShell>;
}