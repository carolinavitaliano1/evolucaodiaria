import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!DAILY_API_KEY) throw new Error('DAILY_API_KEY not configured');

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Missing Authorization');

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: claimsRes, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) throw new Error('Invalid session');
    const userId = claimsRes.claims.sub as string;

    const { recording_id } = await req.json().catch(() => ({}));
    if (!recording_id) throw new Error('recording_id is required');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: rec, error: recErr } = await admin
      .from('video_recordings')
      .select('id, daily_recording_id, video_session_id, video_sessions!inner(therapist_user_id, clinic_id)')
      .eq('id', recording_id)
      .maybeSingle();
    if (recErr) throw recErr;
    if (!rec) throw new Error('Recording not found');
    if (!rec.daily_recording_id) throw new Error('Recording not yet ready');

    const session: any = (rec as any).video_sessions;
    let allowed = session.therapist_user_id === userId;
    if (!allowed && session.clinic_id) {
      const { data: ok } = await admin.rpc('is_clinic_org_owner', {
        _clinic_id: session.clinic_id,
        _user_id: userId,
      });
      allowed = !!ok;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(
      `https://api.daily.co/v1/recordings/${rec.daily_recording_id}/access-link`,
      { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Daily access-link error [${res.status}]: ${t}`);
    }
    const json = await res.json();

    return new Response(
      JSON.stringify({ download_url: json.download_link, expires: json.expires }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('get-recording-url error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});