import { useState, useMemo, useEffect } from 'react';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicOrg, OrgMemberProfile } from '@/hooks/useClinicOrg';
import { useOrgPermissions, hasPermission } from '@/hooks/useOrgPermissions';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Download, FileText, User, CheckCircle2, XCircle, AlertCircle, Lock, Sparkles } from 'lucide-react';
import { FeedbackIAModal } from '@/components/evolutions/FeedbackIAModal';
import { BulkDayFeedbackModal } from '@/components/evolutions/BulkDayFeedbackModal';
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
  const { isOrgMember, isOwner, permissions } = useOrgPermissions();
  const { isOrg, members } = useClinicOrg(clinicId);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [stamps, setStamps] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingPatientId, setExportingPatientId] = useState<string | null>(null);
  const [filterUserId, setFilterUserId] = useState<string>('all');
  const [feedbackItem, setFeedbackItem] = useState<{ evolution: any; patient: any } | null>(null);
  const [feedbackDayOpen, setFeedbackDayOpen] = useState(false);

  // Status-only: can see if evolution exists but not read its content
  const canViewContent = !isOrgMember || isOwner || hasPermission(permissions, 'evolutions.view');
  const canSeeStatus = canViewContent || hasPermission(permissions, 'evolutions.status_only');
  // Therapists with `evolutions.own_only` are forced to see only their own evolutions
  // (the user-filter selector is also disabled below).
  const restrictToOwn = isOrgMember && !isOwner && hasPermission(permissions, 'evolutions.own_only');
  const effectiveFilterUserId = restrictToOwn ? (user?.id || 'all') : filterUserId;

  useEffect(() => {
    if (!user) return;
    supabase.from('stamps').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) setStamps(data);
    });
  }, [user]);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const clinicPatients = useMemo(() => patients.filter(p => p.clinicId === clinicId && isPatientActiveOn(p)), [patients, clinicId]);

  const dayEvolutions = useMemo(() => {
    return evolutions.filter(e =>
      e.clinicId === clinicId &&
      e.date === dateStr &&
      (effectiveFilterUserId === 'all'
        || (e as any).user_id === effectiveFilterUserId
        || (e as any).userId === effectiveFilterUserId)
    );
  }, [evolutions, clinicId, dateStr, effectiveFilterUserId]);

  const evolutionsByPatient = useMemo(() => {
    return dayEvolutions.map(evo => {
      const patient = clinicPatients.find(p => p.id === evo.patientId);
      return { evo, patient };
    }).filter(({ patient }) => !!patient);
  }, [dayEvolutions, clinicPatients]);

  const memberLabel = (userId: string) => {
    const m = members.find(m => m.userId === userId);
    return m?.name || m?.email || 'Profissional';
  };

  const handleExportAll = async () => {
    if (evolutionsByPatient.length === 0) { toast.error('Nenhuma evolução neste dia para exportar'); return; }
    setIsExporting(true);
    try {
      for (const { evo, patient } of evolutionsByPatient) {
        if (!patient) continue;
        await generateMultipleEvolutionsPdf({ evolutions: [evo], patient, clinic, stamps });
      }
      toast.success(`${evolutionsByPatient.length} PDF(s) exportados com sucesso!`);
    } catch (e) {
      toast.error('Erro ao exportar PDFs');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSingle = async (evo: Evolution, patient: Patient) => {
    setExportingPatientId(patient.id);
    try {
      await generateMultipleEvolutionsPdf({ evolutions: [evo], patient, clinic, stamps });
      toast.success('PDF exportado!');
    } catch (e) {
      toast.error('Erro ao exportar PDF');
    } finally {
      setExportingPatientId(null);
    }
  };

  const handleExportAllInOne = async () => {
    if (evolutionsByPatient.length === 0) { toast.error('Nenhuma evolução neste dia para exportar'); return; }
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
      toast.error('Erro ao exportar');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
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

          <div className="flex flex-wrap items-center gap-2">
            {/* Professional filter */}
            {isOrg && members.length > 1 && (
              <Select
                value={effectiveFilterUserId}
                onValueChange={setFilterUserId}
                disabled={restrictToOwn}
              >
                <SelectTrigger
                  className="h-8 text-sm w-auto min-w-[150px]"
                  title={restrictToOwn ? 'Você só pode ver suas próprias evoluções' : undefined}
                >
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name || m.email}{m.userId === user?.id ? ' (você)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Date Picker */}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('gap-2 justify-start h-8 text-sm', !selectedDate && 'text-muted-foreground')}>
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

            {evolutionsByPatient.length > 0 && canViewContent && (
              <>
                <Button onClick={handleExportAllInOne} disabled={isExporting} className="gap-2 gradient-primary" size="sm">
                  <Download className="w-4 h-4" />
                  {isExporting ? 'Exportando...' : 'Exportar Todos'}
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
                  onClick={() => setFeedbackDayOpen(true)}>
                  <Sparkles className="w-4 h-4" /> Feedback IA
                </Button>
              </>
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
            const evoAuthorId = (evo as any).user_id;
            const showAuthor = isOrg && evoAuthorId && filterUserId === 'all';

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
                        {showAuthor && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            {memberLabel(evoAuthorId)}
                          </span>
                        )}
                      </div>
                      {canViewContent && patient.clinicalArea && (
                        <p className="text-xs text-muted-foreground mt-0.5">{patient.clinicalArea}</p>
                      )}
                      {canViewContent && evo.text && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">
                          {evo.text}
                        </p>
                      )}
                      {canViewContent && evo.templateData && !evo.text && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Evolução por modelo</p>
                      )}
                      {!canViewContent && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 italic">
                          <Lock className="w-3 h-3" /> Conteúdo clínico restrito
                        </p>
                      )}
                    </div>
                  </div>
                  {canViewContent && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" title="Feedback IA para os pais"
                        onClick={() => setFeedbackItem({ evolution: evo, patient })}>
                        <Sparkles className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 flex-shrink-0 h-7 text-xs"
                        onClick={() => handleExportSingle(evo, patient)}
                        disabled={isExportingThis}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {isExportingThis ? '...' : 'PDF'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* Feedback IA — individual card */}
    {feedbackItem && (
      <FeedbackIAModal
        open={!!feedbackItem}
        onOpenChange={(v) => !v && setFeedbackItem(null)}
        evolutions={[feedbackItem.evolution]}
        patientId={feedbackItem.patient.id}
        patientName={feedbackItem.patient.name}
        patientWhatsapp={feedbackItem.patient.whatsapp}
        responsibleWhatsapp={feedbackItem.patient.responsibleWhatsapp}
        clinicalArea={feedbackItem.patient.clinicalArea}
        isBulk={false}
      />
    )}

    {/* Feedback IA — por paciente do dia selecionado */}
    <BulkDayFeedbackModal
      open={feedbackDayOpen}
      onOpenChange={setFeedbackDayOpen}
      items={evolutionsByPatient.filter(({ patient }) => !!patient) as { evo: Evolution; patient: Patient }[]}
      selectedDate={selectedDate}
    />
    </>
  );
}
