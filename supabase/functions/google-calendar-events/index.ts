import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const timeMin = url.searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = url.searchParams.get('timeMax') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: tokenRow } = await serviceClient
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!tokenRow) {
      return new Response(JSON.stringify({ connected: false, events: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accessToken = tokenRow.access_token;

    // Refresh if expired
    if (new Date(tokenRow.expires_at) <= new Date() && tokenRow.refresh_token) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      if (refreshed) {
        accessToken = refreshed.access_token;
        const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
        await serviceClient.from('google_calendar_tokens').update({
          access_token: accessToken,
          expires_at: newExpiresAt,
        }).eq('user_id', user.id);
      } else {
        await serviceClient.from('google_calendar_tokens').delete().eq('user_id', user.id);
        return new Response(JSON.stringify({ connected: false, events: [], need_reconnect: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const gcalUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}` +
      `&timeMax=${encodeURIComponent(timeMax)}` +
      `&singleEvents=true` +
      `&orderBy=startTime` +
      `&maxResults=250`;

    const gcalRes = await fetch(gcalUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!gcalRes.ok) {
      const errBody = await gcalRes.text();
      console.error('Google Calendar API error:', gcalRes.status, errBody);
      return new Response(JSON.stringify({ connected: true, events: [], error: 'google_api_error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gcalData = await gcalRes.json();
    const events = (gcalData.items || []).map((item: Record<string, unknown>) => {
      const start = item.start as Record<string, string> | undefined;
      const end = item.end as Record<string, string> | undefined;
      return {
        id: item.id,
        title: item.summary || '(Sem título)',
        description: item.description || '',
        date: start?.date || (start?.dateTime ? start.dateTime.substring(0, 10) : ''),
        time: start?.dateTime ? start.dateTime.substring(11, 16) : null,
        end_time: end?.dateTime ? end.dateTime.substring(11, 16) : null,
        all_day: !!start?.date,
        color: '#4285F4',
        source: 'google',
      };
    });

    return new Response(JSON.stringify({ connected: true, events }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('google-calendar-events error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
