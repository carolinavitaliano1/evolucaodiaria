import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Download, FileText, User, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { generateMultipleEvolutionsPdf, generateAllPatientsPdf } from '@/utils/generateEvolutionPdf';
import { Clinic, Evolution, Patient } from '@/types';

interface Props {
  clinicId: string;
  clinic?: Clinic;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  presente: { label: 'Presente', color: 'bg-success/10 text-success border-success/20', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  falta: { label: 'Falta', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: <XCircle className="w-3.5 h-3.5" /> },
  falta_remunerada: { label: 'Falta Rem.', color: 'bg-warning/10 text-warning border-warning/20', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  reposicao: { label: 'Reposição', color: 'bg-primary/10 text-primary border-primary/20', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  feriado_remunerado: { label: 'Feriado Rem.', color: 'bg-primary/10 text-primary border-primary/20', icon: '🎉' },
  feriado_nao_remunerado: { label: 'Feriado', color: 'bg-muted text-muted-foreground border-border', icon: '📅' },
};

export function ClinicEvolutionsTab({ clinicId, clinic }: Props) {
  const { patients, evolutions } = useApp();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [stamps, setStamps] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingPatientId, setExportingPatientId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('stamps').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) setStamps(data);
    });
  }, [user]);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const clinicPatients = useMemo(() => patients.filter(p => p.clinicId === clinicId && !p.isArchived), [patients, clinicId]);

  const dayEvolutions = useMemo(() => {
    return evolutions.filter(e => e.clinicId === clinicId && e.date === dateStr);
  }, [evolutions, clinicId, dateStr]);

  // Group evolutions by patient
  const evolutionsByPatient = useMemo(() => {
    return dayEvolutions.map(evo => {
      const patient = clinicPatients.find(p => p.id === evo.patientId);
      return { evo, patient };
    }).filter(({ patient }) => !!patient);
  }, [dayEvolutions, clinicPatients]);

  const handleExportAll = async () => {
    if (evolutionsByPatient.length === 0) {
      toast.error('Nenhuma evolução neste dia para exportar');
      return;
    }
    setIsExporting(true);
    try {
      // Export each patient's evolution as separate PDF
      for (const { evo, patient } of evolutionsByPatient) {
        if (!patient) continue;
        await generateMultipleEvolutionsPdf({
          evolutions: [evo],
          patient,
          clinic,
          stamps,
        });
      }
      toast.success(`${evolutionsByPatient.length} PDF(s) exportados com sucesso!`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao exportar PDFs');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSingle = async (evo: Evolution, patient: Patient) => {
    setExportingPatientId(patient.id);
    try {
      await generateMultipleEvolutionsPdf({
        evolutions: [evo],
        patient,
        clinic,
        stamps,
      });
      toast.success('PDF exportado!');
    } catch (e) {
      toast.error('Erro ao exportar PDF');
    } finally {
      setExportingPatientId(null);
    }
  };

  const handleExportAllInOne = async () => {
    if (evolutionsByPatient.length === 0) {
      toast.error('Nenhuma evolução neste dia para exportar');
      return;
    }
    setIsExporting(true);
    try {
      await generateAllPatientsPdf({
        items: evolutionsByPatient.filter(({ patient }) => !!patient).map(({ evo, patient }) => ({ evolution: evo, patient: patient! })),
        clinic,
        date: selectedDate,
        stamps,
      });
      toast.success('PDF exportado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao exportar');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card rounded-2xl p-4 lg:p-6 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Evoluções do Dia
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {evolutionsByPatient.length === 0
                ? 'Nenhuma evolução registrada neste dia'
                : `${evolutionsByPatient.length} evolução(ões) registrada(s)`}
            </p>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-2">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('gap-2 justify-start', !selectedDate && 'text-muted-foreground')}>
                  <CalendarIcon className="w-4 h-4" />
                  {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => { if (d) { setSelectedDate(d); setCalendarOpen(false); } }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            {evolutionsByPatient.length > 0 && (
              <Button
                onClick={handleExportAllInOne}
                disabled={isExporting}
                className="gap-2 gradient-primary"
                size="sm"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exportando...' : 'Exportar Todos'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Evolutions List */}
      {evolutionsByPatient.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 border border-border text-center">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-muted-foreground font-medium">Nenhuma evolução registrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {evolutionsByPatient.map(({ evo, patient }) => {
            if (!patient) return null;
            const statusCfg = STATUS_CONFIG[evo.attendanceStatus] || STATUS_CONFIG.presente;
            const isExportingThis = exportingPatientId === patient.id;

            return (
              <div key={evo.id} className="bg-card rounded-2xl p-4 lg:p-5 border border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{patient.name}</p>
                        <Badge variant="outline" className={cn('text-xs gap-1 flex items-center', statusCfg.color)}>
                          {typeof statusCfg.icon === 'string' ? statusCfg.icon : statusCfg.icon}
                          {statusCfg.label}
                        </Badge>
                      </div>
                      {patient.clinicalArea && (
                        <p className="text-xs text-muted-foreground mt-0.5">{patient.clinicalArea}</p>
                      )}
                      {evo.text && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">
                          {evo.text}
                        </p>
                      )}
                      {evo.templateData && !evo.text && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Evolução por modelo</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 flex-shrink-0"
                    onClick={() => handleExportSingle(evo, patient)}
                    disabled={isExportingThis}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isExportingThis ? '...' : 'PDF'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
