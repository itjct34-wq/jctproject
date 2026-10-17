import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/security/enforce-rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await enforceRateLimit(request, 'verify-invoice', 'verifyToken');
  if (gate.blocked) return gate.blocked;
  const token = (request.nextUrl.searchParams.get('token') || '').trim();
  if (!/^[a-f0-9]{16,64}$/i.test(token)) {
    return NextResponse.json(
      { valid: false, message: 'Invalid verification code' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const db = await createServerClient();
    const { data, error } = await db.rpc('verify_invoice', { p_token: token });
    if (error) {
      return NextResponse.json(
        { valid: false, message: 'Verification service unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const result = data && typeof data === 'object' ? data : { valid: false, message: 'Invoice not found or invalid' };
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json(
      { valid: false, message: 'Verification service unavailable' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
