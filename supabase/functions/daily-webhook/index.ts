import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Daily.co webhook receiver.
 * Public endpoint (verify_jwt=false). Handle:
 *  - recording.ready-to-download → mark recording ready
 *  - recording.started / recording.error → status updates
 *  - meeting.ended → close session
 * Daily payload shape: { type, payload: { room_name, recording_id, duration, ... } }
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const rawBody = await req.text();

    // Verify Daily.co HMAC signature when DAILY_WEBHOOK_SECRET is configured
    const webhookSecret = Deno.env.get('DAILY_WEBHOOK_SECRET');
    if (webhookSecret) {
      const sigHeader = req.headers.get('x-daily-signature')
        || req.headers.get('x-webhook-signature')
        || req.headers.get('x-daily-hmac')
        || '';
      const timestamp = req.headers.get('x-webhook-timestamp') || '';
      const signedPayload = timestamp ? `${timestamp}.${rawBody}` : rawBody;

      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw', enc.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
      const expectedHex = Array.from(new Uint8Array(sigBuf))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

      // Constant-time compare against possible encodings
      const provided = sigHeader.replace(/^sha256=/, '').trim();
      const ok = provided.length > 0 && (
        timingSafeEqual(provided, expectedHex) ||
        timingSafeEqual(provided, expectedB64)
      );
      if (!ok) {
        console.warn('daily-webhook: invalid signature');
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }
    } else {
      console.warn('daily-webhook: DAILY_WEBHOOK_SECRET not set — accepting unverified payload');
    }

    let body: any = {};
    try { body = JSON.parse(rawBody); } catch { body = {}; }
    const eventType: string = body?.type || body?.event || '';
    const data = body?.payload || body?.data || body || {};
    const roomName: string | undefined = data.room_name || data.room || data.roomName;

    console.log('daily-webhook event:', eventType, 'room:', roomName);

    if (!roomName) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no_room' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: session, error: sessErr } = await admin
      .from('video_sessions')
      .select('id')
      .eq('daily_room_name', roomName)
      .maybeSingle();
    if (sessErr) throw sessErr;
    if (!session) {
      console.warn('No session for room', roomName);
      return new Response(JSON.stringify({ ok: true, skipped: 'no_session' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recordingId: string | undefined = data.recording_id || data.id || data.recordingId;

    if (eventType.startsWith('recording.')) {
      const status =
        eventType === 'recording.ready-to-download'
          ? 'ready'
          : eventType === 'recording.started'
          ? 'recording'
          : eventType === 'recording.error'
          ? 'error'
          : 'pending';

      const payload: Record<string, any> = {
        video_session_id: session.id,
        status,
      };
      if (recordingId) payload.daily_recording_id = recordingId;
      if (typeof data.duration === 'number') payload.duration_seconds = Math.round(data.duration);
      if (typeof data.s3_size === 'number') payload.file_size_bytes = data.s3_size;
      if (typeof data.size === 'number') payload.file_size_bytes = data.size;
      if (data.error) payload.error_message = String(data.error);

      // Upsert by daily_recording_id when available, otherwise insert.
      if (recordingId) {
        const { error: upErr } = await admin
          .from('video_recordings')
          .upsert(payload, { onConflict: 'daily_recording_id' });
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await admin.from('video_recordings').insert(payload);
        if (insErr) throw insErr;
      }
    } else if (eventType === 'meeting.ended') {
      await admin
        .from('video_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', session.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('daily-webhook error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}