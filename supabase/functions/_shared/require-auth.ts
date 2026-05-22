import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Validate the caller's JWT. Returns the user id on success, or a Response (401) to return immediately.
 * Usage:
 *   const auth = await requireAuth(req, corsHeaders);
 *   if (auth instanceof Response) return auth;
 *   const userId = auth.userId;
 */
export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string; email?: string } | Response> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data, error } = await anonClient.auth.getClaims(token);
  const sub = (data as any)?.claims?.sub;
  if (error || !sub) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId: sub as string, email: (data as any)?.claims?.email };
}