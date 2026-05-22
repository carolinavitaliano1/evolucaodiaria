import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!DAILY_API_KEY) throw new Error('DAILY_API_KEY not configured');
    if (!ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not configured');

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Missing Authorization');

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: claimsRes, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) throw new Error('Invalid session');
    const userId = claimsRes.claims.sub as string;

    const { recording_id, language } = await req.json().catch(() => ({}));
    if (!recording_id) throw new Error('recording_id is required');

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load recording + session for permission check
    const { data: rec, error: recErr } = await admin
      .from('video_recordings')
      .select('id, daily_recording_id, status, video_session_id, video_sessions!inner(therapist_user_id, clinic_id)')
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

    // If a ready transcription exists, return it
    const { data: existing } = await admin
      .from('video_transcriptions')
      .select('id, status, text, language')
      .eq('recording_id', recording_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.status === 'ready' && existing.text) {
      return new Response(
        JSON.stringify({ transcription_id: existing.id, text: existing.text, language: existing.language, cached: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or reuse a "processing" row
    let transcriptionId = existing?.id as string | undefined;
    if (!transcriptionId) {
      const { data: ins, error: insErr } = await admin
        .from('video_transcriptions')
        .insert({ recording_id, status: 'processing', language: language || 'pt', provider: 'elevenlabs' })
        .select('id')
        .single();
      if (insErr) throw insErr;
      transcriptionId = ins.id;
    } else {
      await admin
        .from('video_transcriptions')
        .update({ status: 'processing', error_message: null, updated_at: new Date().toISOString() })
        .eq('id', transcriptionId);
    }

    try {
      // 1) Get Daily access link
      const linkRes = await fetch(
        `https://api.daily.co/v1/recordings/${rec.daily_recording_id}/access-link`,
        { headers: { Authorization: `Bearer ${DAILY_API_KEY}` } }
      );
      if (!linkRes.ok) {
        const t = await linkRes.text();
        throw new Error(`Daily access-link error [${linkRes.status}]: ${t}`);
      }
      const { download_link } = await linkRes.json();
      if (!download_link) throw new Error('Daily did not return download link');

      // 2) Download the media file
      const mediaRes = await fetch(download_link);
      if (!mediaRes.ok) throw new Error(`Failed to download recording: ${mediaRes.status}`);
      const mediaBlob = await mediaRes.blob();

      // 3) Send to ElevenLabs Scribe
      const langMap: Record<string, string> = { pt: 'por', en: 'eng', es: 'spa' };
      const langCode = langMap[(language || 'pt') as string] || 'por';

      const fd = new FormData();
      fd.append('file', mediaBlob, 'recording.mp4');
      fd.append('model_id', 'scribe_v2');
      fd.append('tag_audio_events', 'true');
      fd.append('diarize', 'true');
      fd.append('language_code', langCode);

      const sttRes = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
        body: fd,
      });
      if (!sttRes.ok) {
        const err = await sttRes.text();
        throw new Error(`ElevenLabs STT error [${sttRes.status}]: ${err}`);
      }
      const sttJson = await sttRes.json();
      const text: string = sttJson.text || '';
      const speakersJson = sttJson.words ? { words: sttJson.words, audio_events: sttJson.audio_events ?? null } : null;

      await admin
        .from('video_transcriptions')
        .update({
          status: 'ready',
          text,
          speakers_json: speakersJson,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transcriptionId);

      return new Response(
        JSON.stringify({ transcription_id: transcriptionId, text, language: language || 'pt', cached: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (innerErr) {
      const msg = innerErr instanceof Error ? innerErr.message : 'Unknown transcription error';
      await admin
        .from('video_transcriptions')
        .update({ status: 'error', error_message: msg, updated_at: new Date().toISOString() })
        .eq('id', transcriptionId);
      throw innerErr;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('transcribe-recording error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});