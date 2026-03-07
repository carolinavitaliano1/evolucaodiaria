import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { ClinicTeam } from '@/components/clinics/ClinicTeam';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Building2, ArrowLeft, Crown, Shield, User,
  CheckCircle2, Clock, Mail
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrgClinic {
  id: string;
  name: string;
  organization_id: string | null;
}

export default function Team() {
  const { user } = useAuth();
  const { clinics } = useApp();
  const navigate = useNavigate();
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  // Find clinics that have an org or belong to user
  const teamClinics = clinics.filter(c => !c.isArchived);

  // Auto-select first clinic
  useEffect(() => {
    if (!selectedClinicId && teamClinics.length > 0) {
      setSelectedClinicId(teamClinics[0].id);
    }
  }, [teamClinics]);

  const selectedClinic = teamClinics.find(c => c.id === selectedClinicId);

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
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-foreground text-lg leading-none">Gestão de Equipe</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Permissões, convites e controle de acesso</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-6">
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
            <p className="text-muted-foreground">Nenhuma clínica encontrada.</p>
            <Button variant="outline" onClick={() => navigate('/clinics')}>
              Ir para Clínicas
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
