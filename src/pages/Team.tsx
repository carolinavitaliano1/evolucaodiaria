import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { ClinicTeam } from '@/components/clinics/ClinicTeam';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { Button } from '@/components/ui/button';
import { 
  Users, Building2, ArrowLeft, UsersRound, Lock, Sparkles, Clock, Info
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const OWNER_EMAILS = ['carolinavitaliano1@gmail.com'];

export default function Team() {
  const { user } = useAuth();
  const { clinics } = useApp();
  const navigate = useNavigate();
  const { isOwner, loading: permLoading } = useOrgPermissions();
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  const isOwnerEmail = OWNER_EMAILS.includes(user?.email ?? '');
  const hasAccess = isOwnerEmail || isOwner;

  // Only "própria" clinics support team management
  const teamClinics = clinics.filter(c => !c.isArchived && c.type === 'propria');
  const contratanteClinics = clinics.filter(c => !c.isArchived && c.type === 'terceirizada');

  useEffect(() => {
    if (!selectedClinicId && teamClinics.length > 0) {
      setSelectedClinicId(teamClinics[0].id);
    }
  }, [teamClinics]);

  const selectedClinic = teamClinics.find(c => c.id === selectedClinicId);

  if (permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // --- Em breve screen for users without access ---
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
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

        {/* Coming soon content */}
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center space-y-8">
            {/* Icon */}
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

            {/* Badge */}
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20">
                <Clock className="w-4 h-4" />
                Em breve
              </span>
            </div>

            {/* Text */}
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-foreground">Plano Clínica</h2>
              <p className="text-muted-foreground leading-relaxed">
                A <strong>Gestão de Equipe</strong> é exclusiva do Plano Clínica — convide terapeutas, secretárias e administradores, defina permissões individuais e gerencie toda a sua equipe em um só lugar.
              </p>
            </div>

            {/* Feature list */}
            <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-3">
              {[
                { icon: UsersRound, text: 'Convide terapeutas e colaboradores' },
                { icon: Lock, text: 'Permissões granulares por módulo' },
                { icon: Sparkles, text: 'Cargos personalizados (secretária, financeiro…)' },
                { icon: Building2, text: 'Vincule pacientes a profissionais específicos' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Este plano estará disponível em breve. Fique atento às novidades!
              </p>
              <Button variant="outline" onClick={() => navigate('/pricing')} className="w-full">
                Ver Planos Individuais Disponíveis
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Full Team Management for owner ---
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
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
            <Sparkles className="w-3 h-3" />
            Plano Clínica
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-6">

        {/* Notice: Contratante clinics not supported */}
        {contratanteClinics.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-warning/10 border border-warning/30">
            <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-warning">Gestão de equipe disponível apenas para consultórios</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                As clínicas <strong className="text-foreground">{contratanteClinics.map(c => c.name).join(', ')}</strong> são do tipo <strong className="text-foreground">Contratante</strong> — locais onde você trabalha mas não é o responsável. Elas não aparecem aqui pois a equipe é gerenciada pela clínica contratante.
              </p>
            </div>
          </div>
        )}

        {/* Clinic selector */}
        {teamClinics.length > 1 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Selecionar Clínica</p>
            <div className="flex flex-wrap gap-2">
              {teamClinics.map(clinic => (
                <button
                  key={clinic.id}
                  onClick={() => setSelectedClinicId(clinic.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                    selectedClinicId === clinic.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {clinic.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Team component */}
        {selectedClinic ? (
          <div className="bg-card rounded-2xl border border-border p-5 lg:p-6">
            <ClinicTeam clinicId={selectedClinic.id} clinicName={selectedClinic.name} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              {contratanteClinics.length > 0 && teamClinics.length === 0
                ? 'Você não possui clínicas próprias cadastradas.'
                : 'Nenhuma clínica encontrada.'}
            </p>
            <Button variant="outline" onClick={() => navigate('/clinics')}>
              Ir para Clínicas
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
