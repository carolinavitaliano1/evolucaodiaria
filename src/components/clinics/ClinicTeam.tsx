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
import { UserPlus, Mail, Trash2, Crown, Shield, User, Loader2, Users, RefreshCw, CheckCircle2, AlertTriangle, Clock, CalendarDays, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, parseISO, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrganizationMember {
  id: string;
  user_id: string | null;
  email: string;
  role: 'owner' | 'admin' | 'professional';
  status: 'pending' | 'active' | 'inactive';
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
  therapist_email: string;
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

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  pending: 'Convite pendente',
  inactive: 'Inativo',
};

export function ClinicTeam({ clinicId, clinicName }: ClinicTeamProps) {
  const { user } = useAuth();
  const { patients } = useApp();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'professional'>('professional');
  const [selectedPatients, setSelectedPatients] = useState<Record<string, string>>({}); // patient_id -> schedule_time
  const [inviting, setInviting] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [lateEvolutions, setLateEvolutions] = useState<LateEvolution[]>([]);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});
  const [editAssignOpen, setEditAssignOpen] = useState<string | null>(null); // memberId
  const [editAssignPatients, setEditAssignPatients] = useState<Record<string, string>>({});

  const clinicPatients = patients.filter(p => p.clinicId === clinicId && !p.isArchived);
  const isOwner = organization?.owner_id === user?.id;
  const myMember = members.find(m => m.user_id === user?.id);
  const canManage = isOwner || myMember?.role === 'admin';

  useEffect(() => {
    loadTeam();
  }, [clinicId]);

  useEffect(() => {
    if (organization && canManage) {
      loadLateEvolutions();
    }
  }, [organization, canManage]);

  async function loadTeam() {
    setLoading(true);
    try {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('organization_id')
        .eq('id', clinicId)
        .single();

      if (!clinic?.organization_id) {
        setOrganization(null);
        setMembers([]);
        setLoading(false);
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
            : Promise.resolve({ data: [] }),
          supabase.from('therapist_patient_assignments').select('*').in('member_id', memberIds),
        ]);

        const profilesMap: Record<string, { name: string | null; avatar_url: string | null }> = {};
        profilesRes.data?.forEach(p => { profilesMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url }; });

        const assignmentsByMember: Record<string, PatientAssignment[]> = {};
        assignmentsRes.data?.forEach(a => {
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
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');

      // Get assignments for this org with member info
      const { data: assignments } = await supabase
        .from('therapist_patient_assignments')
        .select('patient_id, member_id, organization_members(user_id, email, profiles(name))')
        .eq('organization_id', organization.id);

      if (!assignments?.length) return;

      const late: LateEvolution[] = [];

      for (const assignment of assignments) {
        const patient = clinicPatients.find(p => p.id === assignment.patient_id);
        if (!patient) continue;

        // Check if patient had scheduled sessions yesterday or today but no evolution
        const weekday = format(new Date(), 'EEEE', { locale: ptBR }).toLowerCase();
        const isScheduledToday = patient.weekdays?.some(d =>
          d.toLowerCase() === weekday || d.toLowerCase().startsWith(weekday.slice(0, 3))
        );

        if (!isScheduledToday) continue;

        // Check if evolution exists for today
        const memberId = (assignment as any).organization_members?.user_id;
        if (!memberId) continue;

        const { data: evolutions } = await supabase
          .from('evolutions')
          .select('id')
          .eq('patient_id', assignment.patient_id)
          .eq('user_id', memberId)
          .gte('date', yesterday)
          .limit(1);

        if (!evolutions?.length) {
          const memberInfo = (assignment as any).organization_members;
          const profileInfo = memberInfo?.profiles;
          late.push({
            patient_id: assignment.patient_id,
            patient_name: patient.name,
            scheduled_date: today,
            therapist_name: profileInfo?.name || memberInfo?.email || 'Terapeuta',
            therapist_email: memberInfo?.email || '',
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
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: clinicName, owner_id: user.id })
        .select()
        .single();

      if (orgError || !org) throw orgError;

      await supabase.from('clinics').update({ organization_id: org.id }).eq('id', clinicId);
      await supabase.from('organization_members').insert({
        organization_id: org.id,
        user_id: user.id,
        email: user.email!,
        role: 'owner',
        status: 'active',
        invited_by: user.id,
        joined_at: new Date().toISOString(),
      });

      toast.success('Equipe criada com sucesso!');
      loadTeam();
    } catch (err) {
      toast.error('Erro ao criar equipe');
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail || !organization) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          organization_id: organization.id,
          email: inviteEmail,
          role: inviteRole,
          patient_assignments: Object.entries(selectedPatients).map(([patient_id, schedule_time]) => ({
            patient_id,
            schedule_time,
          })),
        },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      toast.success(`Convite enviado para ${inviteEmail}`);
      setInviteEmail('');
      setSelectedPatients({});
      setInviteOpen(false);
      loadTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar convite');
    } finally {
      setInviting(false);
    }
  }

  async function handleResendInvite(member: OrganizationMember) {
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
    } finally {
      setResendingId(null);
    }
  }

  async function handleRemoveMember() {
    if (!removeMemberId) return;
    const { error } = await supabase.from('organization_members').delete().eq('id', removeMemberId);
    if (error) {
      toast.error('Erro ao remover membro');
    } else {
      toast.success('Membro removido');
      loadTeam();
    }
    setRemoveMemberId(null);
  }

  async function handleChangeRole(memberId: string, newRole: 'admin' | 'professional') {
    const { error } = await supabase.from('organization_members').update({ role: newRole }).eq('id', memberId);
    if (error) toast.error('Erro ao alterar papel');
    else { toast.success('Papel atualizado'); loadTeam(); }
  }

  async function saveAssignments(memberId: string) {
    if (!organization) return;
    try {
      // Delete existing assignments for this member
      await supabase.from('therapist_patient_assignments').delete().eq('member_id', memberId);

      // Insert new assignments
      const toInsert = Object.entries(editAssignPatients).map(([patient_id, schedule_time]) => ({
        organization_id: organization.id,
        member_id: memberId,
        patient_id,
        schedule_time: schedule_time || null,
      }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from('therapist_patient_assignments').insert(toInsert);
        if (error) throw error;
      }

      toast.success('Pacientes atualizados');
      setEditAssignOpen(null);
      loadTeam();
    } catch (err) {
      toast.error('Erro ao salvar pacientes');
    }
  }

  function togglePatientSelection(patientId: string) {
    setSelectedPatients(prev => {
      if (prev[patientId] !== undefined) {
        const next = { ...prev };
        delete next[patientId];
        return next;
      }
      return { ...prev, [patientId]: '' };
    });
  }

  function toggleEditPatient(patientId: string) {
    setEditAssignPatients(prev => {
      if (prev[patientId] !== undefined) {
        const next = { ...prev };
        delete next[patientId];
        return next;
      }
      return { ...prev, [patientId]: '' };
    });
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
      {/* Late Evolutions Alert Panel (admin only) */}
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
          <Dialog open={inviteOpen} onOpenChange={open => { setInviteOpen(open); if (!open) { setInviteEmail(''); setSelectedPatients({}); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Convidar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Convidar profissional</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>E-mail do profissional</Label>
                  <Input
                    type="email"
                    placeholder="profissional@email.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Função na equipe</Label>
                  <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5" />
                          <div>
                            <div>Terapeuta / Profissional</div>
                            <div className="text-xs text-muted-foreground">Acessa apenas seus pacientes vinculados</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5" />
                          <div>
                            <div>Supervisor / Administrador</div>
                            <div className="text-xs text-muted-foreground">Pode convidar membros e ver todos os dados</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Pacientes vinculados
                    <span className="text-xs font-normal text-muted-foreground ml-1">(selecione os que este profissional atenderá)</span>
                  </Label>
                  {clinicPatients.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhum paciente cadastrado nesta clínica.</p>
                  ) : (
                    <ScrollArea className="h-52 border rounded-md p-2">
                      <div className="space-y-1">
                        {clinicPatients.map(patient => (
                          <div key={patient.id} className="space-y-1.5">
                            <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                              onClick={() => togglePatientSelection(patient.id)}>
                              <Checkbox
                                checked={selectedPatients[patient.id] !== undefined}
                                onCheckedChange={() => togglePatientSelection(patient.id)}
                              />
                              <span className="text-sm font-medium">{patient.name}</span>
                              {patient.scheduleTime && (
                                <span className="text-xs text-muted-foreground ml-auto">{patient.scheduleTime}</span>
                              )}
                            </div>
                            {selectedPatients[patient.id] !== undefined && (
                              <div className="pl-8 pb-1">
                                <Input
                                  placeholder="Horário (ex: 14:00)"
                                  value={selectedPatients[patient.id]}
                                  onChange={e => setSelectedPatients(prev => ({ ...prev, [patient.id]: e.target.value }))}
                                  className="h-7 text-xs"
                                  onClick={e => e.stopPropagation()}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  {Object.keys(selectedPatients).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Object.keys(selectedPatients).length} paciente(s) selecionado(s)
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail} className="gap-2">
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Enviar convite
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Members List */}
      <div className="space-y-2">
        {members.map(member => {
          const isExpanded = expandedMembers[member.id];
          const hasAssignments = (member.assignments?.length ?? 0) > 0;
          return (
            <div key={member.id} className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center justify-between p-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${member.status === 'active' ? 'bg-primary/10' : 'bg-muted'}`}>
                    {member.status === 'active' ? ROLE_ICONS[member.role] : <Mail className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm text-foreground truncate">
                        {member.profile?.name || member.email}
                      </p>
                      {member.status === 'active' && member.joined_at && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      )}
                    </div>
                    {member.profile?.name && (
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    )}
                    {member.status === 'pending' && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">Aguardando aceite por e-mail</p>
                    )}
                    {member.status === 'active' && hasAssignments && (
                      <p className="text-xs text-muted-foreground">{member.assignments!.length} paciente(s) vinculado(s)</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={member.status === 'active' ? 'default' : 'secondary'}
                    className="text-xs hidden sm:flex"
                  >
                    {STATUS_LABELS[member.status]}
                  </Badge>

                  {canManage && member.status === 'pending' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleResendInvite(member)}
                          disabled={resendingId === member.id}
                        >
                          {resendingId === member.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <RefreshCw className="w-3.5 h-3.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reenviar convite por e-mail</TooltipContent>
                    </Tooltip>
                  )}

                  {canManage && member.role !== 'owner' && member.user_id !== user?.id && member.status === 'active' && (
                    <Select value={member.role} onValueChange={(v: any) => handleChangeRole(member.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-auto gap-1 border-dashed">
                        <span className="flex items-center gap-1">
                          {ROLE_ICONS[member.role]}
                          {ROLE_LABELS[member.role]}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="professional">Profissional</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {member.role === 'owner' && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Crown className="w-2.5 h-2.5" />
                      Dono
                    </Badge>
                  )}

                  {/* Expand/collapse patient assignments */}
                  {(hasAssignments || (canManage && member.status === 'active' && member.role !== 'owner')) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setExpandedMembers(prev => ({ ...prev, [member.id]: !prev[member.id] }))}
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </Button>
                  )}

                  {canManage && member.role !== 'owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setRemoveMemberId(member.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded patient assignments */}
              {isExpanded && (
                <div className="border-t bg-muted/30 px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pacientes vinculados</p>
                    {canManage && member.status === 'active' && member.role !== 'owner' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => {
                          const current: Record<string, string> = {};
                          member.assignments?.forEach(a => { current[a.patient_id] = a.schedule_time || ''; });
                          setEditAssignPatients(current);
                          setEditAssignOpen(member.id);
                        }}
                      >
                        Editar pacientes
                      </Button>
                    )}
                  </div>
                  {!hasAssignments ? (
                    <p className="text-xs text-muted-foreground italic">Nenhum paciente vinculado ainda.</p>
                  ) : (
                    <div className="space-y-1">
                      {member.assignments!.map(a => {
                        const patient = clinicPatients.find(p => p.id === a.patient_id);
                        return (
                          <div key={a.id} className="flex items-center justify-between text-sm py-0.5">
                            <span className="text-foreground">{patient?.name || a.patient_name || 'Paciente'}</span>
                            {a.schedule_time && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {a.schedule_time}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit assignments dialog */}
      <Dialog open={!!editAssignOpen} onOpenChange={open => !open && setEditAssignOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar pacientes vinculados</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Selecione os pacientes que este profissional poderá visualizar e atender.</p>
            <ScrollArea className="h-64 border rounded-md p-2">
              <div className="space-y-1">
                {clinicPatients.map(patient => (
                  <div key={patient.id} className="space-y-1.5">
                    <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleEditPatient(patient.id)}>
                      <Checkbox
                        checked={editAssignPatients[patient.id] !== undefined}
                        onCheckedChange={() => toggleEditPatient(patient.id)}
                      />
                      <span className="text-sm font-medium">{patient.name}</span>
                    </div>
                    {editAssignPatients[patient.id] !== undefined && (
                      <div className="pl-8 pb-1">
                        <Input
                          placeholder="Horário (ex: 14:00)"
                          value={editAssignPatients[patient.id]}
                          onChange={e => setEditAssignPatients(prev => ({ ...prev, [patient.id]: e.target.value }))}
                          className="h-7 text-xs"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditAssignOpen(null)}>Cancelar</Button>
              <Button onClick={() => editAssignOpen && saveAssignments(editAssignOpen)}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeMemberId} onOpenChange={open => !open && setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Este membro perderá acesso à equipe e seus vínculos com pacientes serão removidos. Deseja continuar?
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
