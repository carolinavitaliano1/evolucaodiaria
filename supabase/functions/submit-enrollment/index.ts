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

    const body = await req.json();
    const {
      clinic_id,
      // Patient
      name, birthdate, cpf, phone, whatsapp, email, address,
      // Minor / guardian
      is_minor,
      guardian_name, guardian_email, guardian_phone, guardian_kinship,
      // Legal responsible (financial contract)
      responsible_name, responsible_cpf, responsible_whatsapp, responsible_email, responsible_relation,
      // Financial responsible
      financial_responsible,
      financial_responsible_name, financial_responsible_cpf, financial_responsible_whatsapp,
      // Misc
      observations,
    } = body;

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

    // Determine financial responsible fields
    // 'patient' → no financial fields needed (they pay themselves)
    // 'responsible' → copy legal responsible data
    // 'other' → use explicit financial_responsible_* fields
    let fin_name: string | null = null;
    let fin_cpf: string | null = null;
    let fin_whatsapp: string | null = null;
    const responsible_is_financial = financial_responsible === 'responsible';

    if (financial_responsible === 'other') {
      fin_name = financial_responsible_name?.trim() || null;
      fin_cpf = financial_responsible_cpf?.trim() || null;
      fin_whatsapp = financial_responsible_whatsapp?.trim() || null;
    }

    // Build observations combining address + diagnosis + observations
    const obs_parts: string[] = [];
    if (address?.trim()) obs_parts.push(`Endereço: ${address.trim()}`);
    if (body.diagnosis?.trim()) obs_parts.push(`Diagnóstico: ${body.diagnosis.trim()}`);
    if (observations?.trim()) obs_parts.push(observations.trim());

    // Insert patient with status 'pendente'
    const { data: patient, error: insertErr } = await supabaseAdmin
      .from("patients")
      .insert({
        clinic_id,
        user_id: clinic.user_id,
        name: name.trim(),
        birthdate,
        cpf: cpf?.trim() || null,
        phone: phone?.trim() || null,
        whatsapp: whatsapp?.trim() || null,
        email: email?.trim() || null,
        // Guardian (minor)
        is_minor: is_minor === true || is_minor === 'true',
        guardian_name: guardian_name?.trim() || null,
        guardian_email: guardian_email?.trim() || null,
        guardian_phone: guardian_phone?.trim() || null,
        guardian_kinship: guardian_kinship?.trim() || null,
        // Legal / contract responsible
        responsible_name: responsible_name?.trim() || null,
        responsible_cpf: responsible_cpf?.trim() || null,
        responsible_whatsapp: responsible_whatsapp?.trim() || null,
        responsible_email: responsible_email?.trim() || null,
        professionals: responsible_relation?.trim() || null,
        observations: obs_parts.join('\n') || null,
        diagnosis: body.diagnosis?.trim() || null,
        responsible_is_financial,
        financial_responsible_name: fin_name,
        financial_responsible_cpf: fin_cpf,
        financial_responsible_whatsapp: fin_whatsapp,
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
