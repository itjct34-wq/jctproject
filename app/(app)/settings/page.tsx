'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building2, FileText, Banknote, Sliders, Save, Loader2, User, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { CompanySettings } from '@/lib/types';
import { CurrencySelect } from '@/components/ui/currency-select';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { isAdmin } = usePermissions();
  const { profile, refreshProfile } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [preferredCurrency, setPreferredCurrency] = useState('USD');
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
    setSettings(data as CompanySettings | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPreferredCurrency((profile as { preferred_currency?: string }).preferred_currency || 'USD');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from('company_settings')
      .update({
        company_name: settings.company_name,
        legal_name: settings.legal_name,
        address_line1: settings.address_line1,
        address_line2: settings.address_line2,
        city: settings.city,
        prefecture: settings.prefecture,
        postal_code: settings.postal_code,
        country: settings.country,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        tax_id: settings.tax_id,
        default_currency: settings.default_currency,
        invoice_prefix: settings.invoice_prefix,
        invoice_next_number: settings.invoice_next_number,
        quotation_prefix: settings.quotation_prefix,
        quotation_next_number: settings.quotation_next_number,
        timezone: settings.timezone,
        date_format: settings.date_format,
        reservation_default_days: settings.reservation_default_days,
        low_stock_alert_days: settings.low_stock_alert_days,
        payment_instructions: settings.payment_instructions,
      })
      .eq('id', settings.id);

    setSaving(false);
    if (error) {
      toast.error('Failed to save settings: ' + error.message);
      return;
    }
    toast.success('Settings saved successfully');
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        preferred_currency: preferredCurrency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Profile updated');
    if (typeof refreshProfile === 'function') await refreshProfile();
  };

  const uploadAvatar = async (file: File) => {
    if (!profile) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setAvatarUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${profile.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (upErr) {
      // Fallback: store as data URL if bucket missing
      if (upErr.message.toLowerCase().includes('bucket') || upErr.message.toLowerCase().includes('not found')) {
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = String(reader.result);
          await supabase.from('profiles').update({ avatar_url: dataUrl, updated_at: new Date().toISOString() }).eq('id', profile.id);
          toast.success('Avatar saved (inline). Create public "avatars" Storage bucket for CDN URLs.');
          if (typeof refreshProfile === 'function') await refreshProfile();
          setAvatarUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }
      setAvatarUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    setAvatarUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Profile photo updated');
    if (typeof refreshProfile === 'function') await refreshProfile();
  };

  const update = (field: keyof CompanySettings, value: string | number) => {
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const canEdit = isAdmin();
  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Configuration"
        description="Profile, company details, currencies, and system preferences"
        actions={
          canEdit && settings && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving...</>
              ) : (
                <><Save className="w-4 h-4 mr-1.5" />Save company</>
              )}
            </Button>
          )
        }
      />

      <Tabs defaultValue="profile">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="profile"><User className="w-4 h-4 mr-1.5" />My profile</TabsTrigger>
          <TabsTrigger value="company"><Building2 className="w-4 h-4 mr-1.5" />Company</TabsTrigger>
          <TabsTrigger value="invoicing"><FileText className="w-4 h-4 mr-1.5" />Invoicing</TabsTrigger>
          <TabsTrigger value="finance"><Banknote className="w-4 h-4 mr-1.5" />Finance</TabsTrigger>
          <TabsTrigger value="system"><Sliders className="w-4 h-4 mr-1.5" />System</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base">Profile & photo</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-20 h-20">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
                    <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-1 -right-1 rounded-full bg-primary text-primary-foreground p-1.5 shadow hover:bg-primary/90"
                    aria-label="Upload photo"
                  >
                    {avatarUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAvatar(f);
                    }}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{profile?.email}</p>
                  <p className="mt-1">JPG/PNG up to 2MB. Create a public Storage bucket named <code className="text-xs">avatars</code> for best results.</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Preferred currency</Label>
                  <CurrencySelect value={preferredCurrency} onValueChange={setPreferredCurrency} />
                </div>
              </div>
              <Button size="sm" onClick={saveProfile} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                Save profile
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-4">
          {!settings ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No company settings found. Run the database migration.</CardContent></Card>
          ) : (
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-base">Company Information</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Company Name</Label><Input value={settings.company_name} onChange={(e) => update('company_name', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Legal Name</Label><Input value={settings.legal_name || ''} onChange={(e) => update('legal_name', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Address Line 1</Label><Input value={settings.address_line1 || ''} onChange={(e) => update('address_line1', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Address Line 2</Label><Input value={settings.address_line2 || ''} onChange={(e) => update('address_line2', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>City</Label><Input value={settings.city || ''} onChange={(e) => update('city', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Prefecture / State</Label><Input value={settings.prefecture || ''} onChange={(e) => update('prefecture', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Postal Code</Label><Input value={settings.postal_code || ''} onChange={(e) => update('postal_code', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Country</Label><Input value={settings.country || ''} onChange={(e) => update('country', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={settings.phone || ''} onChange={(e) => update('phone', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={settings.email || ''} onChange={(e) => update('email', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Website</Label><Input value={settings.website || ''} onChange={(e) => update('website', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Tax ID</Label><Input value={settings.tax_id || ''} onChange={(e) => update('tax_id', e.target.value)} disabled={!canEdit} /></div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invoicing" className="space-y-4">
          {settings && (
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-base">Invoice & Quotation Numbering</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Invoice Prefix</Label><Input value={settings.invoice_prefix} onChange={(e) => update('invoice_prefix', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Next Invoice Number</Label><Input type="number" value={settings.invoice_next_number} onChange={(e) => update('invoice_next_number', parseInt(e.target.value) || 1)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Quotation Prefix</Label><Input value={settings.quotation_prefix} onChange={(e) => update('quotation_prefix', e.target.value)} disabled={!canEdit} /></div>
                <div className="space-y-2"><Label>Next Quotation Number</Label><Input type="number" value={settings.quotation_next_number} onChange={(e) => update('quotation_next_number', parseInt(e.target.value) || 1)} disabled={!canEdit} /></div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="finance" className="space-y-4">
          {settings && (
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-base">Currency & Payment</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <CurrencySelect value={settings.default_currency} onValueChange={(v) => update('default_currency', v)} disabled={!canEdit} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label>Payment Instructions</Label>
                  <Textarea value={settings.payment_instructions || ''} onChange={(e) => update('payment_instructions', e.target.value)} disabled={!canEdit} rows={4} placeholder="Bank transfer instructions for customers..." />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          {settings && (
            <Card className="border-border/60">
              <CardHeader><CardTitle className="text-base">System Preferences</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(v) => update('timezone', v)} disabled={!canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                      <SelectItem value="Asia/Karachi">Asia/Karachi (PKT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select value={settings.date_format} onValueChange={(v) => update('date_format', v)} disabled={!canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Reservation Duration (days)</Label>
                  <Input type="number" value={settings.reservation_default_days} onChange={(e) => update('reservation_default_days', parseInt(e.target.value) || 7)} disabled={!canEdit} />
                </div>
                <div className="space-y-2">
                  <Label>Low Stock Alert (days)</Label>
                  <Input type="number" value={settings.low_stock_alert_days} onChange={(e) => update('low_stock_alert_days', parseInt(e.target.value) || 60)} disabled={!canEdit} />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
