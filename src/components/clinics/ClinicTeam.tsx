import { useState, useEffect, useMemo } from 'react';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { TeamAttendanceGrid } from '@/components/clinics/TeamAttendanceGrid';
import { StaffAttendanceReport } from '@/components/clinics/StaffAttendanceReport';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  UserPlus, Mail, Trash2, Crown, Shield, User, Loader2, Users,
  RefreshCw, CheckCircle2, AlertTriangle, Clock, CalendarDays,
  Settings, Lock, MoreVertical, UserCheck, UserX,
  Briefcase, Banknote, Search, SlidersHorizontal, UserCircle, Activity
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PermissionKey,
  DEFAULT_THERAPIST_PERMISSIONS,
  ALL_PERMISSIONS,
  PRESET_ROLES,
} from '@/hooks/useOrgPermissions';
import { PermissionEditor } from '@/components/clinics/PermissionEditor';
import { cn } from '@/lib/utils';

interface OrganizationMember {
  id: string;
  user_id: string | null;
  email: string;
  role: 'owner' | 'admin' | 'professional';
  role_label: string | null;
  status: 'pending' | 'active' | 'inactive';
  permissions: PermissionKey[];
  joined_at: string | null;
  created_at: string;
  profile?: { name: string | null; avatar_url: string | null };
  assignments?: PatientAssignment[];
}

interface PatientAssignment {
  id: string;
  patient_id: string;
  schedule_time: string | null;
  patient_name?: string;
}

interface Organization {
  id: string;
  name: string;
  owner_id: string;
}

interface LateEvolution {
  patient_id: string;
  patient_name: string;
  scheduled_date: string;
  therapist_name: string;
}

interface ClinicTeamProps {
  clinicId: string;
  clinicName: string;
  onTeamCreated?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  professional: 'Profissional',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/30',
  pending: 'bg-warning/10 text-warning border-warning/30',
  inactive: 'bg-muted text-muted-foreground border-border',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  inactive: 'Inativo',
};

function parsePermissions(raw: any): PermissionKey[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as PermissionKey[];
  if (typeof raw === 'object') {
    return Object.keys(raw).filter(k => (raw as any)[k]) as PermissionKey[];
  }
  return [];
}

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() || '?';
  }
  return email[0]?.toUpperCase() || '?';
}

// Deterministic color from string
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500',
  'bg-emerald-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
];
function getAvatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getPresetIcon(icon: string) {
  if (icon === 'shield') return Shield;
  if (icon === 'calendar') return CalendarDays;
  if (icon === 'banknote') return Banknote;
  return User;
}

