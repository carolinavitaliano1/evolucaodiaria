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

      const [memberRes, pkgLinkRes] = await Promise.all([
        memberIds.length
          ? supabase.from('organization_members').select('id, email, user_id').in('id', memberIds)
          : Promise.resolve({ data: [] as any[] }),
        pkgLinkIds.length
          ? supabase.from('patient_packages' as any).select('id, package_id').in('id', pkgLinkIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const userIds = ((memberRes.data || []) as any[]).map(m => m.user_id).filter(Boolean);
      const profileRes = userIds.length
        ? await supabase.from('profiles').select('user_id, name').in('user_id', userIds)
        : { data: [] as any[] };

      const pkgIds = Array.from(new Set(((pkgLinkRes.data || []) as any[]).map(p => p.package_id).filter(Boolean)));
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

      const mapped: PatientScheduleSlot[] = rows.map(r => {
        const member = memberMap.get(r.member_id);
        const profile = member?.user_id ? profileMap.get(member.user_id) : null;
        const pkgLink = r.package_link_id ? pkgLinkMap.get(r.package_link_id) : null;
        const pkg = pkgLink ? pkgMap.get(pkgLink.package_id) : null;
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