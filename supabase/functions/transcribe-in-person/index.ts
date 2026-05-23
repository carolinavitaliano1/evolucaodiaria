import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
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

    const { data: rec, error: recErr } = await admin
      .from('in_person_recordings')
      .select('id, storage_path, therapist_user_id, clinic_id, transcription_status, transcription_text')
      .eq('id', recording_id)
      .maybeSingle();
    if (recErr) throw recErr;
    if (!rec) throw new Error('Recording not found');

    // Permission: owner therapist OR clinic org owner
    let allowed = rec.therapist_user_id === userId;
    if (!allowed && rec.clinic_id) {
      const { data: ok } = await admin.rpc('is_clinic_org_owner', {
        _clinic_id: rec.clinic_id,
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

    if (rec.transcription_status === 'ready' && rec.transcription_text) {
      return new Response(
        JSON.stringify({ text: rec.transcription_text, cached: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await admin
      .from('in_person_recordings')
      .update({ transcription_status: 'processing', transcription_error: null })
      .eq('id', recording_id);

    try {
      // Download audio from storage
      const { data: blob, error: dlErr } = await admin.storage
        .from('session-recordings')
        .download(rec.storage_path);
      if (dlErr || !blob) throw new Error(`Storage download failed: ${dlErr?.message || 'no blob'}`);

      const langMap: Record<string, string> = { pt: 'por', en: 'eng', es: 'spa' };
      const langCode = langMap[(language || 'pt') as string] || 'por';

      const fd = new FormData();
      fd.append('file', blob, 'recording');
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
      const speakers = sttJson.words
        ? { words: sttJson.words, audio_events: sttJson.audio_events ?? null }
        : null;

      await admin
        .from('in_person_recordings')
        .update({
          transcription_status: 'ready',
          transcription_text: text,
          transcription_speakers: speakers,
        })
        .eq('id', recording_id);

      return new Response(JSON.stringify({ text, cached: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (inner) {
      const msg = inner instanceof Error ? inner.message : 'transcription failed';
      await admin
        .from('in_person_recordings')
        .update({ transcription_status: 'error', transcription_error: msg })
        .eq('id', recording_id);
      throw inner;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('transcribe-in-person error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});