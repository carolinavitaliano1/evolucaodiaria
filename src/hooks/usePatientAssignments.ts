import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';

export interface TherapistAssignment {
  memberId: string;
  userId: string | null;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  scheduleTime: string | null;
}

/**
 * Returns the assigned therapists for a given patient (for display in patient detail).
 * Also returns functions to add/remove assignments (admin/owner only).
 */
export function usePatientAssignments(patientId: string, clinicId: string) {
  const { user } = useAuth();
  const { isOwner, permissions, role } = useOrgPermissions();
  const [assignments, setAssignments] = useState<TherapistAssignment[]>([]);
  const [allMembers, setAllMembers] = useState<TherapistAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  const canManage = isOwner || role === 'admin';

  useEffect(() => {
    if (!patientId || !clinicId || !user) { setLoading(false); return; }
    load();
  }, [patientId, clinicId, user]);

  async function load() {
    setLoading(true);
    try {
      // Get org from clinic
      const { data: clinic } = await supabase
        .from('clinics').select('organization_id').eq('id', clinicId).single();

      if (!clinic?.organization_id) { setLoading(false); return; }
      setOrgId(clinic.organization_id);

      // Load all active members + scheduled slots for this patient in parallel.
      // The source of truth for "Terapeutas Responsáveis" is the patient's agenda
      // (patient_schedule_slots) — any therapist with at least one slot is responsible.
      const [membersRes, slotsRes] = await Promise.all([
        supabase.from('organization_members')
          .select('id, user_id, email, role')
          .eq('organization_id', clinic.organization_id)
          .eq('status', 'active'),
        supabase.from('patient_schedule_slots' as any)
          .select('member_id, weekday, start_time, end_time')
          .eq('patient_id', patientId),
      ]);

      if (!membersRes.data) { setLoading(false); return; }

      const userIds = membersRes.data.filter(m => m.user_id).map(m => m.user_id!);
      let profilesMap: Record<string, { name: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('user_id, name, avatar_url').in('user_id', userIds);
        profiles?.forEach(p => { profilesMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url }; });
      }

      // Group slots by member to build a friendly schedule label per therapist
      const slotsByMember: Record<string, Array<{ weekday: string; start: string; end: string }>> = {};
      ((slotsRes.data || []) as any[]).forEach(s => {
        const arr = slotsByMember[s.member_id] || (slotsByMember[s.member_id] = []);
        arr.push({
          weekday: s.weekday,
          start: (s.start_time || '').slice(0, 5),
          end: (s.end_time || '').slice(0, 5),
        });
      });
      const assignedMemberIds = new Set(Object.keys(slotsByMember));
      const WEEKDAY_ORDER = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
      const scheduleMap: Record<string, string | null> = {};
      Object.entries(slotsByMember).forEach(([mid, arr]) => {
        const sorted = [...arr].sort((a, b) => {
          const da = WEEKDAY_ORDER.indexOf(a.weekday);
          const db = WEEKDAY_ORDER.indexOf(b.weekday);
          if (da !== db) return da - db;
          return a.start.localeCompare(b.start);
        });
        scheduleMap[mid] = sorted
          .map(s => `${s.weekday} ${s.start}–${s.end}`)
          .join(' • ');
      });

      const mapped: TherapistAssignment[] = membersRes.data.map(m => ({
        memberId: m.id,
        userId: m.user_id,
        email: m.email,
        name: m.user_id ? (profilesMap[m.user_id]?.name ?? null) : null,
        avatarUrl: m.user_id ? (profilesMap[m.user_id]?.avatar_url ?? null) : null,
        scheduleTime: scheduleMap[m.id] ?? null,
      }));

      setAllMembers(mapped);
      setAssignments(mapped.filter(m => assignedMemberIds.has(m.memberId)));
    } catch (e) {
      console.error('usePatientAssignments error', e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAssignment(member: TherapistAssignment, scheduleTime?: string) {
    if (!orgId) return;
    const isAssigned = assignments.some(a => a.memberId === member.memberId);
    if (isAssigned) {
      await supabase.from('therapist_patient_assignments')
        .delete()
        .eq('member_id', member.memberId)
        .eq('patient_id', patientId);
    } else {
      await supabase.from('therapist_patient_assignments').insert({
        organization_id: orgId,
        member_id: member.memberId,
        patient_id: patientId,
        schedule_time: scheduleTime || null,
      });
    }
    await load();
  }

  async function updateScheduleTime(memberId: string, scheduleTime: string) {
    await supabase.from('therapist_patient_assignments')
      .update({ schedule_time: scheduleTime || null })
      .eq('member_id', memberId)
      .eq('patient_id', patientId);
    await load();
  }

  return { assignments, allMembers, loading, canManage, toggleAssignment, updateScheduleTime, refresh: load };
}

/**
 * Returns the IDs of patients assigned to the current user (when patients.own_only is active).
 */
export function useMyAssignedPatientIds() {
  const { user } = useAuth();
  const [assignedPatientIds, setAssignedPatientIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    try {
      // Find my member id(s) in any org
      const { data: membership } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', user!.id)
        .eq('status', 'active');

      if (!membership?.length) { setAssignedPatientIds(new Set()); setLoading(false); return; }

      const memberIds = membership.map(m => m.id);
      const { data: assignments } = await supabase
        .from('therapist_patient_assignments')
        .select('patient_id')
        .in('member_id', memberIds);

      setAssignedPatientIds(new Set((assignments || []).map(a => a.patient_id)));
    } catch (e) {
      console.error('useMyAssignedPatientIds error', e);
    } finally {
      setLoading(false);
    }
  }

  return { assignedPatientIds, loading };
}
