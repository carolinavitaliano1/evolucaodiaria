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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  UserPlus, Mail, Trash2, Crown, Shield, User, Loader2, Users,
  RefreshCw, CheckCircle2, AlertTriangle, Clock, CalendarDays,
  Settings, Lock, MoreVertical, UserCheck, UserX,
  Briefcase, Banknote, Search, SlidersHorizontal, UserCircle, Activity,
  Plus, Star, Pencil, X, DollarSign
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
import { TeamPublicLinkCard } from '@/components/clinics/TeamPublicLinkCard';
import { TeamApplicationsPanel } from '@/components/clinics/TeamApplicationsPanel';
import { TherapistAgendaModal } from '@/components/clinics/TherapistAgendaModal';
import { MemberRemunerationLinkModal } from '@/components/clinics/MemberRemunerationLinkModal';
import { cn } from '@/lib/utils';

// Helper: extracts the patient's known schedule slots (from scheduleByDay or fallback scheduleTime)
// and renders them as clickable suggestion chips + a native time input for free entry.
function PatientScheduleField({
  patient,
  value,
  onChange,
}: {
  patient: { weekdays?: string[]; scheduleTime?: string; scheduleByDay?: Record<string, { start: string; end: string }> };
  value: string;
  onChange: (v: string) => void;
}) {
  // Build unique time suggestions
  const suggestions = useMemo(() => {
    const set = new Set<string>();
    if (patient.scheduleByDay) {
      Object.entries(patient.scheduleByDay).forEach(([_, range]) => {
        if (range?.start) set.add(range.start);
      });
    }
    if (patient.scheduleTime) set.add(patient.scheduleTime);
    return Array.from(set).sort();
  }, [patient]);

  return (
    <div className="space-y-1.5">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">Horários do paciente:</span>
          {suggestions.map(t => (
            <button
              key={t}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(t); }}
              className={cn(
                "text-xs px-2 py-0.5 rounded border transition-colors",
                value === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-muted/70 border-border"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <Input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-7 text-xs w-32"
          onClick={e => e.stopPropagation()}
          placeholder="--:--"
        />
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-[10px] text-muted-foreground hover:text-destructive underline"
          >
            limpar
          </button>
        )}
      </div>
    </div>
  );
}

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
  weekdays?: string[] | null;
  schedule_by_day?: Record<string, { start: string; end: string }> | null;
  remuneration_type?: 'definir_depois' | 'por_sessao' | 'fixo_mensal' | 'fixo_dia' | null;
  remuneration_value?: number | null;
  profile?: { name: string | null; avatar_url: string | null };
  assignments?: PatientAssignment[];
}

interface PatientAssignment {
  id: string;
  patient_id: string;
  schedule_time: string | null;
  patient_name?: string;
  remuneration_plan_id?: string | null;
}

interface RemunerationPlanRow {
  id: string;
  member_id: string;
  name: string;
  remuneration_type: 'por_sessao' | 'fixo_mensal' | 'fixo_dia' | 'pacote';
  remuneration_value: number;
  is_default: boolean;
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
  // Remuneration & weekdays for new collaborators
  const [inviteRemunerationType, setInviteRemunerationType] = useState<'definir_depois' | 'por_sessao' | 'fixo_mensal' | 'fixo_dia'>('definir_depois');
  const [inviteRemunerationValue, setInviteRemunerationValue] = useState<string>('');
  const [inviteWeekdays, setInviteWeekdays] = useState<string[]>([]);

  // Member management modal
  const [manageMember, setManageMember] = useState<OrganizationMember | null>(null);
  const [editPatients, setEditPatients] = useState<Record<string, string>>({});
  const [editPatientPlans, setEditPatientPlans] = useState<Record<string, string>>({}); // patient_id → plan_id
  const [editPermissions, setEditPermissions] = useState<PermissionKey[]>([]);
  const [editRoleLabel, setEditRoleLabel] = useState('');
  const [editRemunerationType, setEditRemunerationType] = useState<'definir_depois' | 'por_sessao' | 'fixo_mensal' | 'fixo_dia'>('definir_depois');
  const [editRemunerationValue, setEditRemunerationValue] = useState<string>('');
  const [editWeekdays, setEditWeekdays] = useState<string[]>([]);
  const [editScheduleByDay, setEditScheduleByDay] = useState<Record<string, { start: string; end: string }>>({});
  const [savingAssign, setSavingAssign] = useState(false);

