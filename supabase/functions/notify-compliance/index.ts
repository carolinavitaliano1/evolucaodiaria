import { createClient } from 'npm:@supabase/supabase-js@2';
import { format, subDays } from 'npm:date-fns@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

    // 1. Get all active organizations
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, owner_id');

    if (!orgs?.length) {
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalNotified = 0;

    for (const org of orgs) {
      // 2. Get active members for this org
      const { data: members } = await supabaseAdmin
        .from('organization_members')
        .select('id, user_id, email')
        .eq('organization_id', org.id)
        .eq('status', 'active');

      if (!members?.length) continue;

      const memberIds = members.map((m) => m.id);

      // 3. Get therapist_patient_assignments
      const { data: assignments } = await supabaseAdmin
        .from('therapist_patient_assignments')
        .select('member_id, patient_id')
        .eq('organization_id', org.id)
        .in('member_id', memberIds);

      if (!assignments?.length) continue;

      // 4. Get org clinics
      const { data: clinics } = await supabaseAdmin
        .from('clinics')
        .select('id')
        .eq('organization_id', org.id);

      const clinicIds = (clinics || []).map((c) => c.id);
      if (!clinicIds.length) continue;

      // 5. Get appointments in last 7 days
      const { data: apts } = await supabaseAdmin
        .from('appointments')
        .select('id, patient_id, user_id, date')
        .in('clinic_id', clinicIds)
        .gte('date', sevenDaysAgo)
        .lte('date', today);

      if (!apts?.length) continue;

      // 6. Get evolutions in same period
      const { data: evolutions } = await supabaseAdmin
        .from('evolutions')
        .select('patient_id, user_id, date')
        .in('clinic_id', clinicIds)
        .gte('date', sevenDaysAgo)
        .lte('date', today);

      const evolutionSet = new Set(
        (evolutions || []).map((e) => `${e.patient_id}::${e.user_id}::${e.date}`)
      );

      // 7. Cross-reference to find pending
      const pendingByTherapist: Record<
        string,
        { userId: string; patientIds: string[]; dates: string[] }
      > = {};

      for (const apt of apts) {
        const assignment = assignments.find(
          (a) =>
            a.patient_id === apt.patient_id &&
            members.find((m) => m.id === a.member_id)?.user_id === apt.user_id
        );
        if (!assignment) continue;

        const key = `${apt.patient_id}::${apt.user_id}::${apt.date}`;
        if (evolutionSet.has(key)) continue;

        if (!pendingByTherapist[apt.user_id]) {
          pendingByTherapist[apt.user_id] = {
            userId: apt.user_id,
            patientIds: [],
            dates: [],
          };
        }
        const dupKey = `${apt.patient_id}::${apt.date}`;
        if (!pendingByTherapist[apt.user_id].patientIds.includes(dupKey)) {
          pendingByTherapist[apt.user_id].patientIds.push(dupKey);
          pendingByTherapist[apt.user_id].dates.push(apt.date);
        }
      }

      // 8. Get patient names
      const allPatientIds = assignments.map((a) => a.patient_id);
      const { data: patients } = await supabaseAdmin
        .from('patients')
        .select('id, name')
        .in('id', allPatientIds);
      const patientMap: Record<string, string> = {};
      (patients || []).forEach((p) => (patientMap[p.id] = p.name));

      // 9. Create internal notifications for each therapist
      for (const [therapistUserId, info] of Object.entries(pendingByTherapist)) {
        const count = info.patientIds.length;
        const title = `⚠️ ${count} evolução(ões) pendente(s)`;
        const message = `Você possui ${count} evolução(ões) não registrada(s) nos últimos 7 dias. Por favor, regularize assim que possível.`;

        // Avoid duplicate notifications on the same day
        const { data: existing } = await supabaseAdmin
          .from('internal_notifications')
          .select('id')
          .eq('recipient_user_id', therapistUserId)
          .eq('type', 'compliance_daily')
          .gte('created_at', `${today}T00:00:00Z`)
          .limit(1);

        if (existing?.length) continue; // already notified today

        await supabaseAdmin.from('internal_notifications').insert({
          recipient_user_id: therapistUserId,
          created_by_user_id: org.owner_id,
          type: 'compliance_daily',
          title,
          message,
          created_at: new Date().toISOString(),
        });

        totalNotified++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, notified: totalNotified }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('notify-compliance error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
