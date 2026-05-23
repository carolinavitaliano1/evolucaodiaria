import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function buildDiarizedTranscript(dgJson: any): string {
  try {
    const paragraphs =
      dgJson?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs;
    if (Array.isArray(paragraphs) && paragraphs.length > 0) {
      return paragraphs
        .map((p: any) => {
          const speaker = p.speaker !== undefined ? `Falante ${p.speaker + 1}` : 'Falante';
          const sentences = (p.sentences || []).map((s: any) => s.text).join(' ');
          return `**${speaker}:** ${sentences}`;
        })
        .join('\n\n');
    }
    const utterances = dgJson?.results?.utterances;
    if (Array.isArray(utterances) && utterances.length > 0) {
      return utterances
        .map((u: any) => `**Falante ${(u.speaker ?? 0) + 1}:** ${u.transcript}`)
        .join('\n\n');
    }
    return dgJson?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  } catch {
    return dgJson?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!DAILY_API_KEY) throw new Error('DAILY_API_KEY not configured');
    if (!DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY not configured');

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
        .insert({ recording_id, status: 'processing', language: language || 'pt', provider: 'deepgram' })
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

      // 3) Send to Deepgram
      const langMap: Record<string, string> = { pt: 'pt-BR', en: 'en-US', es: 'es' };
      const langCode = langMap[(language || 'pt') as string] || 'pt-BR';

      const params = new URLSearchParams({
        model: 'nova-2',
        language: langCode,
        smart_format: 'true',
        punctuate: 'true',
        paragraphs: 'true',
        diarize: 'true',
        utterances: 'true',
      });

      const audioBuffer = await mediaBlob.arrayBuffer();
      const contentType = mediaBlob.type || 'video/mp4';

      const sttRes = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': contentType,
        },
        body: audioBuffer,
      });
      if (!sttRes.ok) {
        const err = await sttRes.text();
        throw new Error(`Deepgram STT error [${sttRes.status}]: ${err}`);
      }
      const sttJson = await sttRes.json();
      const text: string = buildDiarizedTranscript(sttJson);
      const speakersJson = sttJson?.results?.utterances
        ? { utterances: sttJson.results.utterances }
        : null;

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