  // Plans management for the member being managed
  const [memberPlans, setMemberPlans] = useState<RemunerationPlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanType, setNewPlanType] = useState<'por_sessao' | 'fixo_mensal' | 'fixo_dia' | 'pacote'>('por_sessao');
  const [newPlanValue, setNewPlanValue] = useState('');
  const [linkedPackageId, setLinkedPackageId] = useState<string>('');
  const [clinicPackagesList, setClinicPackagesList] = useState<Array<{ id: string; name: string; price: number; package_type: string }>>([]);

  // Remove confirm
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  // Resend
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Agenda modal
  const [agendaMember, setAgendaMember] = useState<OrganizationMember | null>(null);
  const [remunMember, setRemunMember] = useState<OrganizationMember | null>(null);

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

  // ─── Schedule Summary by weekday (must be declared before any early return) ───
  const scheduleByDay = useMemo(() => {
    const WD = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
    const norm = (d: string) => d.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const map: Record<string, Array<{ member: OrganizationMember; patients: PatientAssignment[] }>> = {};
    WD.forEach(d => { map[d] = []; });
    members.filter(m => m.status === 'active').forEach(member => {
      const memberDays = new Set((member.weekdays || []).map(norm));
      const dayPatients: Record<string, PatientAssignment[]> = {};
      (member.assignments || []).forEach(a => {
        const patient = clinicPatients.find(p => p.id === a.patient_id);
        if (!patient) return;
        const days = new Set<string>();
        (patient.weekdays || []).forEach(d => days.add(norm(d)));
        if (patient.scheduleByDay) Object.keys(patient.scheduleByDay).forEach(d => days.add(norm(d)));
        days.forEach(d => {
          if (!dayPatients[d]) dayPatients[d] = [];
          dayPatients[d].push(a);
        });
      });
      WD.forEach(day => {
        const n = norm(day);
        if (memberDays.has(n) || (dayPatients[n] || []).length > 0) {
          map[day].push({ member, patients: dayPatients[n] || [] });
        }
      });
    });
    return map;
  }, [members, clinicPatients]);

  useEffect(() => { loadTeam(); }, [clinicId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clinic_packages')
        .select('id, name, price, package_type')
        .eq('clinic_id', clinicId)
        .eq('is_active', true)
        .order('name');
      setClinicPackagesList((data as any) || []);
    })();
  }, [clinicId]);

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

      {filteredMembers.length === 0 && members.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 italic">
          Nenhum colaborador encontrado para "{searchQuery}"
        </p>
      )}

      {/* ── Collaborators Grid (visual rico) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => {
          const displayName = member.profile?.name || member.email;
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
                      <DropdownMenuItem onClick={() => setRemunMember(member)}>
                        <DollarSign className="w-3.5 h-3.5 mr-2" />
                        Remuneração
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
                    onClick={e => { e.stopPropagation(); setAgendaMember(member); }}
                  >
                    <CalendarDays className="w-3 h-3" />
                    Gerenciar Agenda
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
            remuneration_plan_id: a.remuneration_plan_id ?? null,
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
          remuneration_type: inviteRemunerationType,
          remuneration_value: inviteRemunerationValue ? Number(inviteRemunerationValue) : null,
          weekdays: inviteWeekdays.length > 0 ? inviteWeekdays : null,
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
      setInviteRemunerationType('definir_depois');
      setInviteRemunerationValue('');
      setInviteWeekdays([]);
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
        remuneration_type: editRemunerationType,
        remuneration_value: editRemunerationType !== 'definir_depois' && editRemunerationValue
          ? Number(editRemunerationValue)
          : null,
        weekdays: editWeekdays.length > 0 ? editWeekdays : null,
        schedule_by_day: Object.keys(editScheduleByDay).length > 0 ? editScheduleByDay : null,
      }).eq('id', manageMember.id);
      if (updateError) throw updateError;

      toast.success('Configurações atualizadas');
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
    const currentPlans: Record<string, string> = {};
    member.assignments?.forEach(a => { current[a.patient_id] = a.schedule_time || ''; });
    member.assignments?.forEach(a => { if (a.remuneration_plan_id) currentPlans[a.patient_id] = a.remuneration_plan_id; });
    setEditPatients(current);
    setEditPatientPlans(currentPlans);
    setEditPermissions(
      member.permissions.length > 0
        ? [...member.permissions]
        : [...DEFAULT_THERAPIST_PERMISSIONS]
    );
    setEditRoleLabel(member.role_label || '');
    setEditRemunerationType((member.remuneration_type as any) || 'definir_depois');
    setEditRemunerationValue(member.remuneration_value != null ? String(member.remuneration_value) : '');
    setEditWeekdays(member.weekdays || []);
    setEditScheduleByDay((member as any).schedule_by_day || {});
    setManageMember(member);
    loadMemberPlans(member.id);
  }

  async function loadMemberPlans(memberId: string) {
    setLoadingPlans(true);
    try {
      const { data } = await supabase
        .from('member_remuneration_plans' as any)
        .select('*')
        .eq('member_id', memberId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      setMemberPlans((data as any) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPlans(false);
    }
  }

  async function addPlan() {
    if (!manageMember || !newPlanName.trim() || !newPlanValue) {
      toast.error('Preencha nome e valor do plano');
      return;
    }
    try {
      const isFirstPlan = memberPlans.length === 0;
      const { error } = await supabase.from('member_remuneration_plans' as any).insert({
        member_id: manageMember.id,
        name: newPlanName.trim(),
        remuneration_type: newPlanType,
        remuneration_value: Number(newPlanValue),
        is_default: isFirstPlan,
        package_id: newPlanType === 'pacote' && linkedPackageId ? linkedPackageId : null,
      });
      if (error) throw error;
      toast.success('Plano adicionado');
      setNewPlanName('');
      setNewPlanValue('');
      setNewPlanType('por_sessao');
      setLinkedPackageId('');
      await loadMemberPlans(manageMember.id);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar plano');
    }
  }

  async function deletePlan(planId: string) {
    if (!manageMember) return;
    try {
      const { error } = await supabase.from('member_remuneration_plans' as any).delete().eq('id', planId);
      if (error) throw error;
      toast.success('Plano removido');
      await loadMemberPlans(manageMember.id);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover plano');
    }
  }

  async function setPlanAsDefault(planId: string) {
    if (!manageMember) return;
    try {
      // Remove default from all and set on chosen
      await supabase.from('member_remuneration_plans' as any)
        .update({ is_default: false }).eq('member_id', manageMember.id);
      await supabase.from('member_remuneration_plans' as any)
        .update({ is_default: true }).eq('id', planId);
      await loadMemberPlans(manageMember.id);
    } catch (err: any) {
      toast.error('Erro ao definir padrão');
    }
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

  const WEEK_DAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
  const WEEK_LABELS: Record<string, string> = {
    segunda: 'Segunda', 'terça': 'Terça', quarta: 'Quarta', quinta: 'Quinta',
    sexta: 'Sexta', 'sábado': 'Sábado', domingo: 'Domingo',
  };

  const ScheduleSummaryView = (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <CalendarDays className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          Resumo dos dias de atendimento de cada terapeuta nesta clínica. Considera os
          <strong className="text-foreground"> dias declarados</strong> no cadastro do colaborador
          e os <strong className="text-foreground">pacientes vinculados</strong>.
        </div>
      </div>

      {activeMembers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum colaborador ativo nesta clínica.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {WEEK_DAYS.map(day => {
            const entries = scheduleByDay[day];
            return (
              <div key={day} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
                  <span className="font-semibold text-sm">{WEEK_LABELS[day]}</span>
                  <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
                </div>
                {entries.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-muted-foreground text-center">
                    Sem atendimentos
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {entries.map(({ member, patients }) => {
                      const name = member.profile?.name || member.email;
                      return (
                        <div key={member.id} className="px-4 py-3 flex items-start gap-3">
                          <Avatar className="w-8 h-8 shrink-0">
                            {member.profile?.avatar_url && <AvatarImage src={member.profile.avatar_url} />}
                            <AvatarFallback className={cn('text-xs text-white', getAvatarColor(name))}>
                              {getInitials(name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{name}</div>
                            {member.role_label && (
                              <div className="text-xs text-muted-foreground truncate">{member.role_label}</div>
                            )}
                            {patients.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {patients.map(p => (
                                  <span key={p.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[11px]">
                                    {p.patient_name || 'Paciente'}
                                    {p.schedule_time && <span className="opacity-70">· {p.schedule_time}</span>}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

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

      {/* Public application link + pending applications */}
      {canManage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TeamPublicLinkCard organizationId={organization.id} isOwnerOrAdmin={canManage} />
          <TeamApplicationsPanel organizationId={organization.id} canManage={canManage} />
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
          <Dialog open={inviteOpen} onOpenChange={open => { setInviteOpen(open); if (!open) { setInviteEmail(''); setInviteRoleLabel(''); setSelectedPatients({}); setInvitePreset('terapeuta'); setInviteRemunerationType('definir_depois'); setInviteRemunerationValue(''); setInviteWeekdays([]); } }}>
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

                  {/* Remuneration */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Remuneração</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Tipo</Label>
                        <Select value={inviteRemunerationType} onValueChange={(v: any) => setInviteRemunerationType(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="definir_depois">Definir depois</SelectItem>
                            <SelectItem value="por_sessao">Por sessão</SelectItem>
                            <SelectItem value="fixo_mensal">Fixo mensal</SelectItem>
                            <SelectItem value="fixo_dia">Fixo por dia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Valor (R$)</Label>
                        <Input
                          type="number" step="0.01" min="0"
                          placeholder="0,00"
                          value={inviteRemunerationValue}
                          onChange={e => setInviteRemunerationValue(e.target.value)}
                          disabled={inviteRemunerationType === 'definir_depois'}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Weekdays */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dias de atendimento <span className="font-normal normal-case">(opcional)</span></p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { v: 'seg', l: 'Seg' }, { v: 'ter', l: 'Ter' }, { v: 'qua', l: 'Qua' },
                        { v: 'qui', l: 'Qui' }, { v: 'sex', l: 'Sex' }, { v: 'sab', l: 'Sáb' }, { v: 'dom', l: 'Dom' },
                      ].map(d => {
                        const active = inviteWeekdays.includes(d.v);
                        return (
                          <button
                            key={d.v}
                            type="button"
                            onClick={() => setInviteWeekdays(prev => active ? prev.filter(x => x !== d.v) : [...prev, d.v])}
                            className={cn(
                              'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                              active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-card text-foreground border-border hover:border-primary/40'
                            )}
                          >
                            {d.l}
                          </button>
                        );
                      })}
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
                                <PatientScheduleField
                                  patient={patient}
                                  value={selectedPatients[patient.id]}
                                  onChange={(v) => setSelectedPatients(prev => ({ ...prev, [patient.id]: v }))}
                                />
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

      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-11 bg-muted/50 p-1 rounded-xl mb-6">
          <TabsTrigger value="members" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <Users className="w-4 h-4" />
            Equipe
          </TabsTrigger>
          <TabsTrigger value="schedule" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <CalendarDays className="w-4 h-4" />
            Resumo Semanal
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
        <TabsContent value="schedule">{ScheduleSummaryView}</TabsContent>
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

                  <Tabs defaultValue="profissional">
                    <TabsList className="w-full">
                      <TabsTrigger value="profissional" className="flex-1 gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        Profissional
                      </TabsTrigger>
                      <TabsTrigger value="permissions" className="flex-1 gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        Permissões
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="profissional" className="mt-4 space-y-4">
                      {/* Planos de Remuneração */}
                      <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-primary" />
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Planos de remuneração
                            </p>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {memberPlans.length} {memberPlans.length === 1 ? 'plano' : 'planos'}
                          </span>
                        </div>

                        {loadingPlans ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando planos…
                          </div>
                        ) : memberPlans.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            Nenhum plano cadastrado. Adicione abaixo as modalidades de pagamento (ex.: "Por Sessão R$ 80", "Pacote Mensal R$ 1.200").
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {memberPlans.map(plan => {
                              const typeLabel = plan.remuneration_type === 'por_sessao'
                                ? 'Por sessão'
                                : plan.remuneration_type === 'fixo_mensal'
                                  ? 'Fixo mensal'
                                  : plan.remuneration_type === 'pacote'
                                    ? 'Pacote'
                                    : 'Fixo por dia';
                              return (
                                <div
                                  key={plan.id}
                                  className="flex items-center gap-2 p-2 rounded-md border bg-card"
                                >
                                  <button
                                    type="button"
                                    onClick={() => !plan.is_default && setPlanAsDefault(plan.id)}
                                    title={plan.is_default ? 'Plano padrão' : 'Marcar como padrão'}
                                    className={cn(
                                      'shrink-0 p-1 rounded hover:bg-muted',
                                      plan.is_default ? 'text-primary' : 'text-muted-foreground/50'
                                    )}
                                  >
                                    <Star className={cn('w-3.5 h-3.5', plan.is_default && 'fill-current')} />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{plan.name}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {typeLabel} · R$ {Number(plan.remuneration_value).toFixed(2).replace('.', ',')}
                                    </p>
                                  </div>
                                  {plan.is_default && (
                                    <Badge variant="secondary" className="text-[10px] h-5">Padrão</Badge>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => deletePlan(plan.id)}
                                    disabled={plan.is_default && memberPlans.length > 1}
                                    title={plan.is_default && memberPlans.length > 1 ? 'Defina outro plano como padrão antes de excluir' : 'Excluir plano'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Form: novo plano */}
                        <div className="pt-2 border-t border-border/50 space-y-2">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                            Adicionar plano
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
                            <Input
                              placeholder="Nome (ex.: Plano Sessão Padrão)"
                              value={newPlanName}
                              onChange={e => setNewPlanName(e.target.value)}
                              className="h-8 text-sm"
                            />
                            <Select value={newPlanType} onValueChange={(v: any) => setNewPlanType(v)}>
                              <SelectTrigger className="h-8 text-sm w-full sm:w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="por_sessao">Por sessão</SelectItem>
                                <SelectItem value="fixo_mensal">Fixo mensal</SelectItem>
                                <SelectItem value="fixo_dia">Fixo por dia</SelectItem>
                                <SelectItem value="pacote">Pacote</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Valor R$"
                              value={newPlanValue}
                              onChange={e => setNewPlanValue(e.target.value)}
                              className="h-8 text-sm w-full sm:w-28"
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={addPlan}
                              className="h-8 gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Adicionar
                            </Button>
                          </div>
                          {newPlanType === 'pacote' && clinicPackagesList.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                Vincular a um pacote existente da clínica (opcional)
                              </p>
                              <Select
                                value={linkedPackageId || '__none__'}
                                onValueChange={(v) => {
                                  if (v === '__none__') {
                                    setLinkedPackageId('');
                                    return;
                                  }
                                  const pkg = clinicPackagesList.find(p => p.id === v);
                                  if (pkg) {
                                    setLinkedPackageId(v);
                                    setNewPlanName(pkg.name);
                                    setNewPlanValue(String(pkg.price));
                                  }
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Selecione um pacote para preencher automaticamente" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Não vincular (preencher manualmente)</SelectItem>
                                  {clinicPackagesList.map(pkg => (
                                    <SelectItem key={pkg.id} value={pkg.id}>
                                      {pkg.name} · R$ {Number(pkg.price).toFixed(2).replace('.', ',')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          {newPlanType === 'fixo_mensal' && (
                            <p className="text-[10px] text-muted-foreground italic">
                              Planos "Fixo mensal" são contados uma única vez no mês, mesmo se vinculados a vários pacientes.
                            </p>
                          )}
                          {newPlanType === 'pacote' && (
                            <p className="text-[10px] text-muted-foreground italic">
                              Planos "Pacote" cobram o valor uma vez por paciente que teve ao menos uma sessão no mês (ex.: pacote mensal independente do nº de sessões).
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Dias de atendimento */}
                      <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-primary" />
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Dias e horários de atendimento <span className="font-normal normal-case">(opcional)</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { v: 'seg', l: 'Seg' }, { v: 'ter', l: 'Ter' }, { v: 'qua', l: 'Qua' },
                            { v: 'qui', l: 'Qui' }, { v: 'sex', l: 'Sex' }, { v: 'sab', l: 'Sáb' }, { v: 'dom', l: 'Dom' },
                          ].map(d => {
                            const active = editWeekdays.includes(d.v);
                            return (
                              <button
                                key={d.v}
                                type="button"
                                onClick={() => {
                                  setEditWeekdays(prev => active ? prev.filter(x => x !== d.v) : [...prev, d.v]);
                                  if (active) {
                                    setEditScheduleByDay(prev => {
                                      const next = { ...prev };
                                      delete next[d.v];
                                      return next;
                                    });
                                  } else {
                                    setEditScheduleByDay(prev => ({
                                      ...prev,
                                      [d.v]: prev[d.v] || { start: '08:00', end: '18:00' },
                                    }));
                                  }
                                }}
                                className={cn(
                                  'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                                  active
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card text-foreground border-border hover:border-primary/40'
                                )}
                              >
                                {d.l}
                              </button>
                            );
                          })}
                        </div>
                        {editWeekdays.length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Horário de disponibilidade nesta clínica
                            </p>
                            {editWeekdays.map(d => {
                              const labels: Record<string, string> = {
                                seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta',
                                sex: 'Sexta', sab: 'Sábado', dom: 'Domingo',
                              };
                              const range = editScheduleByDay[d] || { start: '08:00', end: '18:00' };
                              return (
                                <div key={d} className="flex items-center gap-2 text-xs">
                                  <span className="w-20 text-muted-foreground">{labels[d] || d}</span>
                                  <Input
                                    type="time"
                                    value={range.start}
                                    onChange={e => setEditScheduleByDay(prev => ({
                                      ...prev,
                                      [d]: { ...range, start: e.target.value },
                                    }))}
                                    className="h-7 w-28 text-xs"
                                  />
                                  <span className="text-muted-foreground">até</span>
                                  <Input
                                    type="time"
                                    value={range.end}
                                    onChange={e => setEditScheduleByDay(prev => ({
                                      ...prev,
                                      [d]: { ...range, end: e.target.value },
                                    }))}
                                    className="h-7 w-28 text-xs"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="permissions" className="mt-4">
                      <p className="text-xs text-muted-foreground mb-4">
                        Controle exatamente o nível de acesso de cada módulo.
                      </p>
                      <PermissionEditor
                        permissions={editPermissions}
                        onChange={setEditPermissions}
                      />
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

      <TherapistAgendaModal
        open={!!agendaMember}
        onOpenChange={(v) => { if (!v) setAgendaMember(null); }}
        memberId={agendaMember?.id || null}
        memberName={agendaMember?.profile?.name || agendaMember?.email || ''}
        memberWeekdays={agendaMember?.weekdays || []}
        memberScheduleByDay={(agendaMember as any)?.schedule_by_day || null}
        clinicId={clinicId}
        organizationId={organization?.id || null}
      />

      <MemberRemunerationLinkModal
        open={!!remunMember}
        onOpenChange={(v) => { if (!v) setRemunMember(null); }}
        memberId={remunMember?.id || null}
        memberName={remunMember?.profile?.name || remunMember?.email || ''}
        clinicId={clinicId}
      />
    </div>
  );
}
