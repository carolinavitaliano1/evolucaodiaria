import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PatientScheduleSlot {
  id: string;
  patientId: string;
  clinicId: string;
  organizationId: string | null;
  memberId: string;
  weekday: string;
  startTime: string;
  endTime: string;
  packageLinkId: string | null;
  notes: string | null;
  // joined
  therapistName?: string | null;
  therapistEmail?: string | null;
  packageName?: string | null;
  packagePrice?: number | null;
  packageType?: string | null;
  remunerationPlanId?: string | null;
  remunerationPlanName?: string | null;
  remunerationPlanType?: string | null;
  remunerationPlanValue?: number | null;
}

export function usePatientScheduleSlots(patientId: string | undefined) {
  const { user } = useAuth();
  const [slots, setSlots] = useState<PatientScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientId) { setSlots([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_schedule_slots' as any)
        .select('*')
        .eq('patient_id', patientId)
        .order('weekday')
        .order('start_time');
      if (error) throw error;

      const rows = (data || []) as any[];
      const memberIds = Array.from(new Set(rows.map(r => r.member_id).filter(Boolean)));
      const pkgLinkIds = Array.from(new Set(rows.map(r => r.package_link_id).filter(Boolean)));
      const remPlanIds = Array.from(new Set(rows.map(r => r.remuneration_plan_id).filter(Boolean)));

      const [memberRes, pkgLinkRes, allPkgLinksRes] = await Promise.all([
        memberIds.length
          ? supabase.from('organization_members').select('id, email, user_id').in('id', memberIds)
          : Promise.resolve({ data: [] as any[] }),
        pkgLinkIds.length
          ? supabase.from('patient_packages' as any).select('id, package_id').in('id', pkgLinkIds)
          : Promise.resolve({ data: [] as any[] }),
        // Fallback: buscar todos os pacotes do paciente para mapear por member_id quando package_link_id estiver nulo
        supabase.from('patient_packages' as any).select('id, package_id, member_id').eq('patient_id', patientId),
      ]);

      // Carregar planos de remuneração específicos dos slots + planos default dos membros
      const [remPlanRes, defaultPlansRes] = await Promise.all([
        remPlanIds.length
          ? supabase.from('member_remuneration_plans' as any).select('id, member_id, name, remuneration_type, remuneration_value').in('id', remPlanIds)
          : Promise.resolve({ data: [] as any[] }),
        memberIds.length
          ? supabase.from('member_remuneration_plans' as any).select('id, member_id, name, remuneration_type, remuneration_value, is_default').in('member_id', memberIds).eq('is_default', true)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const userIds = ((memberRes.data || []) as any[]).map(m => m.user_id).filter(Boolean);
      const profileRes = userIds.length
        ? await supabase.from('profiles').select('user_id, name').in('user_id', userIds)
        : { data: [] as any[] };

      const allPkgLinks = (allPkgLinksRes.data || []) as any[];
      const pkgIds = Array.from(new Set([
        ...((pkgLinkRes.data || []) as any[]).map(p => p.package_id),
        ...allPkgLinks.map(p => p.package_id),
      ].filter(Boolean)));
      const pkgRes = pkgIds.length
        ? await supabase.from('clinic_packages').select('id, name, price, package_type').in('id', pkgIds)
        : { data: [] as any[] };

      const memberMap = new Map<string, any>();
      (memberRes.data || []).forEach((m: any) => memberMap.set(m.id, m));
      const profileMap = new Map<string, any>();
      (profileRes.data || []).forEach((p: any) => profileMap.set(p.user_id, p));
      const pkgLinkMap = new Map<string, any>();
      (pkgLinkRes.data || []).forEach((p: any) => pkgLinkMap.set(p.id, p));
      const pkgMap = new Map<string, any>();
      (pkgRes.data || []).forEach((p: any) => pkgMap.set(p.id, p));
      const remPlanMap = new Map<string, any>();
      ((remPlanRes.data || []) as any[]).forEach((p: any) => remPlanMap.set(p.id, p));
      const defaultPlanByMember = new Map<string, any>();
      ((defaultPlansRes.data || []) as any[]).forEach((p: any) => defaultPlanByMember.set(p.member_id, p));
      // Mapa member_id -> pacote (usado como fallback quando o slot não tem package_link_id)
      const pkgByMemberMap = new Map<string, any>();
      allPkgLinks.forEach((link: any) => {
        if (link.member_id && link.package_id) {
          const pkg = pkgMap.get(link.package_id);
          if (pkg && !pkgByMemberMap.has(link.member_id)) {
            pkgByMemberMap.set(link.member_id, pkg);
          }
        }
      });

      const mapped: PatientScheduleSlot[] = rows.map(r => {
        const member = memberMap.get(r.member_id);
        const profile = member?.user_id ? profileMap.get(member.user_id) : null;
        const pkgLink = r.package_link_id ? pkgLinkMap.get(r.package_link_id) : null;
        const pkg = pkgLink ? pkgMap.get(pkgLink.package_id) : pkgByMemberMap.get(r.member_id) || null;
        const remPlan = r.remuneration_plan_id
          ? remPlanMap.get(r.remuneration_plan_id)
          : defaultPlanByMember.get(r.member_id) || null;
        return {
          id: r.id,
          patientId: r.patient_id,
          clinicId: r.clinic_id,
          organizationId: r.organization_id,
          memberId: r.member_id,
          weekday: r.weekday,
          startTime: (r.start_time || '').slice(0, 5),
          endTime: (r.end_time || '').slice(0, 5),
          packageLinkId: r.package_link_id,
          notes: r.notes,
          therapistName: profile?.name || null,
          therapistEmail: member?.email || null,
          packageName: pkg?.name || null,
          packagePrice: pkg?.price != null ? Number(pkg.price) : null,
          packageType: pkg?.package_type || null,
          remunerationPlanId: r.remuneration_plan_id || null,
          remunerationPlanName: remPlan?.name || null,
          remunerationPlanType: remPlan?.remuneration_type || null,
          remunerationPlanValue: remPlan?.remuneration_value != null ? Number(remPlan.remuneration_value) : null,
        };
      });

      setSlots(mapped);
    } catch (e) {
      console.error('usePatientScheduleSlots load error', e);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const addSlot = async (input: {
    clinicId: string;
    organizationId?: string | null;
    memberId: string;
    weekday: string;
    startTime: string;
    endTime: string;
    packageLinkId?: string | null;
    notes?: string | null;
  }) => {
    if (!user || !patientId) return;
    const { error } = await supabase.from('patient_schedule_slots' as any).insert({
      patient_id: patientId,
      clinic_id: input.clinicId,
      organization_id: input.organizationId || null,
      member_id: input.memberId,
      weekday: input.weekday,
      start_time: input.startTime,
      end_time: input.endTime,
      package_link_id: input.packageLinkId || null,
      notes: input.notes || null,
      created_by: user.id,
    });
    if (error) throw error;
    await load();
  };

  const removeSlot = async (slotId: string) => {
    const { error } = await supabase.from('patient_schedule_slots' as any).delete().eq('id', slotId);
    if (error) throw error;
    await load();
  };

  return { slots, loading, addSlot, removeSlot, refresh: load };
}