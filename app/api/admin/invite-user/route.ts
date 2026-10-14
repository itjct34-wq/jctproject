import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 8;

const bodySchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(72),
  full_name: z.string().trim().max(200).optional().default(''),
  phone: z.string().trim().max(50).optional().nullable(),
  job_title: z.string().trim().max(120).optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
  office_id: z.string().uuid().optional().nullable(),
  shift_id: z.string().uuid().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: 'Valid email and a password of at least 8 characters are required' },
      { status: 400 }
    );
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

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.full_name },
  });

  if (createError || !created?.user) {
    return NextResponse.json(
      { error: createError?.message || 'Failed to create user' },
      { status: 400 }
    );
  }

  const profileRow = {
    id: created.user.id,
    email: parsed.email,
    full_name: parsed.full_name || null,
    phone: parsed.phone || null,
    job_title: parsed.job_title || null,
    department: parsed.department || null,
    office_id: parsed.office_id || null,
    shift_id: parsed.shift_id || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  let profileError: { message: string } | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await admin.from('profiles').upsert(profileRow, { onConflict: 'id' });
    if (!error) {
      profileError = null;
      break;
    }
    profileError = error;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  if (profileError) {
    return NextResponse.json({
      user_id: created.user.id,
      warning: 'User created but office/shift could not be saved: ' + profileError.message,
    });
  }

  return NextResponse.json({
    user_id: created.user.id,
  });
}
