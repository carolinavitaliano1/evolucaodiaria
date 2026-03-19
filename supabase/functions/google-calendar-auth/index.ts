import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const action = url.searchParams.get('action');

    // Return OAuth URL for frontend redirect
    if (action === 'get_auth_url') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-auth?action=callback`;
      const scope = 'https://www.googleapis.com/auth/calendar.readonly';
      const state = user.id;

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${encodeURIComponent(state)}`;

      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // OAuth callback: exchange code for tokens
    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state'); // user_id
      const error = url.searchParams.get('error');

      const appUrl = 'https://clinipro.lovable.app';

      if (error || !code || !state) {
        return Response.redirect(`${appUrl}/calendar?google_error=${error || 'missing_code'}`, 302);
      }

      const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-auth?action=callback`;

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        console.error('Token exchange failed:', tokenData);
        return Response.redirect(`${appUrl}/calendar?google_error=token_exchange_failed`, 302);
      }

      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await serviceClient.from('google_calendar_tokens').upsert({
        user_id: state,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        expires_at: expiresAt,
        scope: tokenData.scope || null,
      }, { onConflict: 'user_id' });

      return Response.redirect(`${appUrl}/calendar?google_connected=true`, 302);
    }

    // Disconnect: remove tokens
    if (action === 'disconnect') {
      await supabase.from('google_calendar_tokens').delete().eq('user_id', user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check connection status
    if (action === 'status') {
      const { data } = await supabase
        .from('google_calendar_tokens')
        .select('expires_at, scope')
        .eq('user_id', user.id)
        .maybeSingle();

      return new Response(JSON.stringify({ connected: !!data, expires_at: data?.expires_at }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('google-calendar-auth error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
