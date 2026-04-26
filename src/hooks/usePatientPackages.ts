import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PatientPackageLink {
  id: string;
  patientId: string;
  packageId: string;
  memberId: string | null;
  therapistUserId: string | null;
  organizationId: string | null;
  notes: string | null;
  // joined info
  packageName?: string;
  packagePrice?: number;
  packageType?: string;
  packageSessionLimit?: number | null;
  therapistName?: string | null;
  therapistEmail?: string | null;
}

/**
 * Manages multiple package links attached to a patient (one per therapist/specialty).
 */
export function usePatientPackages(patientId: string | undefined) {
  const { user } = useAuth();
  const [links, setLinks] = useState<PatientPackageLink[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientId) { setLinks([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_packages' as any)
        .select('*')
        .eq('patient_id', patientId);
      if (error) throw error;

      const rows = (data || []) as any[];
      const pkgIds = Array.from(new Set(rows.map(r => r.package_id).filter(Boolean)));
      const memberIds = Array.from(new Set(rows.map(r => r.member_id).filter(Boolean)));

      const [pkgRes, memberRes] = await Promise.all([
        pkgIds.length
          ? supabase.from('clinic_packages').select('id, name, price, package_type, session_limit').in('id', pkgIds)
          : Promise.resolve({ data: [] as any[] }),
        memberIds.length
          ? supabase.from('organization_members').select('id, email, user_id').in('id', memberIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const userIds = ((memberRes.data || []) as any[]).map(m => m.user_id).filter(Boolean);
      const profileRes = userIds.length
        ? await supabase.from('profiles').select('user_id, name').in('user_id', userIds)
        : { data: [] as any[] };

      const pkgMap = new Map<string, any>();
      (pkgRes.data || []).forEach((p: any) => pkgMap.set(p.id, p));
      const memberMap = new Map<string, any>();
      (memberRes.data || []).forEach((m: any) => memberMap.set(m.id, m));
      const profileMap = new Map<string, any>();
      (profileRes.data || []).forEach((p: any) => profileMap.set(p.user_id, p));

      const mapped: PatientPackageLink[] = rows.map(r => {
        const pkg = pkgMap.get(r.package_id);
        const member = r.member_id ? memberMap.get(r.member_id) : null;
        const profile = member?.user_id ? profileMap.get(member.user_id) : null;
        return {
          id: r.id,
          patientId: r.patient_id,
          packageId: r.package_id,
          memberId: r.member_id,
          therapistUserId: r.therapist_user_id,
          organizationId: r.organization_id,
          notes: r.notes,
          packageName: pkg?.name,
          packagePrice: pkg?.price ? Number(pkg.price) : 0,
          packageType: pkg?.package_type,
          packageSessionLimit: pkg?.session_limit ?? null,
          therapistName: profile?.name || null,
          therapistEmail: member?.email || null,
        };
      });

      setLinks(mapped);
    } catch (e) {
      console.error('usePatientPackages load error', e);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const addLink = async (input: {
    packageId: string;
    memberId?: string | null;
    therapistUserId?: string | null;
    organizationId?: string | null;
    notes?: string | null;
  }) => {
    if (!user || !patientId) return;
    const { error } = await supabase.from('patient_packages' as any).insert({
      patient_id: patientId,
      package_id: input.packageId,
      member_id: input.memberId || null,
      therapist_user_id: input.therapistUserId || null,
      organization_id: input.organizationId || null,
      notes: input.notes || null,
      created_by: user.id,
    });
    if (error) throw error;
    await load();
  };

  const removeLink = async (linkId: string) => {
    const { error } = await supabase.from('patient_packages' as any).delete().eq('id', linkId);
    if (error) throw error;
    await load();
  };

  return { links, loading, addLink, removeLink, refresh: load };
}
