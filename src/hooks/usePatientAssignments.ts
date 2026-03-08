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

      // Load all active members + their assignments for this patient in parallel
      const [membersRes, assignmentsRes] = await Promise.all([
        supabase.from('organization_members')
          .select('id, user_id, email, role')
          .eq('organization_id', clinic.organization_id)
          .eq('status', 'active'),
        supabase.from('therapist_patient_assignments')
          .select('member_id, schedule_time')
          .eq('patient_id', patientId)
          .eq('organization_id', clinic.organization_id),
      ]);

      if (!membersRes.data) { setLoading(false); return; }

      const userIds = membersRes.data.filter(m => m.user_id).map(m => m.user_id!);
      let profilesMap: Record<string, { name: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles').select('user_id, name, avatar_url').in('user_id', userIds);
        profiles?.forEach(p => { profilesMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url }; });
      }

      const assignedMemberIds = new Set((assignmentsRes.data || []).map(a => a.member_id));
      const scheduleMap: Record<string, string | null> = {};
      (assignmentsRes.data || []).forEach(a => { scheduleMap[a.member_id] = a.schedule_time; });

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
