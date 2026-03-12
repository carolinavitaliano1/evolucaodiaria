import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { clinic_id, name, birthdate, responsible_name, whatsapp, email, reason } = await req.json();

    if (!clinic_id || !name || !birthdate) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: clinic_id, name, birthdate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get clinic owner user_id
    const { data: clinic, error: clinicErr } = await supabaseAdmin
      .from("clinics")
      .select("user_id")
      .eq("id", clinic_id)
      .single();

    if (clinicErr || !clinic) {
      return new Response(
        JSON.stringify({ error: "Clínica não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert patient with status 'pendente'
    const { data: patient, error: insertErr } = await supabaseAdmin
      .from("patients")
      .insert({
        clinic_id,
        user_id: clinic.user_id,
        name: name.trim(),
        birthdate,
        responsible_name: responsible_name?.trim() || null,
        responsible_whatsapp: whatsapp?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        email: email?.trim() || null,
        observations: reason?.trim() || null,
        status: "pendente",
      })
      .select("id")
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, patient_id: patient.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
