'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import type { Office, Shift } from '@/lib/types';
import { ROLE_COLORS, type RoleName } from '@/lib/types';
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS } from '@/lib/utils/currencies';
import { Camera, Loader2, MapPin, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function ProfilePage() {
  const { profile, roles, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [preferredCurrency, setPreferredCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [office, setOffice] = useState<Office | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || '');
    setDisplayName(profile.display_name || '');
    setPhone(profile.phone || '');
    setJobTitle(profile.job_title || '');
    setDepartment(profile.department || '');
    setPreferredCurrency(profile.preferred_currency || 'USD');
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      if (profile.office_id) {
        const { data } = await supabase.from('offices').select('*').eq('id', profile.office_id).maybeSingle();
        setOffice((data as Office) || null);
      } else {
        setOffice(null);
      }
      if (profile.shift_id) {
        const { data } = await supabase.from('shifts').select('*').eq('id', profile.shift_id).maybeSingle();
        setShift((data as Shift) || null);
      } else {
        setShift(null);
      }
    })();
  }, [profile]);

  const initials = (profile?.full_name || profile?.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        display_name: displayName.trim() || null,
        phone: phone.trim() || null,
        job_title: jobTitle.trim() || null,
        department: department.trim() || null,
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
    await refreshProfile();
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
      if (upErr.message.toLowerCase().includes('bucket') || upErr.message.toLowerCase().includes('not found')) {
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = String(reader.result);
          await supabase.from('profiles').update({ avatar_url: dataUrl, updated_at: new Date().toISOString() }).eq('id', profile.id);
          toast.success('Photo saved. Create a public Storage bucket named avatars for CDN URLs.');
          await refreshProfile();
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
    await refreshProfile();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description="Your photo, contact details, office, and shift"
        actions={
          <Button size="sm" onClick={saveProfile} disabled={saving || !profile}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save profile
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
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
              <div className="text-sm min-w-0">
                <p className="font-medium text-foreground truncate">{profile?.email}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {roles.map((role) => (
                    <span
                      key={role.id}
                      className={cn(
                        'inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border',
                        ROLE_COLORS[role.name as RoleName]
                      )}
                    >
                      {role.display_name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Display name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Job title</Label>
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Preferred currency</Label>
                <Select value={preferredCurrency} onValueChange={setPreferredCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c} — {CURRENCY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Office &amp; shift
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Office</p>
              <p className="font-medium">{office ? `${office.name} (${office.code})` : 'Not assigned'}</p>
              {office && (
                <p className="text-xs text-muted-foreground">{[office.city, office.country].filter(Boolean).join(', ')}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Shift</p>
              <p className="font-medium">{shift ? `${shift.name} (${shift.code})` : 'Not assigned'}</p>
              {shift && (
                <p className="text-xs text-muted-foreground">
                  {(shift.start_time || '').slice(0, 5) || '—'}–{(shift.end_time || '').slice(0, 5) || '—'}
                </p>
              )}
            </div>
            <Badge variant={profile?.is_active ? 'default' : 'secondary'}>
              {profile?.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <p className="text-xs text-muted-foreground">
              Office and shift are assigned by an admin on the{' '}
              <Link href="/users" className="text-primary underline-offset-2 hover:underline">
                Users
              </Link>{' '}
              page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
