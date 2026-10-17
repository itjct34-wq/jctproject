import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { enforceRateLimit } from '@/lib/security/enforce-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 8;

const bodySchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().max(200).optional().nullable(),
  display_name: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  job_title: z.string().trim().max(120).optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
  office_id: z.string().uuid().optional().nullable(),
  shift_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
  password: z.string().max(72).optional(),
});

export async function PATCH(request: NextRequest) {
  const gate = await enforceRateLimit(request, 'admin-update-user', 'adminApi');
  if (gate.blocked) return gate.blocked;
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid user payload' }, { status: 400 });
  }

  if (parsed.shift_id && parsed.office_id) {
    const { data: shift } = await admin
      .from('shifts')
      .select('id, office_id')
      .eq('id', parsed.shift_id)
      .maybeSingle();
    if (!shift || (shift.office_id && shift.office_id !== parsed.office_id)) {
      return NextResponse.json({ error: 'Shift does not belong to the selected office' }, { status: 400 });
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const keys = ['full_name', 'display_name', 'phone', 'job_title', 'department', 'office_id', 'shift_id', 'is_active'] as const;
  for (const key of keys) {
    if (parsed[key] !== undefined) updates[key] = parsed[key];
  }

  const { error } = await admin.from('profiles').update(updates).eq('id', parsed.user_id);

  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes('column') || error.message.includes('does not exist')
          ? 'Run supabase/migrations/20261010140000_013_user_office_shift_link.sql in the Supabase SQL Editor, then try again'
          : error.message,
      },
      { status: 400 }
    );
  }

  const nextPassword = parsed.password?.trim() || '';
  if (nextPassword) {
    if (nextPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`, password_updated: false },
        { status: 400 }
      );
    }
    const { error: authError } = await admin.auth.admin.updateUserById(parsed.user_id, {
      password: nextPassword,
    });
    if (authError) {
      return NextResponse.json(
        { error: 'Could not update sign-in password', password_updated: false },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, password_updated: true });
  }

  return NextResponse.json({ ok: true, password_updated: false });
}
