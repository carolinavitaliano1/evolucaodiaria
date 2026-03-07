import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UserPlus, Mail, Trash2, Crown, Shield, User, Loader2, Users,
  RefreshCw, CheckCircle2, AlertTriangle, Clock, CalendarDays,
  Settings, UserCheck, UserX, Lock, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PermissionKey,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  DEFAULT_THERAPIST_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS,
  ALL_PERMISSIONS,
} from '@/hooks/useOrgPermissions';

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
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  professional: 'Profissional',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3 h-3" />,
  admin: <Shield className="w-3 h-3" />,
  professional: <User className="w-3 h-3" />,
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
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

export function ClinicTeam({ clinicId, clinicName }: ClinicTeamProps) {
  const { user } = useAuth();
  const { patients } = useApp();

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

  const clinicPatients = patients.filter(p => p.clinicId === clinicId && !p.isArchived);
  const isOwner = organization?.owner_id === user?.id;
  const myMember = members.find(m => m.user_id === user?.id);
  const canManage = isOwner || myMember?.role === 'admin';

  useEffect(() => { loadTeam(); }, [clinicId]);

  useEffect(() => {
    if (organization && canManage) loadLateEvolutions();
  }, [organization, canManage]);

  // Sync invite permissions when role changes
  useEffect(() => {
    setInvitePermissions(inviteRole === 'admin' ? [...DEFAULT_ADMIN_PERMISSIONS] : [...DEFAULT_THERAPIST_PERMISSIONS]);
  }, [inviteRole]);

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

      const late: LateEvolution[] = [];

      for (const a of assignments) {
        const patient = clinicPatients.find(p => p.id === a.patient_id);
        if (!patient) continue;

        const isScheduled = patient.weekdays?.some(d =>
          todayWeekday.startsWith(d.toLowerCase().slice(0, 3))
        );
        if (!isScheduled) continue;

        const member = members.find(m => m.id === a.member_id);
        if (!member?.user_id) continue;

        const { data: evols } = await supabase
          .from('evolutions')
          .select('id')
          .eq('patient_id', a.patient_id)
          .eq('user_id', member.user_id)
          .gte('date', yesterday)
          .limit(1);

        if (!evols?.length) {
          late.push({
            patient_id: a.patient_id,
            patient_name: patient.name,
            scheduled_date: today,
            therapist_name: member.profile?.name || member.email,
          });
        }
      }

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
      setInviteOpen(false);
      loadTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar convite');
    } finally { setInviting(false); }
  }

  async function handleResendInvite(member: OrganizationMember, e: React.MouseEvent) {
    e.stopPropagation();
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
    const defaultPerms = newRole === 'admin' ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_THERAPIST_PERMISSIONS;
    const { error } = await supabase.from('organization_members').update({ role: newRole }).eq('id', memberId);
    if (error) toast.error('Erro ao alterar função');
    else {
      toast.success('Função atualizada');
      setEditPermissions([...defaultPerms]);
      loadTeam();
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
      // Save permissions + role_label
      await supabase.from('organization_members').update({
        permissions: permissionsMap,
        role_label: editRoleLabel || null,
      }).eq('id', manageMember.id);

      // Save patient assignments
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
      loadTeam();
      setManageMember(null);
    } catch { toast.error('Erro ao salvar'); }
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
        : member.role === 'admin'
        ? [...DEFAULT_ADMIN_PERMISSIONS]
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

  return (
    <div className="space-y-5">
      {/* Late Evolutions Alert */}
      {canManage && lateEvolutions.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Equipe da clínica</h3>
          <p className="text-sm text-muted-foreground">{members.filter(m => m.status === 'active').length} membro(s) ativo(s)</p>
        </div>
        {canManage && (
          <Dialog open={inviteOpen} onOpenChange={open => { setInviteOpen(open); if (!open) { setInviteEmail(''); setInviteRoleLabel(''); setSelectedPatients({}); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Convidar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Convidar profissional</DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-4 pt-2 pb-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>E-mail do profissional</Label>
                      <Input type="email" placeholder="profissional@email.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Função base</Label>
                      <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Profissional / Terapeuta</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cargo personalizado <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
                    <Input placeholder="Ex: Fonoaudióloga, Secretária, Financeiro..." value={inviteRoleLabel} onChange={e => setInviteRoleLabel(e.target.value)} />
                  </div>

                  <Separator />

                  {/* Permissions */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-semibold">Permissões de acesso</Label>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Defina exatamente o que este profissional poderá acessar no sistema.
                    </p>
                    <div className="space-y-4">
                      {PERMISSION_GROUPS.map(group => (
                        <div key={group.label} className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {group.keys.map(perm => (
                              <div key={perm} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => togglePerm(perm, invitePermissions, setInvitePermissions)}>
                                <Checkbox checked={invitePermissions.includes(perm)} onCheckedChange={() => togglePerm(perm, invitePermissions, setInvitePermissions)} />
                                <span className="text-xs">{PERMISSION_LABELS[perm]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Patient assignments */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-semibold">Pacientes vinculados <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
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
                  Enviar convite
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Members List */}
      <div className="space-y-2">
        {members.map(member => {
          const isClickable = canManage && member.role !== 'owner';
          const displayRole = member.role_label || ROLE_LABELS[member.role] || member.role;
          return (
            <div
              key={member.id}
              className={`rounded-lg border bg-card transition-colors ${isClickable ? 'cursor-pointer hover:border-primary/40 hover:bg-primary/5' : ''}`}
              onClick={() => isClickable && openManageModal(member)}
            >
              <div className="flex items-center justify-between p-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                    ${member.status === 'active' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {member.status === 'active'
                      ? (member.profile?.name?.[0]?.toUpperCase() || member.email[0]?.toUpperCase())
                      : <Mail className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`font-medium text-sm truncate ${member.status === 'inactive' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {member.profile?.name || member.email}
                      </p>
                      {member.status === 'active' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                    </div>
                    {member.profile?.name && (
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {member.status === 'pending' && (
                        <span className="text-xs text-yellow-600 dark:text-yellow-400">Aguardando aceite por e-mail</span>
                      )}
                      {member.status === 'active' && (member.assignments?.length ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground">{member.assignments!.length} paciente(s)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  <Badge variant="outline" className={`text-xs border ${STATUS_COLORS[member.status]} hidden sm:flex`}>
                    {STATUS_LABELS[member.status]}
                  </Badge>

                  {member.role === 'owner' ? (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Crown className="w-2.5 h-2.5" />
                      Dono
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs gap-1 hidden sm:flex">
                      {ROLE_ICONS[member.role]}
                      {displayRole}
                    </Badge>
                  )}

                  {canManage && member.status === 'pending' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={e => handleResendInvite(member, e)} disabled={resendingId === member.id}>
                          {resendingId === member.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <RefreshCw className="w-3.5 h-3.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reenviar convite</TooltipContent>
                    </Tooltip>
                  )}

                  {isClickable && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"
                          onClick={e => { e.stopPropagation(); openManageModal(member); }}>
                          <Settings className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Gerenciar acesso</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Patient list preview */}
              {member.status === 'active' && member.assignments && member.assignments.length > 0 && (
                <div className="px-3 pb-3 pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {member.assignments.map(a => (
                      <div key={a.id} className="flex items-center gap-1 bg-muted/60 rounded-md px-2 py-0.5 text-xs text-muted-foreground">
                        <User className="w-2.5 h-2.5" />
                        <span>{a.patient_name || a.patient_id.slice(0, 6)}</span>
                        {a.schedule_time && (
                          <span className="text-primary font-medium">· {a.schedule_time}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────────
          Member Management Modal
      ────────────────────────────────────────────────────────────── */}
      <Dialog open={!!manageMember} onOpenChange={open => !open && setManageMember(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          {manageMember && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold">
                    {(manageMember.profile?.name?.[0] || manageMember.email[0])?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div>{manageMember.profile?.name || manageMember.email}</div>
                    {manageMember.profile?.name && (
                      <div className="text-xs font-normal text-muted-foreground">{manageMember.email}</div>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>

              <ScrollArea className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-5 pt-1 pb-2">
                  {/* Role + Label + Status */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Função base</Label>
                      <Select value={manageMember.role} onValueChange={(v: any) => handleChangeRole(manageMember.id, v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Profissional</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cargo personalizado</Label>
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

                    {/* Permissions tab */}
                    <TabsContent value="permissions" className="mt-4 space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Controle exatamente quais módulos este profissional pode acessar.
                      </p>
                      {PERMISSION_GROUPS.map(group => (
                        <div key={group.label} className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {group.keys.map(perm => (
                              <div
                                key={perm}
                                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                onClick={() => togglePerm(perm, editPermissions, setEditPermissions)}
                              >
                                <Checkbox
                                  checked={editPermissions.includes(perm)}
                                  onCheckedChange={() => togglePerm(perm, editPermissions, setEditPermissions)}
                                />
                                <span className="text-xs">{PERMISSION_LABELS[perm]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </TabsContent>

                    {/* Patients tab */}
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

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive gap-1.5"
                  onClick={() => setRemoveMemberId(manageMember.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover da equipe
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setManageMember(null)}>Cancelar</Button>
                  <Button onClick={saveAssignments} disabled={savingAssign} className="gap-2">
                    {savingAssign && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog open={!!removeMemberId} onOpenChange={open => !open && setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Este membro perderá acesso à equipe e todos os vínculos com pacientes serão removidos. Deseja continuar?
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
