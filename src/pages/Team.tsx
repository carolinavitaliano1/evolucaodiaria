import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { ClinicTeam } from '@/components/clinics/ClinicTeam';
import { ComplianceDashboard } from '@/components/clinics/ComplianceDashboard';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Users, Building2, ArrowLeft, UsersRound, Lock, Sparkles, Clock, Info,
  ClipboardCheck, UsersIcon, ArrowRight, CheckCircle2,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const OWNER_EMAILS = ['carolinavitaliano1@gmail.com'];

export default function Team() {
  const { user } = useAuth();
  const { clinics } = useApp();
  const navigate = useNavigate();
  const { isOwner, loading: permLoading } = useOrgPermissions();
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'team' | 'compliance'>('team');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [complianceBadge, setComplianceBadge] = useState(0);
  // clinicId → organizationId (null = no team)
  const [clinicOrgMap, setClinicOrgMap] = useState<Record<string, string | null>>({});
  const [loadingMap, setLoadingMap] = useState(true);

  // Confirm move dialog
  const [confirmMove, setConfirmMove] = useState<{ fromId: string; toId: string } | null>(null);
  const [moving, setMoving] = useState(false);

  const isOwnerEmail = OWNER_EMAILS.includes(user?.email ?? '');
  const hasAccess = isOwnerEmail || isOwner;

  const teamClinics = clinics.filter(c => !c.isArchived && c.type === 'propria');
  const contratanteClinics = clinics.filter(c => !c.isArchived && c.type === 'terceirizada');

  // Which clinic currently holds the team benefit
  const activeTeamClinicId = Object.entries(clinicOrgMap).find(([, orgId]) => !!orgId)?.[0] ?? null;

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
    // Auto-select: prefer the one with team, otherwise first
    const withTeam = (data || []).find(c => !!c.organization_id);
    const defaultId = withTeam?.id ?? teamClinics[0].id;
    setSelectedClinicId(prev => prev ?? defaultId);
    setLoadingMap(false);
  };

  useEffect(() => {
    if (teamClinics.length === 0) { setLoadingMap(false); return; }
    reloadOrgMap();
  }, [teamClinics.length]);

  // Sync orgId for the selected clinic
  useEffect(() => {
    if (!selectedClinicId) return;
    setOrganizationId(clinicOrgMap[selectedClinicId] ?? null);
  }, [selectedClinicId, clinicOrgMap]);

  // Handle switching team to a different clinic
  const handleClinicSelect = (clinicId: string) => {
    if (clinicId === selectedClinicId) return;
    // If there's an active team in a DIFFERENT clinic → ask for confirmation to move
    if (activeTeamClinicId && activeTeamClinicId !== clinicId) {
      setConfirmMove({ fromId: activeTeamClinicId, toId: clinicId });
    } else {
      setSelectedClinicId(clinicId);
    }
  };

  // Move team benefit from one clinic to another
  const moveTeamBenefit = async (fromClinicId: string, toClinicId: string) => {
    setMoving(true);
    try {
      // Get the org id from the source clinic
      const orgId = clinicOrgMap[fromClinicId];
      if (!orgId) throw new Error('Organização não encontrada');

      // Move: detach from old clinic, attach to new one
      await supabase.from('clinics').update({ organization_id: null }).eq('id', fromClinicId);
      await supabase.from('clinics').update({ organization_id: orgId }).eq('id', toClinicId);

      // Update local map
      setClinicOrgMap(prev => ({ ...prev, [fromClinicId]: null, [toClinicId]: orgId }));
      setSelectedClinicId(toClinicId);
      setOrganizationId(orgId);
      toast.success(`Benefício de equipe movido para "${teamClinics.find(c => c.id === toClinicId)?.name}"`);
    } catch (err) {
      toast.error('Erro ao mover benefício de equipe');
      console.error(err);
    } finally {
      setMoving(false);
      setConfirmMove(null);
    }
  };

  const selectedClinic = teamClinics.find(c => c.id === selectedClinicId);

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

  const fromClinic = confirmMove ? teamClinics.find(c => c.id === confirmMove.fromId) : null;
  const toClinic = confirmMove ? teamClinics.find(c => c.id === confirmMove.toId) : null;

  return (
    <div className="min-h-screen bg-background">
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

        {/* Clinic selector — always shown when there are propria clinics */}
        {teamClinics.length > 0 && (
          <div>
            {teamClinics.length > 1 && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Selecionar Clínica para Equipe
              </p>
            )}

            {/* Info: benefit scoped to 1 clinic */}
            {teamClinics.length > 1 && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 mb-4">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">
                  O benefício de equipe é ativo em <strong>apenas uma clínica</strong> por vez.
                  {activeTeamClinicId
                    ? ' Clique em outra clínica para mover o benefício.'
                    : ' Selecione abaixo qual clínica usará este recurso.'}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {teamClinics.map(clinic => {
                const hasTeam = !!clinicOrgMap[clinic.id];
                const isSelected = selectedClinicId === clinic.id;

                return (
                  <button
                    key={clinic.id}
                    onClick={() => handleClinicSelect(clinic.id)}
                    className={cn(
                      'flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                      isSelected && hasTeam
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : isSelected && !hasTeam
                        ? 'bg-primary/10 text-primary border-primary/40'
                        : hasTeam
                        ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                        : 'bg-card text-foreground border-border hover:border-primary/40 hover:bg-primary/5'
                    )}
                  >
                    {hasTeam
                      ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                      : <Building2 className="w-4 h-4 shrink-0" />
                    }
                    <span>{clinic.name}</span>
                    {hasTeam && !isSelected && (
                      <span className="ml-1 text-[10px] font-semibold opacity-80">Equipe ativa</span>
                    )}
                    {hasTeam && isSelected && (
                      <span className="ml-1 text-[10px] font-semibold opacity-90">Ativa aqui</span>
                    )}
                    {!hasTeam && activeTeamClinicId && isSelected && (
                      <span className="ml-1 text-[10px] text-primary/70">Clique para mover</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab switcher */}
        {selectedClinic && (
          <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('team')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === 'team' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <UsersIcon className="w-4 h-4" />Equipe
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
          </div>
        )}

        {/* Content */}
        {selectedClinic ? (
          <div className="bg-card rounded-2xl border border-border p-5 lg:p-6">
            {activeTab === 'team' && (
              <ClinicTeam
                clinicId={selectedClinic.id}
                clinicName={selectedClinic.name}
                onTeamCreated={reloadOrgMap}
              />
            )}
            {activeTab === 'compliance' && organizationId && (
              <ComplianceDashboard
                clinicId={selectedClinic.id}
                organizationId={organizationId}
                onTodayPendingCount={setComplianceBadge}
              />
            )}
            {activeTab === 'compliance' && !organizationId && (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <ClipboardCheck className="w-10 h-10 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  Ative a gestão de equipe primeiro para usar o painel de conformidade.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              {contratanteClinics.length > 0 && teamClinics.length === 0
                ? 'Você não possui consultórios cadastrados.'
                : 'Nenhuma clínica encontrada.'}
            </p>
            <Button variant="outline" onClick={() => navigate('/clinics')}>Ir para Clínicas</Button>
          </div>
        )}
      </div>

      {/* Confirm move dialog */}
      <AlertDialog open={!!confirmMove} onOpenChange={open => !open && setConfirmMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover benefício de equipe?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Você está movendo o benefício de equipe de:</p>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{fromClinic?.name}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-primary truncate">{toClinic?.name}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  A equipe (membros, permissões e vínculos de pacientes) permanece intacta — apenas o consultório associado muda. Os colaboradores continuarão com acesso.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={moving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={moving}
              onClick={() => confirmMove && moveTeamBenefit(confirmMove.fromId, confirmMove.toId)}
            >
              {moving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Movendo...</> : 'Confirmar Mudança'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
