import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { RemunerationPlan } from '@/utils/financialHelpers';

export interface OrgMemberProfile {
  memberId: string;
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: 'owner' | 'admin' | 'professional';
  remunerationType: string | null;
  remunerationValue: number | null;
  plans: RemunerationPlan[];
  /** Mapa patient_id → remuneration_plan_id escolhido no vínculo. */
  assignmentPlanMap: Record<string, string | null>;
}

export function useClinicOrg(clinicId: string | undefined) {
  const { user } = useAuth();
  const [members, setMembers] = useState<OrgMemberProfile[]>([]);
  const [isOrg, setIsOrg] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId || !user) { setLoading(false); return; }
    load();
  }, [clinicId, user]);

  async function load() {
    setLoading(true);
    try {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('organization_id')
        .eq('id', clinicId)
        .single();

      if (!clinic?.organization_id) {
        setIsOrg(false);
        setMembers([]);
        setLoading(false);
        return;
      }

      setIsOrg(true);

      const { data: membersData } = await supabase
        .from('organization_members')
        .select('id, user_id, email, role, remuneration_type, remuneration_value')
        .eq('organization_id', clinic.organization_id)
        .eq('status', 'active');

      if (!membersData || membersData.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const userIds = membersData.filter(m => m.user_id).map(m => m.user_id!);
      const memberIds = membersData.map(m => m.id);
      let profilesMap: Record<string, { name: string | null; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name, avatar_url')
          .in('user_id', userIds);
        profiles?.forEach(p => { profilesMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url }; });
      }

      // Carrega planos de remuneração + assignments (com plano escolhido por paciente)
      const [plansRes, assignmentsRes] = await Promise.all([
        supabase
          .from('member_remuneration_plans' as any)
          .select('id, member_id, name, remuneration_type, remuneration_value, is_default')
          .in('member_id', memberIds),
        supabase
          .from('therapist_patient_assignments')
          .select('member_id, patient_id, remuneration_plan_id')
          .in('member_id', memberIds),
      ]);

      const plansByMember: Record<string, RemunerationPlan[]> = {};
      ((plansRes.data ?? []) as any[]).forEach((p: any) => {
        if (!plansByMember[p.member_id]) plansByMember[p.member_id] = [];
        plansByMember[p.member_id].push({
          id: p.id,
          member_id: p.member_id,
          name: p.name,
          remuneration_type: p.remuneration_type,
          remuneration_value: Number(p.remuneration_value) || 0,
          is_default: !!p.is_default,
        });
      });

      const assignmentMapByMember: Record<string, Record<string, string | null>> = {};
      ((assignmentsRes.data ?? []) as any[]).forEach((a: any) => {
        if (!assignmentMapByMember[a.member_id]) assignmentMapByMember[a.member_id] = {};
        assignmentMapByMember[a.member_id][a.patient_id] = a.remuneration_plan_id ?? null;
      });

      setMembers(membersData
        .filter(m => m.user_id)
        .map(m => ({
          memberId: m.id,
          userId: m.user_id!,
          email: m.email,
          name: profilesMap[m.user_id!]?.name ?? null,
          avatarUrl: profilesMap[m.user_id!]?.avatar_url ?? null,
          role: m.role as OrgMemberProfile['role'],
          remunerationType: m.remuneration_type ?? null,
          remunerationValue: m.remuneration_value ? Number(m.remuneration_value) : null,
          plans: plansByMember[m.id] || [],
          assignmentPlanMap: assignmentMapByMember[m.id] || {},
        }))
      );
    } catch (e) {
      console.error('useClinicOrg error', e);
    } finally {
      setLoading(false);
    }
  }

  return { isOrg, members, loading };
}
