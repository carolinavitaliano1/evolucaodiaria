import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type RemunerationType = 'por_sessao' | 'fixo_mensal' | 'fixo_dia' | 'definir_depois';

export interface OrgMemberProfile {
  memberId: string;
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: 'owner' | 'admin' | 'professional';
  remunerationType: RemunerationType;
  remunerationValue: number | null;
}

export function useClinicOrg(clinicId: string) {
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
      let profilesMap: Record<string, { name: string | null; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name, avatar_url')
          .in('user_id', userIds);
        profiles?.forEach(p => { profilesMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url }; });
      }

      setMembers(membersData
        .filter(m => m.user_id)
        .map(m => ({
          memberId: m.id,
          userId: m.user_id!,
          email: m.email,
          name: profilesMap[m.user_id!]?.name ?? null,
          avatarUrl: profilesMap[m.user_id!]?.avatar_url ?? null,
          role: m.role as OrgMemberProfile['role'],
          remunerationType: ((m as any).remuneration_type as RemunerationType) || 'definir_depois',
          remunerationValue: (m as any).remuneration_value ?? null,
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

/**
 * Calculate a member's remuneration for a given set of evolutions in a month.
 * - por_sessao: presences × value
 * - fixo_mensal: flat monthly value (regardless of sessions)
 * - fixo_dia: distinct work days × value
 * - definir_depois: 0
 */
export function calcMemberRemuneration(
  member: Pick<OrgMemberProfile, 'remunerationType' | 'remunerationValue'>,
  memberEvos: Array<{ date: string; attendanceStatus: string }>
): { amount: number; label: string; isUndefined: boolean } {
  const type = member.remunerationType || 'definir_depois';
  const value = member.remunerationValue ?? 0;

  if (type === 'definir_depois') {
    return { amount: 0, label: 'Remuneração não definida', isUndefined: true };
  }

  if (type === 'fixo_mensal') {
    return { amount: value, label: 'Fixo Mensal', isUndefined: false };
  }

  const attendedEvos = memberEvos.filter(
    e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao'
  );

  if (type === 'fixo_dia') {
    const distinctDays = new Set(attendedEvos.map(e => e.date)).size;
    return { amount: distinctDays * value, label: 'Fixo por Dia', isUndefined: false };
  }

  // por_sessao
  return { amount: attendedEvos.length * value, label: 'Por Sessão', isUndefined: false };
}
