import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
const DAILY_DOMAIN = Deno.env.get('DAILY_DOMAIN'); // e.g. mycompany.daily.co
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const OWNER_EMAILS = new Set([
  'carolinavitaliano1@gmail.com',
]);

function randomSlug(len = 14) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

function randomToken(len = 40) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, len);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!DAILY_API_KEY) throw new Error('DAILY_API_KEY is not configured');
    if (!DAILY_DOMAIN) throw new Error('DAILY_DOMAIN is not configured');

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Missing Authorization');

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: claimsRes, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) throw new Error('Invalid session');
    const userId = claimsRes.claims.sub as string;
    const userEmail = (claimsRes.claims.email as string | undefined)?.toLowerCase() ?? '';

    const body = await req.json().catch(() => ({}));
    const { patient_id, appointment_id, clinic_id, recording_enabled, recording_layout, therapy_session_id } = body as {
      patient_id?: string;
      appointment_id?: string;
      clinic_id?: string;
      recording_enabled?: boolean;
      recording_layout?: 'audio' | 'video';
      therapy_session_id?: string;
    };
    if (!patient_id) throw new Error('patient_id is required');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Gating: owners always allowed
    const isOwner = OWNER_EMAILS.has(userEmail);

    if (!isOwner) {
      // Must be Pro tier and clinic type IN ('propria','terceirizada')
      // Reuse check-subscription tier via direct internal call
      const subResp = await fetch(`${SUPABASE_URL}/functions/v1/check-subscription`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const sub = await subResp.json().catch(() => ({}));
      const tier = sub?.tier as string | undefined;
      const allowedTiers = ['pro', 'legacy', 'trial', 'owner'];
      if (!tier || !allowedTiers.includes(tier)) {
        return new Response(
          JSON.stringify({ error: 'plan_not_eligible', message: 'Teleatendimento disponível apenas no plano Pro.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (clinic_id) {
        const { data: clinic } = await admin.from('clinics').select('type').eq('id', clinic_id).maybeSingle();
        if (clinic?.type === 'clinica') {
          return new Response(
            JSON.stringify({
              error: 'clinic_not_eligible',
              message: 'Teleatendimento não disponível para clínicas no plano Clínica Pro.',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Create Daily room
    const roomName = `ed-${randomSlug(12)}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 4; // 4h

    const buildRoomBody = (rec: 'cloud' | 'local' | null) => ({
      name: roomName,
      privacy: 'public',
      properties: {
        exp: expiresAt,
        enable_screenshare: true,
        enable_chat: true,
        start_video_off: false,
        start_audio_off: false,
        enable_recording: rec ?? undefined,
        eject_at_room_exp: true,
      },
    });

    const callDaily = (rec: 'cloud' | 'local' | null) =>
      fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildRoomBody(rec)),
      });

    let recordingMode: 'cloud' | 'local' | null = recording_enabled ? 'cloud' : null;
    let recordingFallback: 'plan_unsupported' | null = null;
    let dailyRes = await callDaily(recordingMode);

    // Fallback if the Daily plan does not allow the requested recording mode
    if (!dailyRes.ok && recordingMode) {
      const errText = await dailyRes.text();
      const planError = errText.includes('current plan') || errText.includes('enable_recording');
      if (planError) {
        console.warn('Daily plan does not support cloud recording, retrying without recording.');
        recordingFallback = 'plan_unsupported';
        recordingMode = null;
        dailyRes = await callDaily(null);
      } else {
        console.error('Daily room creation failed:', errText);
        throw new Error(`Daily API error [${dailyRes.status}]: ${errText}`);
      }
    }

    if (!dailyRes.ok) {
      const errText = await dailyRes.text();
      console.error('Daily room creation failed:', errText);
      throw new Error(`Daily API error [${dailyRes.status}]: ${errText}`);
    }

    const dailyData = await dailyRes.json();
    const roomUrl = dailyData.url as string;
    const effectiveRecording = recordingMode === 'cloud';

    // Persist
    const patientToken = randomToken(48);

    // Resolve scheduled_for from the appointment when available (Brasilia = UTC-3)
    let scheduledFor: string | null = null;
    if (appointment_id) {
      const { data: appt } = await admin
        .from('appointments')
        .select('date, time')
        .eq('id', appointment_id)
        .maybeSingle();
      if (appt?.date && appt?.time) {
        // appt.date is 'YYYY-MM-DD', appt.time is 'HH:MM[:SS]' in local (BRT)
        const t = String(appt.time).slice(0, 5);
        scheduledFor = new Date(`${appt.date}T${t}:00-03:00`).toISOString();
      }
    }

    const { data: session, error: insertErr } = await admin
      .from('video_sessions')
      .insert({
        appointment_id: appointment_id || null,
        patient_id,
        therapist_user_id: userId,
        clinic_id: clinic_id || null,
        daily_room_name: roomName,
        daily_room_url: roomUrl,
        patient_access_token: patientToken,
        status: 'scheduled',
        recording_enabled: effectiveRecording,
        recording_layout: recording_layout === 'video' ? 'video' : 'audio',
        therapy_session_id: therapy_session_id || null,
        room_expires_at: new Date(expiresAt * 1000).toISOString(),
        scheduled_for: scheduledFor,
      })
      .select('*')
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        session_id: session.id,
        room_url: roomUrl,
        patient_token: patientToken,
        recording_enabled: effectiveRecording,
        recording_fallback: recordingFallback,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('create-video-room error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});