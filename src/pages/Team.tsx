import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { ClinicTeam } from '@/components/clinics/ClinicTeam';
import { ComplianceDashboard } from '@/components/clinics/ComplianceDashboard';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Users, Building2, ArrowLeft, UsersRound, Lock, Sparkles, Clock, Info,
  ClipboardCheck, CheckCircle2, ChevronRight, Activity, CalendarDays,
  UserCircle, FileText, AlertCircle, DollarSign,
} from 'lucide-react';
import { TeamFinancialDashboard } from '@/components/clinics/TeamFinancialDashboard';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface ActivityEntry {
  id: string;
  created_at: string;
  date: string;
  attendance_status: string;
  patient_name: string | null;
  member_name: string | null;
  member_email: string;
  member_role: string;
  member_role_label: string | null;
}

const OWNER_EMAILS = ['carolinavitaliano1@gmail.com'];

export default function Team() {
  const { user } = useAuth();
  const { clinics } = useApp();
  const navigate = useNavigate();
  const { isOwner, loading: permLoading } = useOrgPermissions();

  const [activeTab, setActiveTab] = useState<'team' | 'compliance' | 'activity' | 'financial'>('team');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [complianceBadge, setComplianceBadge] = useState(0);
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [clinicOrgMap, setClinicOrgMap] = useState<Record<string, string | null>>({});
  const [loadingMap, setLoadingMap] = useState(true);

  // Activation modal (State A)
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [activatingClinicId, setActivatingClinicId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  // Swap clinic dialog (State B → choose new clinic)
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [swapTargetClinicId, setSwapTargetClinicId] = useState<string | null>(null);
  const [confirmSwapOpen, setConfirmSwapOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);

  const isOwnerEmail = OWNER_EMAILS.includes(user?.email ?? '');
  const hasAccess = isOwnerEmail || isOwner;

  const teamClinics = clinics.filter(c => !c.isArchived && c.type === 'propria');
  const contratanteClinics = clinics.filter(c => !c.isArchived && c.type === 'terceirizada');

  // The one clinic that currently holds the team benefit
  const activeTeamClinicId = Object.entries(clinicOrgMap).find(([, orgId]) => !!orgId)?.[0] ?? null;
  const activeClinic = teamClinics.find(c => c.id === activeTeamClinicId) ?? null;

  const reloadOrgMap = async () => {
    if (teamClinics.length === 0) { setLoadingMap(false); return; }
    setLoadingMap(true);
    const { data } = await supabase
      .from('clinics')
      .select('id, organization_id')
      .in('id', teamClinics.map(c => c.id));
    const map: Record<string, string | null> = {};
    (data || []).forEach(c => { map[c.id] = c.organization_id ?? null; });
    setClinicOrgMap(map);
    const withTeam = (data || []).find(c => !!c.organization_id);
    if (withTeam) setOrganizationId(withTeam.organization_id);
    setLoadingMap(false);
  };

  const loadActivity = useCallback(async (orgId: string, clinicId: string) => {
    setLoadingActivity(true);
    try {
      // Get active members of this org
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, email, role, role_label')
        .eq('organization_id', orgId)
        .eq('status', 'active');

      if (!members || members.length === 0) { setActivityEntries([]); return; }

      // Get member profiles for names
      const memberUserIds = members.map(m => m.user_id).filter(Boolean) as string[];
      const { data: profiles } = memberUserIds.length > 0
        ? await supabase.from('profiles').select('user_id, name').in('user_id', memberUserIds)
        : { data: [] };

      // Get recent evolutions in this clinic by org members
      const { data: evolutions } = await supabase
        .from('evolutions')
        .select('id, created_at, date, attendance_status, patient_id, user_id')
        .eq('clinic_id', clinicId)
        .in('user_id', memberUserIds)
        .order('created_at', { ascending: false })
        .limit(60);

      if (!evolutions || evolutions.length === 0) { setActivityEntries([]); return; }

      // Get patient names
      const patientIds = [...new Set(evolutions.map(e => e.patient_id))];
      const { data: patientData } = await supabase
        .from('patients')
        .select('id, name')
        .in('id', patientIds);

      const patientMap = Object.fromEntries((patientData || []).map(p => [p.id, p.name]));
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p.name]));
      const memberMap = Object.fromEntries(members.map(m => [m.user_id, m]));

      const entries: ActivityEntry[] = evolutions.map(ev => {
        const member = memberMap[ev.user_id];
        return {
          id: ev.id,
          created_at: ev.created_at,
          date: ev.date,
          attendance_status: ev.attendance_status,
          patient_name: patientMap[ev.patient_id] ?? null,
          member_name: profileMap[ev.user_id] ?? null,
          member_email: member?.email ?? '',
          member_role: member?.role ?? 'professional',
          member_role_label: member?.role_label ?? null,
        };
      });

      setActivityEntries(entries);
    } catch (err) {
      console.error('loadActivity error', err);
    } finally {
      setLoadingActivity(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'activity' && organizationId && activeTeamClinicId) {
      loadActivity(organizationId, activeTeamClinicId);
    }
  }, [activeTab, organizationId, activeTeamClinicId]);

  useEffect(() => {
    if (teamClinics.length === 0) { setLoadingMap(false); return; }
    reloadOrgMap();
  }, [teamClinics.length]);

  // State A: Activate team on selected clinic (create new org)
  const handleActivate = async () => {
    if (!activatingClinicId || !user) return;
    setActivating(true);
    try {
      const clinic = teamClinics.find(c => c.id === activatingClinicId);
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: clinic?.name ?? 'Minha Clínica', owner_id: user.id })
        .select('id')
        .single();
      if (orgErr) throw orgErr;
      await supabase.from('clinics').update({ organization_id: org.id }).eq('id', activatingClinicId);
      toast.success(`Gestão de equipe ativada em "${clinic?.name}"!`);
      setActivateDialogOpen(false);
      await reloadOrgMap();
    } catch (err) {
      toast.error('Erro ao ativar gestão de equipe');
      console.error(err);
    } finally {
      setActivating(false);
    }
  };

  // State B: Swap — old team stays orphaned, new org for new clinic
  const handleSwap = async () => {
    if (!swapTargetClinicId || !activeTeamClinicId || !user) return;
    setSwapping(true);
    try {
      // Detach old clinic (org becomes orphaned/archived)
      await supabase.from('clinics').update({ organization_id: null }).eq('id', activeTeamClinicId);

      // Create a NEW org for the new clinic (fresh start)
      const newClinic = teamClinics.find(c => c.id === swapTargetClinicId);
      const { data: newOrg, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: newClinic?.name ?? 'Minha Clínica', owner_id: user.id })
        .select('id')
        .single();
      if (orgErr) throw orgErr;
      await supabase.from('clinics').update({ organization_id: newOrg.id }).eq('id', swapTargetClinicId);

      toast.success(`Equipe ativada em "${newClinic?.name}". A equipe anterior foi arquivada.`);
      setConfirmSwapOpen(false);
      setSwapDialogOpen(false);
      setSwapTargetClinicId(null);
      await reloadOrgMap();
    } catch (err) {
      toast.error('Erro ao trocar consultório da equipe');
      console.error(err);
    } finally {
      setSwapping(false);
    }
  };

  if (permLoading || loadingMap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- Em breve screen ---
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />Voltar
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <UsersRound className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-foreground text-lg leading-none">Gestão de Equipe</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Plano Clínica</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center space-y-8">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-28 h-28 rounded-3xl bg-primary/10 flex items-center justify-center">
                  <UsersRound className="w-14 h-14 text-primary/60" />
                </div>
                <div className="absolute -top-2 -right-2 w-10 h-10 rounded-xl bg-card border-2 border-border flex items-center justify-center shadow-sm">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
                <Clock className="w-4 h-4" />Em breve
              </span>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-foreground">Plano Clínica</h2>
              <p className="text-muted-foreground leading-relaxed">
                A <strong>Gestão de Equipe</strong> é exclusiva do Plano Clínica — convide terapeutas, secretárias e administradores, defina permissões individuais e gerencie toda a sua equipe em um só lugar.
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-3">
              {[
                { icon: UsersRound, text: 'Convide terapeutas e colaboradores' },
                { icon: Lock, text: 'Permissões granulares por módulo' },
                { icon: Sparkles, text: 'Cargos personalizados (secretária, financeiro…)' },
                { icon: Building2, text: 'Vincule pacientes a profissionais específicos' },
                { icon: ClipboardCheck, text: 'Painel de conformidade de evoluções' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{text}</span>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => navigate('/pricing')} className="w-full">
              Ver Planos Individuais Disponíveis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── STATE A: No team active yet ──────────────────────────────────
  if (!activeTeamClinicId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />Voltar
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <UsersRound className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-foreground text-lg leading-none">Gestão de Equipe</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Permissões, convites e controle de acesso</p>
              </div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <Sparkles className="w-3 h-3" />Plano Clínica
            </span>
          </div>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-sm w-full text-center space-y-6">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
              <UsersRound className="w-12 h-12 text-primary/60" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Ativar Gestão de Equipe</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Selecione o consultório onde a equipe será gerenciada. O benefício pode ser usado em <strong>um consultório por vez</strong>.
              </p>
            </div>

            {teamClinics.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Você não possui consultórios cadastrados.</p>
                <Button variant="outline" onClick={() => navigate('/clinics')}>
                  Cadastrar Consultório
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setActivatingClinicId(teamClinics.length === 1 ? teamClinics[0].id : null);
                  setActivateDialogOpen(true);
                }}
                className="gap-2 w-full"
              >
                <Building2 className="w-4 h-4" />
                Selecionar Consultório
              </Button>
            )}
          </div>
        </div>

        {/* Activation modal */}
        <Dialog open={activateDialogOpen} onOpenChange={open => { if (!activating) setActivateDialogOpen(open); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UsersRound className="w-5 h-5 text-primary" />
                Selecionar Consultório para a Equipe
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escolha qual consultório usará a Gestão de Equipe. Você poderá trocar depois, mas os dados da equipe não serão transferidos.
              </p>
              <div className="space-y-2">
                {teamClinics.map(clinic => (
                  <button
                    key={clinic.id}
                    onClick={() => setActivatingClinicId(clinic.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                      activatingClinicId === clinic.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-accent'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      activatingClinicId === clinic.id ? 'bg-primary/20' : 'bg-muted'
                    )}>
                      {activatingClinicId === clinic.id
                        ? <CheckCircle2 className="w-4 h-4 text-primary" />
                        : <Building2 className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                    <span className="font-medium text-sm">{clinic.name}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setActivateDialogOpen(false)} disabled={activating}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={!activatingClinicId || activating}
                  onClick={handleActivate}
                >
                  {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UsersRound className="w-4 h-4" />}
                  Ativar Equipe
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── STATE B: Team is active ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />Voltar
          </Button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <UsersRound className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-foreground text-lg leading-none truncate">Gestão de Equipe</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground truncate">{activeClinic?.name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {teamClinics.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setSwapDialogOpen(true)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
                Trocar consultório
              </Button>
            )}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <Sparkles className="w-3 h-3" />Plano Clínica
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        {/* Contratante notice */}
        {contratanteClinics.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-warning/10 border border-warning/30">
            <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-warning">Gestão de equipe disponível apenas para consultórios</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                As clínicas <strong className="text-foreground">{contratanteClinics.map(c => c.name).join(', ')}</strong> são do tipo <strong className="text-foreground">Contratante</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('team')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'team' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <UsersRound className="w-4 h-4" />Equipe
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'compliance' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <ClipboardCheck className="w-4 h-4" />Conformidade
            {complianceBadge > 0 && (
              <span className="w-4 h-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                {complianceBadge > 9 ? '9+' : complianceBadge}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === 'activity' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Activity className="w-4 h-4" />Atividade
          </button>
        </div>

        {/* Content */}
        <div className="bg-card rounded-2xl border border-border p-5 lg:p-6">
          {activeTab === 'team' && (
            <ClinicTeam
              clinicId={activeTeamClinicId}
              clinicName={activeClinic?.name}
              onTeamCreated={reloadOrgMap}
            />
          )}
          {activeTab === 'compliance' && organizationId && (
            <ComplianceDashboard
              clinicId={activeTeamClinicId}
              organizationId={organizationId}
              onTodayPendingCount={setComplianceBadge}
            />
          )}
          {activeTab === 'compliance' && !organizationId && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <ClipboardCheck className="w-10 h-10 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">Carregando dados de conformidade...</p>
            </div>
          )}

          {/* Activity Timeline */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Atividade da Equipe
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Últimas evoluções registradas pelos membros</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => organizationId && activeTeamClinicId && loadActivity(organizationId, activeTeamClinicId)}
                  disabled={loadingActivity}
                >
                  {loadingActivity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                  Atualizar
                </Button>
              </div>

              {loadingActivity ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : activityEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Nenhuma evolução registrada pela equipe ainda.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[520px]">
                  <div className="relative pl-4">
                    {/* Timeline line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                    <div className="space-y-1">
                      {activityEntries.map((entry, idx) => {
                        const prevEntry = activityEntries[idx - 1];
                        const showDateSep = idx === 0 || entry.date !== prevEntry?.date;
                        const statusColors: Record<string, string> = {
                          presente: 'text-success',
                          falta: 'text-destructive',
                          falta_justificada: 'text-warning',
                        };
                        const statusLabels: Record<string, string> = {
                          presente: 'Presente',
                          falta: 'Falta',
                          falta_justificada: 'Falta Justificada',
                        };
                        const memberInitials = (entry.member_name || entry.member_email)
                          .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                        return (
                          <div key={entry.id}>
                            {showDateSep && (
                              <div className="flex items-center gap-2 py-3">
                                <div className="w-3.5 h-3.5 rounded-full bg-muted border-2 border-border relative z-10 shrink-0 -ml-[3px]" />
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  {format(parseISO(entry.date), "dd 'de' MMMM", { locale: ptBR })}
                                </span>
                              </div>
                            )}
                            <div className="flex items-start gap-3 py-2">
                              {/* Dot */}
                              <div className={cn(
                                'w-2 h-2 rounded-full mt-2 relative z-10 shrink-0 -ml-[1px]',
                                entry.attendance_status === 'presente' ? 'bg-success' :
                                entry.attendance_status === 'falta' ? 'bg-destructive' : 'bg-warning'
                              )} />
                              <div className="flex-1 min-w-0 bg-secondary/40 rounded-xl px-3 py-2.5 hover:bg-secondary/70 transition-colors">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {/* Member avatar */}
                                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                      <span className="text-[9px] font-bold text-primary">{memberInitials}</span>
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-xs font-semibold text-foreground truncate block">
                                        {entry.member_name || entry.member_email.split('@')[0]}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {entry.member_role_label || (entry.member_role === 'admin' ? 'Admin' : 'Profissional')}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Badge
                                      variant="outline"
                                      className={cn('text-[10px] px-1.5 py-0 h-5 border-0 font-medium', statusColors[entry.attendance_status] ?? 'text-muted-foreground', 'bg-transparent')}
                                    >
                                      {statusLabels[entry.attendance_status] ?? entry.attendance_status}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      {formatDistanceToNow(parseISO(entry.created_at), { locale: ptBR, addSuffix: true })}
                                    </span>
                                  </div>
                                </div>
                                {entry.patient_name && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <UserCircle className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{entry.patient_name}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Swap Clinic Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={open => { if (!swapping) setSwapDialogOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Trocar Consultório da Equipe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <Info className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">
                Ao trocar de consultório, a equipe atual (membros, convites e permissões) será <strong>arquivada</strong> e o novo consultório começará do zero.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Selecione o consultório que passará a usar a Gestão de Equipe:</p>
            <div className="space-y-2">
              {teamClinics.filter(c => c.id !== activeTeamClinicId).map(clinic => (
                <button
                  key={clinic.id}
                  onClick={() => setSwapTargetClinicId(clinic.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all',
                    swapTargetClinicId === clinic.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-accent'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    swapTargetClinicId === clinic.id ? 'bg-primary/20' : 'bg-muted'
                  )}>
                    {swapTargetClinicId === clinic.id
                      ? <CheckCircle2 className="w-4 h-4 text-primary" />
                      : <Building2 className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                  <span className="font-medium text-sm text-foreground">{clinic.name}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setSwapDialogOpen(false); setSwapTargetClinicId(null); }}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                disabled={!swapTargetClinicId}
                onClick={() => setConfirmSwapOpen(true)}
              >
                <ChevronRight className="w-4 h-4" />
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Final confirm swap */}
      <AlertDialog open={confirmSwapOpen} onOpenChange={open => { if (!swapping) setConfirmSwapOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar troca de consultório?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>A equipe atual em <strong>{activeClinic?.name}</strong> será <strong>arquivada</strong> e não poderá ser recuperada.</p>
                <p>O consultório <strong>{teamClinics.find(c => c.id === swapTargetClinicId)?.name}</strong> começará com uma equipe nova.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={swapping}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={swapping}
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleSwap}
            >
              {swapping ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Trocando...</> : 'Confirmar Troca'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