export function ClinicTeam({ clinicId, clinicName, onTeamCreated }: ClinicTeamProps) {
  const { user } = useAuth();
  const { patients } = useApp();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [lateEvolutions, setLateEvolutions] = useState<LateEvolution[]>([]);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'professional'>('professional');
  const [inviteRoleLabel, setInviteRoleLabel] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<Record<string, string>>({});
  const [invitePermissions, setInvitePermissions] = useState<PermissionKey[]>([...DEFAULT_THERAPIST_PERMISSIONS]);
  const [inviting, setInviting] = useState(false);
  const [invitePreset, setInvitePreset] = useState<string>('terapeuta');

  // Member management modal
  const [manageMember, setManageMember] = useState<OrganizationMember | null>(null);
  const [editPatients, setEditPatients] = useState<Record<string, string>>({});
  const [editPermissions, setEditPermissions] = useState<PermissionKey[]>([]);
  const [editRoleLabel, setEditRoleLabel] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  // Remove confirm
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  // Resend
  const [resendingId, setResendingId] = useState<string | null>(null);

  const clinicPatients = patients.filter(p => p.clinicId === clinicId && isPatientActiveOn(p));
  const isOwner = organization?.owner_id === user?.id;
  const myMember = members.find(m => m.user_id === user?.id);
  const canManage = isOwner || myMember?.role === 'admin';

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const q = searchQuery.toLowerCase();
      const nameMatch = (m.profile?.name || '').toLowerCase().includes(q);
      const emailMatch = m.email.toLowerCase().includes(q);
      const roleMatch = (m.role_label || ROLE_LABELS[m.role] || '').toLowerCase().includes(q);
      const matchesSearch = !q || nameMatch || emailMatch || roleMatch;
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [members, searchQuery, statusFilter]);

  useEffect(() => { loadTeam(); }, [clinicId]);

  const MembersView = (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou cargo..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-1 bg-muted/50 border border-border p-1 rounded-lg">
            {(['all', 'active', 'pending', 'inactive'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[10px] font-medium transition-all',
                  statusFilter === s
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {STATUS_LABELS[s] || 'Todos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => {
          const initials = getInitials(member.profile?.name, member.email);
          const color = getAvatarColor(member.email);
          const roleLabel = member.role_label || ROLE_LABELS[member.role] || member.role;
          const isMe = member.user_id === user?.id;

          return (
            <div
              key={member.id}
              onClick={() => canManage && setManageMember(member)}
              className={cn(
                'group p-4 rounded-2xl border bg-card transition-all flex flex-col',
                canManage ? 'cursor-pointer hover:border-primary/40 hover:shadow-md' : 'cursor-default'
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-11 h-11 ring-2 ring-background ring-offset-2 ring-offset-border/20">
                    {member.profile?.avatar_url && (
                      <AvatarImage src={member.profile.avatar_url} />
                    )}
                    <AvatarFallback className={cn('text-white font-bold', color)}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">
                      {member.profile?.name || member.email.split('@')[0]}
                      {isMe && <span className="ml-1.5 text-[10px] font-normal text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Você</span>}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5 font-medium border-0', STATUS_COLORS[member.status])}>
                        {STATUS_LABELS[member.status]}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground truncate">{roleLabel}</span>
                    </div>
                  </div>
                </div>
                {canManage && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {!isMe && member.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-primary hover:bg-primary/10"
                        onClick={e => handleResendInvite(member, e)}
                        disabled={resendingId === member.id}
                        title="Reenviar convite"
                      >
                        {resendingId === member.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </Button>
                    {isOwner && !isMe && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn('h-7 w-7 p-0 shrink-0', member.status === 'active' ? 'text-destructive hover:bg-destructive/10' : 'text-success hover:bg-success/10')}
                        onClick={e => { e.stopPropagation(); handleToggleMemberStatus(member); }}
                        title={member.status === 'active' ? 'Suspender acesso' : 'Reativar acesso'}
                      >
                        {member.status === 'active' ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Assignments preview */}
              {member.assignments && member.assignments.length > 0 && (
                <div className="mt-auto pt-4 border-t border-border/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <UserCircle className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pacientes ({member.assignments.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {member.assignments.slice(0, 3).map(a => (
                      <span key={a.id} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/50">
                        {a.patient_name || '...'}
                      </span>
                    ))}
                    {member.assignments.length > 3 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        +{member.assignments.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add collaborator card */}
        {canManage && (
          <button
            onClick={() => setInviteOpen(true)}
            className="rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-card hover:bg-primary/5 p-4 flex flex-col items-center justify-center gap-3 transition-all min-h-[180px] cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Convidar Colaborador</p>
              <p className="text-xs text-muted-foreground mt-0.5">Enviar convite por e-mail</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );

  const AttendanceView = (
    <div className="space-y-6">
      {organization && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Quadro de Presença</h3>
            <span className="text-xs text-muted-foreground">— registre presenças, faltas e justificativas</span>
          </div>
          <TeamAttendanceGrid
            organizationId={organization.id}
            members={members}
            canManage={canManage}
          />
        </div>
      )}
    </div>
  );

  const FrequencyView = (
    <div className="space-y-6">
      {organization && (
        <StaffAttendanceReport 
          organizationId={organization.id} 
          members={members} 
        />
      )}
    </div>
  );

  useEffect(() => {
    if (organization && canManage) loadLateEvolutions();
  }, [organization, canManage]);

  // Realtime: auto-refresh when a member accepts invite or status changes
  useEffect(() => {
    if (!organization) return;
    const channel = supabase
      .channel(`org-members-${organization.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organization_members',
          filter: `organization_id=eq.${organization.id}`,
        },
        () => { loadTeam(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organization?.id]);

  useEffect(() => {
    const preset = PRESET_ROLES.find(p => p.id === invitePreset);
    if (preset) {
      setInviteRole(preset.baseRole);
      setInviteRoleLabel(preset.label);
      setInvitePermissions([...preset.permissions]);
    }
  }, [invitePreset]);

  async function loadTeam() {
    setLoading(true);
    try {
      const { data: clinic } = await supabase
        .from('clinics').select('organization_id').eq('id', clinicId).single();

      if (!clinic?.organization_id) {
        setOrganization(null);
        setMembers([]);
        return;
      }

      const [orgRes, membersRes] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', clinic.organization_id).single(),
        supabase.from('organization_members').select('*').eq('organization_id', clinic.organization_id).order('created_at'),
      ]);

      setOrganization(orgRes.data);

      if (membersRes.data) {
        const userIds = membersRes.data.filter(m => m.user_id).map(m => m.user_id!);
        const memberIds = membersRes.data.map(m => m.id);

        const [profilesRes, assignmentsRes] = await Promise.all([
          userIds.length > 0
            ? supabase.from('profiles').select('user_id, name, avatar_url').in('user_id', userIds)
            : Promise.resolve({ data: [] as any[] }),
          supabase.from('therapist_patient_assignments').select('*').in('member_id', memberIds),
        ]);

        const profilesMap: Record<string, { name: string | null; avatar_url: string | null }> = {};
        (profilesRes.data ?? []).forEach((p: any) => { profilesMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url }; });

        const assignmentsByMember: Record<string, PatientAssignment[]> = {};
        (assignmentsRes.data ?? []).forEach((a: any) => {
          const patient = clinicPatients.find(p => p.id === a.patient_id);
          if (!assignmentsByMember[a.member_id]) assignmentsByMember[a.member_id] = [];
          assignmentsByMember[a.member_id].push({
            id: a.id,
            patient_id: a.patient_id,
            schedule_time: a.schedule_time,
            patient_name: patient?.name,
          });
        });

        setMembers(membersRes.data.map(m => ({
          ...m,
          role: m.role as OrganizationMember['role'],
          status: m.status as OrganizationMember['status'],
          role_label: (m as any).role_label ?? null,
          permissions: parsePermissions((m as any).permissions),
          profile: m.user_id ? profilesMap[m.user_id] : undefined,
          assignments: assignmentsByMember[m.id] || [],
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLateEvolutions() {
    if (!organization) return;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const todayWeekday = format(new Date(), 'EEEE', { locale: ptBR }).toLowerCase();

      const { data: assignments } = await supabase
        .from('therapist_patient_assignments')
        .select('patient_id, member_id')
        .eq('organization_id', organization.id);

      if (!assignments?.length) return;

      // Gather scheduled assignments (check patient weekdays first — no DB call needed)
      const scheduled: { patientId: string; memberId: string; userId: string; patientName: string; therapistName: string }[] = [];
      for (const a of assignments) {
        const patient = clinicPatients.find(p => p.id === a.patient_id);
        if (!patient) continue;
        const isScheduled = patient.weekdays?.some(d =>
          todayWeekday.startsWith(d.toLowerCase().slice(0, 3))
        );
        if (!isScheduled) continue;
        const member = members.find(m => m.id === a.member_id);
        if (!member?.user_id) continue;
        scheduled.push({
          patientId: a.patient_id,
          memberId: a.member_id,
          userId: member.user_id,
          patientName: patient.name,
          therapistName: member.profile?.name || member.email,
        });
      }

      if (!scheduled.length) { setLateEvolutions([]); return; }

      // Single batch query for all evolutions in range
      const patientIds = [...new Set(scheduled.map(s => s.patientId))];
      const { data: evols } = await supabase
        .from('evolutions')
        .select('patient_id, user_id')
        .in('patient_id', patientIds)
        .gte('date', yesterday)
        .lte('date', today);

      const evolSet = new Set((evols || []).map(e => `${e.patient_id}::${e.user_id}`));

      const late: LateEvolution[] = scheduled
        .filter(s => !evolSet.has(`${s.patientId}::${s.userId}`))
        .map(s => ({
          patient_id: s.patientId,
          patient_name: s.patientName,
          scheduled_date: today,
          therapist_name: s.therapistName,
        }));

      setLateEvolutions(late);
    } catch (err) {
      console.error('Erro ao carregar evoluções atrasadas:', err);
    }
  }

  async function createOrganization() {
    if (!user) return;
    setCreating(true);
    try {
      const { data: org, error } = await supabase
        .from('organizations').insert({ name: clinicName, owner_id: user.id }).select().single();
      if (error || !org) throw error;
      await supabase.from('clinics').update({ organization_id: org.id }).eq('id', clinicId);
      await supabase.from('organization_members').insert({
        organization_id: org.id, user_id: user.id, email: user.email!,
        role: 'owner', status: 'active', invited_by: user.id, joined_at: new Date().toISOString(),
        permissions: Object.fromEntries(ALL_PERMISSIONS.map(p => [p, true])),
      });
      toast.success('Equipe criada!');
      onTeamCreated?.();
      loadTeam();
    } catch { toast.error('Erro ao criar equipe'); }
    finally { setCreating(false); }
  }

  async function handleInvite() {
    if (!inviteEmail || !organization) return;
    setInviting(true);
    try {
      const permissionsMap = Object.fromEntries(
        ALL_PERMISSIONS.map(p => [p, invitePermissions.includes(p)])
      );
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          organization_id: organization.id,
          email: inviteEmail,
          role: inviteRole,
          role_label: inviteRoleLabel || null,
          permissions: permissionsMap,
          patient_assignments: Object.entries(selectedPatients).map(([patient_id, schedule_time]) => ({
            patient_id, schedule_time,
          })),
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Convite enviado para ${inviteEmail}`);
      setInviteEmail('');
      setInviteRoleLabel('');
      setSelectedPatients({});
      setInvitePermissions([...DEFAULT_THERAPIST_PERMISSIONS]);
      setInvitePreset('terapeuta');
      setInviteOpen(false);
      loadTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar convite');
    } finally { setInviting(false); }
  }

  async function handleResendInvite(member: OrganizationMember, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!organization) return;
    setResendingId(member.id);
    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { organization_id: organization.id, email: member.email, role: member.role },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Convite reenviado para ${member.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reenviar convite');
    } finally { setResendingId(null); }
  }

  async function handleRemoveMember() {
    if (!removeMemberId) return;
    await supabase.from('therapist_patient_assignments').delete().eq('member_id', removeMemberId);
    const { error } = await supabase.from('organization_members').delete().eq('id', removeMemberId);
    if (error) toast.error('Erro ao remover membro');
    else { toast.success('Membro removido'); loadTeam(); }
    setRemoveMemberId(null);
    setManageMember(null);
  }

  async function handleToggleMemberStatus(member: OrganizationMember) {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase
      .from('organization_members').update({ status: newStatus }).eq('id', member.id);
    if (error) toast.error('Erro ao atualizar status');
    else {
      toast.success(newStatus === 'active' ? 'Acesso reativado' : 'Acesso suspenso');
      loadTeam();
      setManageMember(prev => prev ? { ...prev, status: newStatus as OrganizationMember['status'] } : null);
    }
  }

  async function handleChangeRole(memberId: string, newRole: 'admin' | 'professional') {
    const { error } = await supabase.from('organization_members').update({ role: newRole }).eq('id', memberId);
    if (error) {
      toast.error('Erro ao alterar função');
    } else {
      // Update local state immediately — do NOT reload team here to avoid
      // wiping editPermissions that the user just selected via preset
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setManageMember(prev => prev ? { ...prev, role: newRole } : null);
    }
  }

  async function saveAssignments() {
    if (!manageMember || !organization) return;
    setSavingAssign(true);
    try {
      const permissionsMap = Object.fromEntries(
        ALL_PERMISSIONS.map(p => [p, editPermissions.includes(p)])
      );
      const { error: updateError } = await supabase.from('organization_members').update({
        permissions: permissionsMap,
        role_label: editRoleLabel || null,
        role: manageMember.role, // persist the role selected via preset cards
      }).eq('id', manageMember.id);
      if (updateError) throw updateError;

      await supabase.from('therapist_patient_assignments').delete().eq('member_id', manageMember.id);
      const toInsert = Object.entries(editPatients).map(([patient_id, schedule_time]) => ({
        organization_id: organization.id,
        member_id: manageMember.id,
        patient_id,
        schedule_time: schedule_time || null,
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from('therapist_patient_assignments').insert(toInsert);
        if (error) throw error;
      }
      toast.success('Permissões e pacientes atualizados');
      await loadTeam(); // refresh grid after save
      setManageMember(null);
    } catch (err) {
      console.error('saveAssignments error', err);
      toast.error('Erro ao salvar');
    }
    finally { setSavingAssign(false); }
  }

  function openManageModal(member: OrganizationMember) {
    if (!canManage || member.role === 'owner') return;
    const current: Record<string, string> = {};
    member.assignments?.forEach(a => { current[a.patient_id] = a.schedule_time || ''; });
    setEditPatients(current);
    setEditPermissions(
      member.permissions.length > 0
        ? [...member.permissions]
        : [...DEFAULT_THERAPIST_PERMISSIONS]
    );
    setEditRoleLabel(member.role_label || '');
    setManageMember(member);
  }

  function toggleInvitePatient(patientId: string) {
    setSelectedPatients(prev => {
      if (prev[patientId] !== undefined) { const n = { ...prev }; delete n[patientId]; return n; }
      return { ...prev, [patientId]: '' };
    });
  }

  function toggleEditPatient(patientId: string) {
    setEditPatients(prev => {
      if (prev[patientId] !== undefined) { const n = { ...prev }; delete n[patientId]; return n; }
      return { ...prev, [patientId]: '' };
    });
  }

  function togglePerm(perm: PermissionKey, state: PermissionKey[], setState: (p: PermissionKey[]) => void) {
    setState(state.includes(perm) ? state.filter(p => p !== perm) : [...state, perm]);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">Equipe multidisciplinar</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Ative o modo equipe para convidar outros profissionais para esta clínica.
          </p>
        </div>
        <Button onClick={createOrganization} disabled={creating} className="gap-2">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          Ativar modo equipe
        </Button>
      </div>
    );
  }

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingMembers = members.filter(m => m.status === 'pending');
  const inactiveMembers = members.filter(m => m.status === 'inactive');

  return (
    <div className="space-y-6">
      {/* Late Evolutions Alert */}
      {canManage && lateEvolutions.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h4 className="font-semibold text-sm text-destructive">
              Evoluções Atrasadas — {lateEvolutions.length} alerta{lateEvolutions.length > 1 ? 's' : ''}
            </h4>
          </div>
          <div className="space-y-2">
            {lateEvolutions.map((le, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Clock className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-foreground">{le.patient_name}</span>
                  <span className="text-muted-foreground"> — sem evolução hoje</span>
                  <div className="text-xs text-muted-foreground">Terapeuta: {le.therapist_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header + Stats + Invite button */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Stats pills */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors text-xs font-semibold',
                statusFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              <Users className="w-3.5 h-3.5" />
              {members.length} total
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors text-xs font-semibold',
                statusFilter === 'active' ? 'bg-success text-success-foreground border-success' : 'bg-success/10 border-success/30 text-success hover:border-success/60'
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {activeMembers.length} ativo{activeMembers.length !== 1 ? 's' : ''}
            </button>
            {pendingMembers.length > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors text-xs font-semibold',
                  statusFilter === 'pending' ? 'bg-warning text-warning-foreground border-warning' : 'bg-warning/10 border-warning/30 text-warning hover:border-warning/60'
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                {pendingMembers.length} pendente{pendingMembers.length !== 1 ? 's' : ''}
              </button>
            )}
            {inactiveMembers.length > 0 && (
              <button
                onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors text-xs font-semibold',
                  statusFilter === 'inactive' ? 'bg-muted-foreground text-background border-muted-foreground' : 'bg-muted border-border text-muted-foreground hover:border-primary/40'
                )}
              >
                <UserX className="w-3.5 h-3.5" />
                {inactiveMembers.length} inativo{inactiveMembers.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>

          {canManage && (
          <Dialog open={inviteOpen} onOpenChange={open => { setInviteOpen(open); if (!open) { setInviteEmail(''); setInviteRoleLabel(''); setSelectedPatients({}); setInvitePreset('terapeuta'); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 shrink-0">
                <UserPlus className="w-4 h-4" />
                Convidar Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-primary" />
                  </div>
                  Convidar Colaborador
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-5 pt-2 pb-2">
                  {/* E-mail */}
                  <div className="space-y-1.5">
                    <Label>E-mail do colaborador</Label>
                    <Input type="email" placeholder="colaborador@email.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                  </div>

                  <Separator />

                  {/* Preset role cards */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Cargo</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESET_ROLES.map(preset => {
                        const Icon = getPresetIcon(preset.icon);
                        const isSelected = invitePreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setInvitePreset(preset.id)}
                            className={cn(
                              'text-left p-3 rounded-lg border-2 transition-all flex flex-col gap-1',
                              isSelected
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/40 bg-card'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                'w-7 h-7 rounded-md flex items-center justify-center',
                                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                              )}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <span className={cn('text-sm font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                                {preset.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-tight">{preset.description}</p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Especialidade / Título personalizado <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
                      <Input placeholder="Ex: Fonoaudióloga, Aux. Administrativo..." value={inviteRoleLabel} onChange={e => setInviteRoleLabel(e.target.value)} />
                    </div>
                  </div>

                  <Separator />

                  {/* Permissions */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permissões de acesso</p>
                    <p className="text-xs text-muted-foreground">
                      Defina o nível de acesso de cada módulo. Você pode ajustar após selecionar o cargo.
                    </p>
                    <PermissionEditor
                      permissions={invitePermissions}
                      onChange={setInvitePermissions}
                      compact={true}
                    />
                  </div>

                  <Separator />

                  {/* Patient assignments */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pacientes vinculados <span className="font-normal normal-case">(opcional)</span></p>
                    </div>
                    {clinicPatients.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">Nenhum paciente nesta clínica.</p>
                    ) : (
                      <div className="border rounded-md p-2 max-h-44 overflow-y-auto space-y-1">
                        {clinicPatients.map(patient => (
                          <div key={patient.id} className="space-y-1.5">
                            <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer" onClick={() => toggleInvitePatient(patient.id)}>
                              <Checkbox checked={selectedPatients[patient.id] !== undefined} onCheckedChange={() => toggleInvitePatient(patient.id)} />
                              <span className="text-sm">{patient.name}</span>
                            </div>
                            {selectedPatients[patient.id] !== undefined && (
                              <div className="pl-8 pb-1">
                                <Input placeholder="Horário (ex: 14:00)" value={selectedPatients[patient.id]}
                                  onChange={e => setSelectedPatients(prev => ({ ...prev, [patient.id]: e.target.value }))}
                                  className="h-7 text-xs" onClick={e => e.stopPropagation()} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {Object.keys(selectedPatients).length > 0 && (
                      <p className="text-xs text-muted-foreground">{Object.keys(selectedPatients).length} paciente(s) selecionado(s)</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail} className="gap-2">
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Enviar convite por e-mail
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou cargo..."
            className="pl-9 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {filteredMembers.length === 0 && members.length > 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 italic">
            Nenhum colaborador encontrado para "{searchQuery}"
          </p>
        )}
      </div>

      {/* ── Collaborators Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => {
          const displayName = member.profile?.name || member.email;
          const displayRole = member.role_label || ROLE_LABELS[member.role] || member.role;
          const initials = getInitials(member.profile?.name, member.email);
          const avatarColor = getAvatarColor(member.email);
          const isClickable = canManage && member.role !== 'owner';

          return (
            <div
              key={member.id}
              className={cn(
                'relative rounded-xl border bg-card p-4 flex flex-col gap-3 transition-all',
                isClickable && 'hover:border-primary/40 hover:shadow-sm cursor-pointer',
                member.status === 'inactive' && 'opacity-60'
              )}
              onClick={() => isClickable && openManageModal(member)}
            >
              {/* Top row: avatar + actions menu */}
              <div className="flex items-start justify-between">
                <div className="relative">
                  <Avatar className="w-14 h-14">
                    {member.profile?.avatar_url && (
                      <AvatarImage src={member.profile.avatar_url} alt={displayName} />
                    )}
                    <AvatarFallback className={cn('text-white font-bold text-base', avatarColor)}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {/* Status dot */}
                  <span className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card',
                    member.status === 'active' ? 'bg-success' :
                    member.status === 'pending' ? 'bg-warning' : 'bg-muted-foreground'
                  )} />
                </div>

                {/* Actions dropdown */}
                {canManage && member.role !== 'owner' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => openManageModal(member)}>
                        <Settings className="w-3.5 h-3.5 mr-2" />
                        Gerenciar acesso
                      </DropdownMenuItem>
                      {member.status === 'pending' && (
                        <DropdownMenuItem onClick={() => handleResendInvite(member)} disabled={resendingId === member.id}>
                          {resendingId === member.id
                            ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                            : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                          Reenviar convite
                        </DropdownMenuItem>
                      )}
                      {member.status !== 'pending' && (
                        <DropdownMenuItem onClick={() => handleToggleMemberStatus(member)}>
                          {member.status === 'active'
                            ? <><UserX className="w-3.5 h-3.5 mr-2" />Suspender acesso</>
                            : <><UserCheck className="w-3.5 h-3.5 mr-2" />Reativar acesso</>}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setRemoveMemberId(member.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Remover da equipe
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Name + email */}
              <div className="min-w-0">
                <p className={cn('font-semibold text-sm leading-tight truncate', member.status === 'inactive' && 'line-through text-muted-foreground')}>
                  {member.profile?.name || <span className="text-muted-foreground font-normal text-xs">{member.email}</span>}
                </p>
                {member.profile?.name && (
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                )}
              </div>

              {/* Role + specialty badges */}
              <div className="flex flex-wrap gap-1.5">
                {member.role === 'owner' ? (
                  <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 border-warning/40 text-warning bg-warning/10">
                    <Crown className="w-2.5 h-2.5" />
                    Dono
                  </Badge>
                ) : member.role === 'admin' ? (
                  <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 border-primary/40 text-primary bg-primary/10">
                    <Shield className="w-2.5 h-2.5" />
                    Administrador
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5">
                    <User className="w-2.5 h-2.5" />
                    Profissional
                  </Badge>
                )}
                {member.role_label && (
                  <Badge variant="secondary" className="text-[10px] gap-1 py-0 h-5">
                    <Briefcase className="w-2.5 h-2.5" />
                    {member.role_label}
                  </Badge>
                )}
                <Badge variant="outline" className={cn('text-[10px] py-0 h-5 border', STATUS_COLORS[member.status])}>
                  {STATUS_LABELS[member.status]}
                </Badge>
              </div>

              {/* Patients + joined info */}
              <div className="space-y-1 mt-auto">
                {member.status === 'active' && (member.assignments?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {member.assignments!.slice(0, 3).map(a => (
                      <span key={a.id} className="inline-flex items-center gap-1 bg-muted/60 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        <User className="w-2.5 h-2.5" />
                        {a.patient_name?.split(' ')[0] || '—'}
                        {a.schedule_time && <span className="text-primary font-medium">· {a.schedule_time}</span>}
                      </span>
                    ))}
                    {(member.assignments?.length ?? 0) > 3 && (
                      <span className="inline-flex items-center bg-muted/60 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        +{(member.assignments?.length ?? 0) - 3}
                      </span>
                    )}
                  </div>
                )}
                {member.status === 'pending' && (
                  <p className="text-[10px] text-warning flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Aguardando aceite do convite
                  </p>
                )}
                {member.status === 'active' && member.joined_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Entrou em {format(new Date(member.joined_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              {canManage && member.role !== 'owner' && (
                <div className="flex gap-1.5 pt-2 border-t border-border mt-auto" onClick={e => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-[11px] gap-1 px-2"
                    onClick={e => { e.stopPropagation(); navigate('/calendar'); }}
                  >
                    <CalendarDays className="w-3 h-3" />
                    Ver Agenda
                  </Button>
                  {member.status !== 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn('h-7 w-7 p-0 shrink-0', member.status === 'active' ? 'text-destructive hover:bg-destructive/10' : 'text-success hover:bg-success/10')}
                      onClick={e => { e.stopPropagation(); handleToggleMemberStatus(member); }}
                      title={member.status === 'active' ? 'Suspender acesso' : 'Reativar acesso'}
                    >
                      {member.status === 'active' ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add collaborator card */}
        {canManage && (
          <button
            onClick={() => setInviteOpen(true)}
            className="rounded-xl border-2 border-dashed border-border hover:border-primary/40 bg-card hover:bg-primary/5 p-4 flex flex-col items-center justify-center gap-3 transition-all min-h-[180px] cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <UserPlus className="w-5 h-5 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Convidar Colaborador</p>
              <p className="text-xs text-muted-foreground mt-0.5">Enviar convite por e-mail</p>
            </div>
          </button>
        )}
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-11 bg-muted/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="members" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <Users className="w-4 h-4" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <CalendarDays className="w-4 h-4" />
            Ponto Diário
          </TabsTrigger>
          <TabsTrigger value="frequency" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <Activity className="w-4 h-4" />
            Frequência
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">{MembersView}</TabsContent>
        <TabsContent value="attendance">{AttendanceView}</TabsContent>
        <TabsContent value="frequency">{FrequencyView}</TabsContent>
      </Tabs>

      {/* ──────────────────────────────────────────────────────────────
          Member Management Modal
      ────────────────────────────────────────────────────────────── */}
      <Dialog open={!!manageMember} onOpenChange={open => !open && setManageMember(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          {manageMember && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      {manageMember.profile?.avatar_url && (
                        <AvatarImage src={manageMember.profile.avatar_url} />
                      )}
                      <AvatarFallback className={cn('text-white font-bold text-sm', getAvatarColor(manageMember.email))}>
                        {getInitials(manageMember.profile?.name, manageMember.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-semibold">{manageMember.profile?.name || manageMember.email}</div>
                      {manageMember.profile?.name && (
                        <div className="text-xs font-normal text-muted-foreground">{manageMember.email}</div>
                      )}
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>

               <ScrollArea className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-5 pt-1 pb-2">
                  {/* Preset role quick-select */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Cargo</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESET_ROLES.map(preset => {
                        const Icon = getPresetIcon(preset.icon);
                        // Active if role matches AND all preset permissions are in editPermissions
                        const isActive =
                          manageMember.role === preset.baseRole &&
                          preset.permissions.length === editPermissions.length &&
                          preset.permissions.every(p => editPermissions.includes(p));
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              handleChangeRole(manageMember.id, preset.baseRole);
                              setEditRoleLabel(preset.label);
                              setEditPermissions([...preset.permissions]);
                            }}
                            className={cn(
                              'text-left p-2.5 rounded-lg border-2 transition-all flex items-center gap-2.5',
                              isActive
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/40 bg-card'
                            )}
                          >
                            <div className={cn(
                              'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                              isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                            )}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className={cn('text-xs font-semibold truncate', isActive ? 'text-primary' : 'text-foreground')}>
                                {preset.label}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">{preset.description.split('.')[0]}.</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Label + Status */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5 col-span-3">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Especialidade / Título personalizado</Label>
                      <Input
                        placeholder="Ex: Fonoaudióloga, Secretária..."
                        value={editRoleLabel}
                        onChange={e => setEditRoleLabel(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Access toggle */}
                  {manageMember.status !== 'pending' && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Acesso ao sistema</p>
                        <p className="text-xs text-muted-foreground">
                          {manageMember.status === 'active'
                            ? 'Pode acessar normalmente'
                            : 'Acesso suspenso — não consegue entrar'}
                        </p>
                      </div>
                      <Switch
                        checked={manageMember.status === 'active'}
                        onCheckedChange={() => handleToggleMemberStatus(manageMember)}
                      />
                    </div>
                  )}

                  <Separator />

                  <Tabs defaultValue="permissions">
                    <TabsList className="w-full">
                      <TabsTrigger value="permissions" className="flex-1 gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        Permissões
                      </TabsTrigger>
                      <TabsTrigger value="patients" className="flex-1 gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        Pacientes
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="permissions" className="mt-4">
                      <p className="text-xs text-muted-foreground mb-4">
                        Controle exatamente o nível de acesso de cada módulo.
                      </p>
                      <PermissionEditor
                        permissions={editPermissions}
                        onChange={setEditPermissions}
                      />
                    </TabsContent>

                    <TabsContent value="patients" className="mt-4 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Selecione quais pacientes este profissional pode visualizar e atender.
                      </p>
                      {clinicPatients.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Nenhum paciente nesta clínica.</p>
                      ) : (
                        <div className="border rounded-md p-2 max-h-52 overflow-y-auto space-y-1">
                          {clinicPatients.map(patient => (
                            <div key={patient.id} className="space-y-1.5">
                              <div
                                className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                                onClick={() => toggleEditPatient(patient.id)}
                              >
                                <Checkbox
                                  checked={editPatients[patient.id] !== undefined}
                                  onCheckedChange={() => toggleEditPatient(patient.id)}
                                />
                                <span className="text-sm">{patient.name}</span>
                                {editPatients[patient.id] !== undefined && editPatients[patient.id] && (
                                  <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {editPatients[patient.id]}
                                  </span>
                                )}
                              </div>
                              {editPatients[patient.id] !== undefined && (
                                <div className="pl-8 pb-1">
                                  <Input
                                    placeholder="Horário (ex: 14:00)"
                                    value={editPatients[patient.id]}
                                    onChange={e => setEditPatients(prev => ({ ...prev, [patient.id]: e.target.value }))}
                                    className="h-7 text-xs"
                                    onClick={e => e.stopPropagation()}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {Object.keys(editPatients).length} paciente(s) selecionado(s)
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                <Button variant="outline" onClick={() => setManageMember(null)}>Cancelar</Button>
                <Button onClick={saveAssignments} disabled={savingAssign} className="gap-2">
                  {savingAssign && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Salvar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog open={!!removeMemberId} onOpenChange={open => !open && setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover colaborador</AlertDialogTitle>
            <AlertDialogDescription>
              Este colaborador perderá acesso à equipe e todos os vínculos com pacientes serão removidos. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
