import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().trim().email().max(254),
  full_name: z.string().trim().max(200).optional().default(''),
});

function generateTempPassword(): string {
  // 16 random chars + fixed suffix guarantees upper, lower, digit and symbol.
  return `${randomBytes(12).toString('base64url')}aA1!`;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 });
  }

  const admin = await createServerClient();

  // 1. Identify the caller from their access token.
  const { data: callerData, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !callerData?.user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  // 2. Only admins / super admins may create users.
  const { data: roleRows, error: roleError } = await admin
    .from('user_roles')
    .select('is_active, roles(name)')
    .eq('user_id', callerData.user.id)
    .eq('is_active', true);

  if (roleError) {
    return NextResponse.json({ error: 'Could not verify permissions' }, { status: 500 });
  }

  const isAdmin = (roleRows || []).some((row) => {
    const role = row.roles as unknown as { name: string } | { name: string }[] | null;
    const name = Array.isArray(role) ? role[0]?.name : role?.name;
    return name === 'admin' || name === 'super_admin';
  });

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Validate input.
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }

  // 4. Create the user with a one-time random password (never a shared default).
  const tempPassword = generateTempPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: parsed.full_name },
  });

  if (createError || !created?.user) {
    return NextResponse.json(
      { error: createError?.message || 'Failed to create user' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    user_id: created.user.id,
    temp_password: tempPassword,
  });
}
