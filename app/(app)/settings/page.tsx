'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, FileText, Banknote, Sliders, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { CompanySettings } from '@/lib/types';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { isAdmin } = usePermissions();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
    setSettings(data as CompanySettings | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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

  if (!settings) {
    return (
      <div className="space-y-6">
        <PageHeader title="System Configuration" />
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No company settings found. Please run the database migration.
          </CardContent>
        </Card>
      </div>
    );
  }

  const canEdit = isAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Configuration"
        description="Configure company details, invoicing, and system preferences"
        actions={
          canEdit && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1.5" />
                  Save Changes
                </>
              )}
            </Button>
          )
        }
      />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">
            <Building2 className="w-4 h-4 mr-1.5" />
            Company
          </TabsTrigger>
          <TabsTrigger value="invoicing">
            <FileText className="w-4 h-4 mr-1.5" />
            Invoicing
          </TabsTrigger>
          <TabsTrigger value="finance">
            <Banknote className="w-4 h-4 mr-1.5" />
            Finance
          </TabsTrigger>
          <TabsTrigger value="system">
            <Sliders className="w-4 h-4 mr-1.5" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={settings.company_name}
                  onChange={(e) => update('company_name', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legal_name">Legal Name</Label>
                <Input
                  id="legal_name"
                  value={settings.legal_name || ''}
                  onChange={(e) => update('legal_name', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address1">Address Line 1</Label>
                <Input
                  id="address1"
                  value={settings.address_line1 || ''}
                  onChange={(e) => update('address_line1', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address2">Address Line 2</Label>
                <Input
                  id="address2"
                  value={settings.address_line2 || ''}
                  onChange={(e) => update('address_line2', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={settings.city || ''}
                  onChange={(e) => update('city', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefecture">Prefecture / State</Label>
                <Input
                  id="prefecture"
                  value={settings.prefecture || ''}
                  onChange={(e) => update('prefecture', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal">Postal Code</Label>
                <Input
                  id="postal"
                  value={settings.postal_code || ''}
                  onChange={(e) => update('postal_code', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={settings.country || ''}
                  onChange={(e) => update('country', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={settings.phone || ''}
                  onChange={(e) => update('phone', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => update('email', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={settings.website || ''}
                  onChange={(e) => update('website', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID</Label>
                <Input
                  id="tax_id"
                  value={settings.tax_id || ''}
                  onChange={(e) => update('tax_id', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoicing" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Invoice & Quotation Numbering</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
                <Input
                  id="invoice_prefix"
                  value={settings.invoice_prefix}
                  onChange={(e) => update('invoice_prefix', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_next">Next Invoice Number</Label>
                <Input
                  id="invoice_next"
                  type="number"
                  value={settings.invoice_next_number}
                  onChange={(e) => update('invoice_next_number', parseInt(e.target.value) || 1)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotation_prefix">Quotation Prefix</Label>
                <Input
                  id="quotation_prefix"
                  value={settings.quotation_prefix}
                  onChange={(e) => update('quotation_prefix', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotation_next">Next Quotation Number</Label>
                <Input
                  id="quotation_next"
                  type="number"
                  value={settings.quotation_next_number}
                  onChange={(e) => update('quotation_next_number', parseInt(e.target.value) || 1)}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Currency & Payment</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select
                  value={settings.default_currency}
                  onValueChange={(v) => update('default_currency', v)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="JPY">JPY — Japanese Yen</SelectItem>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                    <SelectItem value="GBP">GBP — British Pound</SelectItem>
                    <SelectItem value="AUD">AUD — Australian Dollar</SelectItem>
                    <SelectItem value="KES">KES — Kenyan Shilling</SelectItem>
                    <SelectItem value="TZS">TZS — Tanzanian Shilling</SelectItem>
                    <SelectItem value="MZN">MZN — Mozambican Metical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="payment_instructions">Payment Instructions</Label>
                <Textarea
                  id="payment_instructions"
                  value={settings.payment_instructions || ''}
                  onChange={(e) => update('payment_instructions', e.target.value)}
                  disabled={!canEdit}
                  rows={4}
                  placeholder="Bank transfer instructions for customers..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">System Preferences</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(v) => update('timezone', v)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                    <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                    <SelectItem value="Africa/Nairobi">Africa/Nairobi (EAT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select
                  value={settings.date_format}
                  onValueChange={(v) => update('date_format', v)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reservation_days">Default Reservation Duration (days)</Label>
                <Input
                  id="reservation_days"
                  type="number"
                  value={settings.reservation_default_days}
                  onChange={(e) => update('reservation_default_days', parseInt(e.target.value) || 7)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock_alert">Low Stock Alert (days)</Label>
                <Input
                  id="stock_alert"
                  type="number"
                  value={settings.low_stock_alert_days}
                  onChange={(e) => update('low_stock_alert_days', parseInt(e.target.value) || 60)}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
