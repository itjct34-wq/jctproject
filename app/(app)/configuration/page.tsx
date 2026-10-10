'use client';
import { useCallback,useEffect,useState } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/lib/auth-provider';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/layout/page-header';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2,Save,ShieldAlert,Settings2 } from 'lucide-react';
import { toast } from 'sonner';
type ConfigRow={key:string;value:unknown;description:string|null};
function configValues(value:unknown,keys:string[]):string[]{if(Array.isArray(value))return value.filter((v):v is string=>typeof v==='string');if(value&&typeof value==='object'){const o=value as Record<string,unknown>;for(const k of keys)if(Array.isArray(o[k]))return (o[k] as unknown[]).filter((v):v is string=>typeof v==='string');}return [];}
const CONFIGS=[
 {key:'currencies',label:'Supported currencies',help:'One ISO currency code per line, e.g. JPY, USD, EUR, GBP, PKR.'},
 {key:'freight_destinations',label:'Freight destination countries',help:'One destination country per line. Used by public inquiries and future shipping forms.'},
 {key:'incoterms',label:'Trade terms',help:'One trade term per line, e.g. FOB, CFR, CIF, EXW.'},
 {key:'shipment_types',label:'Shipment types',help:'One shipment type per line, e.g. RORO, Container, Bulk.'},
];
export default function ConfigurationPage(){
 const {isSuperAdmin}=usePermissions();const {profile}=useAuth();
 const [rows,setRows]=useState<Record<string,ConfigRow>>({});const [values,setValues]=useState<Record<string,string>>({});const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
 const load=useCallback(async()=>{setLoading(true);const {data,error}=await supabase.from('system_config').select('key,value,description').in('key',CONFIGS.map(c=>c.key));if(error)toast.error(error.message);else{const map:Record<string,ConfigRow>={};const text:Record<string,string>={};(data||[]).forEach((r:any)=>{map[r.key]=r;text[r.key]=configValues(r.value,r.key==='currencies'?['enabled','values','options']:r.key==='freight_destinations'?['countries','values','options']:['enabled','values','options','methods']).join('\n')});setRows(map);setValues(text);}setLoading(false);},[]);
 useEffect(()=>{void load();},[load]);
 const save=async()=>{if(!isSuperAdmin()){toast.error('Only super admins can change global configuration.');return;}setSaving(true);
 for(const c of CONFIGS){const list=(values[c.key]||'').split('\n').map(s=>s.trim()).filter(Boolean);if(!list.length){toast.error(c.label+' cannot be empty');setSaving(false);return;}if(new Set(list.map(s=>s.toLowerCase())).size!==list.length){toast.error(c.label+' contains duplicates');setSaving(false);return;}
 const normalized=c.key==='currencies'?list.map(s=>s.toUpperCase()):list;
 if(c.key==='currencies'&&normalized.some(s=>!/^[A-Z]{3}$/.test(s))){toast.error('Currency codes must be three-letter ISO codes.');setSaving(false);return;}
 const {error}=await supabase.from('system_config').upsert({key:c.key,value:normalized,description:c.help,updated_by:profile?.id||null,updated_at:new Date().toISOString()},{onConflict:'key'});
 if(error){toast.error('Could not save '+c.label+': '+error.message);setSaving(false);return;}
 }
 setSaving(false);toast.success('Reusable configuration saved');await load();};
 if(!isSuperAdmin())return <div className="mx-auto max-w-xl py-16 text-center"><ShieldAlert className="mx-auto h-10 w-10 text-destructive"/><h1 className="mt-4 text-xl font-semibold">Super-admin access required</h1><p className="mt-2 text-sm text-muted-foreground">Only super admins can change global currencies, destinations and shipping options.</p></div>;
 return <div className="space-y-6"><PageHeader title="Global configuration" description="Maintain reusable values used across the ERP and public inquiry forms." actions={<Button onClick={()=>void save()} disabled={loading||saving}>{saving?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>}Save configuration</Button>}/>
 <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground"><Settings2 className="mr-2 inline h-4 w-4"/>Values here are global. Removing a currency or destination does not rewrite historical invoices, quotations or inquiries.</div>
 {loading?<div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin"/></div>:<div className="grid gap-4 lg:grid-cols-2">{CONFIGS.map(c=><Card key={c.key}><CardHeader><CardTitle className="text-base">{c.label}</CardTitle><p className="text-sm text-muted-foreground">{c.help}</p></CardHeader><CardContent className="space-y-2"><Label htmlFor={c.key}>One value per line</Label><Textarea id={c.key} rows={8} spellCheck={false} value={values[c.key]||''} onChange={e=>setValues(v=>({...v,[c.key]:e.target.value}))} placeholder={c.label}/><p className="text-xs text-muted-foreground">{(values[c.key]||'').split('\n').filter(s=>s.trim()).length} values</p></CardContent></Card>)}</div>}</div>;
}
