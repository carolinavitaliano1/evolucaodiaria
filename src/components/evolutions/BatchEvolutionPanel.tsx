import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Check, X, DollarSign, FileText, Loader2, Search, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AIUpgradeDialog } from '@/components/AIUpgradeDialog';
import { Clinic, Evolution, EvolutionTemplate } from '@/types';

interface Props {
  clinic: Clinic;
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function BatchEvolutionPanel({ clinic }: Props) {
  const { patients, evolutions, addEvolution } = useApp();
  const { user } = useAuth();
  const { hasAI } = useFeatureAccess();

  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [batchDate, setBatchDate] = useState<Date>(new Date());
  const [batchSearch, setBatchSearch] = useState('');
  const [batchFilterByDay, setBatchFilterByDay] = useState(true);
  const [batchEvolutionText, setBatchEvolutionText] = useState('');
  const [isImprovingBatchText, setIsImprovingBatchText] = useState(false);
  const [batchStatusMode, setBatchStatusMode] = useState<'same' | 'individual'>('same');
  const [batchGlobalStatus, setBatchGlobalStatus] = useState<Evolution['attendanceStatus']>('presente');
  const [batchAttendanceStatus, setBatchAttendanceStatus] = useState<Record<string, Evolution['attendanceStatus']>>({});
  const [batchSelectedTemplateId, setBatchSelectedTemplateId] = useState<string>('none');
  const [batchTemplateFormValues, setBatchTemplateFormValues] = useState<Record<string, any>>({});
  const [improvingTplFieldId, setImprovingTplFieldId] = useState<string | null>(null);
  const [aiUpgradeOpen, setAiUpgradeOpen] = useState(false);

  const [stamps, setStamps] = useState<{ id: string; name: string; clinical_area: string; is_default: boolean | null }[]>([]);
  const [batchStampMode, setBatchStampMode] = useState<'same' | 'individual'>('same');
  const [batchGlobalStampId, setBatchGlobalStampId] = useState<string>('none');
  const [batchIndividualStamps, setBatchIndividualStamps] = useState<Record<string, string>>({});
  const [clinicTemplates, setClinicTemplates] = useState<EvolutionTemplate[]>([]);

  const isArchived = clinic.isArchived === true;

  useEffect(() => {
    if (!user) return;
    supabase.from('stamps').select('id, name, clinical_area, is_default').eq('user_id', user.id).then(({ data }) => {
      if (data) setStamps(data as any);
    });
  }, [user]);

  useEffect(() => {
    if (!clinic?.id) return;
    supabase
      .from('evolution_templates')
      .select('*')
      .eq('clinic_id', clinic.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { if (data) setClinicTemplates(data as any); });
  }, [clinic?.id]);

  const clinicPatients = useMemo(
    () => patients.filter(p => p.clinicId === clinic.id && !p.isArchived && isPatientActiveOn(p)),
    [patients, clinic.id],
  );

  const batchDateWeekday = useMemo(() => WEEKDAYS[batchDate.getDay()], [batchDate]);

  const batchDayPatients = useMemo(() => {
    if (!batchFilterByDay) return clinicPatients;
    return clinicPatients.filter(p => p.weekdays?.includes(batchDateWeekday));
  }, [clinicPatients, batchFilterByDay, batchDateWeekday]);

  const togglePatientSelection = (patientId: string) =>
    setSelectedPatients(prev => prev.includes(patientId) ? prev.filter(id => id !== patientId) : [...prev, patientId]);

  const getPatientBatchDateEvolution = (patientId: string) => {
    const dateStr = format(batchDate, 'yyyy-MM-dd');
    return evolutions.find(e => e.patientId === patientId && e.date === dateStr);
  };

  const selectAllPatients = () => {
    const ids = batchDayPatients.filter(p => !getPatientBatchDateEvolution(p.id)).map(p => p.id);
    setSelectedPatients(ids);
  };

  const handleBatchEvolution = async () => {
    if (selectedPatients.length === 0) { toast.error('Selecione pelo menos um paciente'); return; }
    const batchTemplate = batchSelectedTemplateId !== 'none' ? clinicTemplates.find(t => t.id === batchSelectedTemplateId) : null;
    const globalStatus = batchStatusMode === 'same' ? batchGlobalStatus : 'presente';
    const isNonPresentGlobal = batchStatusMode === 'same' && ['falta', 'falta_remunerada', 'feriado_remunerado', 'feriado_nao_remunerado'].includes(globalStatus);
    if (!batchTemplate && !batchEvolutionText.trim() && !isNonPresentGlobal) {
      toast.error('Digite o texto da evolução'); return;
    }
    const dateStr = format(batchDate, 'yyyy-MM-dd');
    let fullText = batchEvolutionText;
    if (batchTemplate && Object.keys(batchTemplateFormValues).length > 0) {
      const lines = (batchTemplate.fields as any[])
        .map(f => {
          const val = batchTemplateFormValues[f.id];
          if (val === undefined || val === '' || val === false) return null;
          if (f.type === 'checkbox') return val ? `✅ ${f.label}` : null;
          return `${f.label}: ${val}`;
        })
        .filter(Boolean);
      if (lines.length > 0) {
        const tplSection = lines.join('\n');
        fullText = fullText ? `${tplSection}\n\n---\n\n${fullText}` : tplSection;
      }
    }

    for (const patientId of selectedPatients) {
      const stampId = batchStampMode === 'same'
        ? (batchGlobalStampId !== 'none' ? batchGlobalStampId : undefined)
        : (batchIndividualStamps[patientId] && batchIndividualStamps[patientId] !== 'none' ? batchIndividualStamps[patientId] : undefined);
      const status = batchStatusMode === 'same' ? batchGlobalStatus : (batchAttendanceStatus[patientId] || 'presente');
      const autoText = ['falta', 'falta_remunerada'].includes(status) && !fullText
        ? 'Paciente faltou à sessão.'
        : ['feriado_remunerado', 'feriado_nao_remunerado'].includes(status) && !fullText
          ? 'Feriado.'
          : fullText;
      await addEvolution({
        patientId,
        clinicId: clinic.id,
        date: dateStr,
        text: autoText,
        attendanceStatus: status,
        stampId,
      } as any);

      if (batchTemplate) {
        const { data: ev } = await supabase
          .from('evolutions')
          .select('id')
          .eq('patient_id', patientId)
          .eq('clinic_id', clinic.id)
          .eq('date', dateStr)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (ev) {
          await supabase.from('evolutions').update({
            template_id: batchTemplate.id,
            template_data: batchTemplateFormValues,
          }).eq('id', ev.id);
        }
      }
    }

    toast.success(`Evolução registrada para ${selectedPatients.length} paciente(s)!`);
    setSelectedPatients([]);
    setBatchEvolutionText('');
    setBatchIndividualStamps({});
    setBatchAttendanceStatus({});
    setBatchGlobalStatus('presente');
    setBatchStatusMode('same');
    setBatchSelectedTemplateId('none');
    setBatchTemplateFormValues({});
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-6 border border-border">
        <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Evolução Rápida em Lote
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Aplique a mesma evolução para múltiplos pacientes do dia de uma só vez.
        </p>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <Label className="text-base font-medium">Selecione os pacientes:</Label>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  className="pl-9 h-9 w-full sm:w-[220px]"
                />
              </div>
              <Button variant="outline" size="sm" onClick={selectAllPatients}>
                Selecionar todos
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-sm font-medium shrink-0">Data:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {format(batchDate, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={batchDate}
                  onSelect={(d) => { if (d) { setBatchDate(d); setSelectedPatients([]); } }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <button
              onClick={() => { setBatchFilterByDay(v => !v); setSelectedPatients([]); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all',
                batchFilterByDay ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted text-muted-foreground border-border hover:text-foreground',
              )}
            >
              {batchFilterByDay ? '📅 Só pacientes do dia' : '👥 Todos os pacientes'}
            </button>
            {batchFilterByDay && batchDayPatients.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhum paciente agendado neste dia da semana.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
            {batchDayPatients
              .filter(p => p.name.toLowerCase().includes(batchSearch.toLowerCase()))
              .map((patient) => {
                const existingEvo = getPatientBatchDateEvolution(patient.id);
                const isSelected = selectedPatients.includes(patient.id);
                return (
                  <div
                    key={patient.id}
                    onClick={() => !existingEvo && !isArchived && togglePatientSelection(patient.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                      existingEvo
                        ? 'opacity-50 cursor-not-allowed bg-muted border-border'
                        : isSelected
                          ? 'bg-primary/10 border-primary/40'
                          : 'bg-card border-border hover:bg-accent',
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border-2 flex items-center justify-center shrink-0',
                      isSelected ? 'bg-primary border-primary' : 'border-muted-foreground',
                    )}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{patient.name}</p>
                      {existingEvo && <p className="text-xs text-muted-foreground">Já registrado</p>}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Label className="text-sm font-medium shrink-0">Status:</Label>
              <div className="flex gap-2">
                <Button variant={batchStatusMode === 'same' ? 'default' : 'outline'} size="sm" onClick={() => setBatchStatusMode('same')}>Mesmo para todos</Button>
                <Button variant={batchStatusMode === 'individual' ? 'default' : 'outline'} size="sm" onClick={() => setBatchStatusMode('individual')}>Individual</Button>
              </div>
            </div>

            {batchStatusMode === 'same' && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={batchGlobalStatus === 'presente' ? 'default' : 'outline'} className={cn('gap-2', batchGlobalStatus === 'presente' && 'bg-success hover:bg-success/90')} size="sm" onClick={() => setBatchGlobalStatus('presente')}>
                  <Check className="w-4 h-4" /> Presente
                </Button>
                <Button type="button" variant={batchGlobalStatus === 'falta' ? 'default' : 'outline'} className={cn('gap-2', batchGlobalStatus === 'falta' && 'bg-destructive hover:bg-destructive/90')} size="sm" onClick={() => setBatchGlobalStatus('falta')}>
                  <X className="w-4 h-4" /> Falta
                </Button>
                <Button type="button" variant={batchGlobalStatus === 'reposicao' ? 'default' : 'outline'} className={cn('gap-2', batchGlobalStatus === 'reposicao' && 'bg-primary hover:bg-primary/90')} size="sm" onClick={() => setBatchGlobalStatus('reposicao')}>
                  🔄 Reposição
                </Button>
                <Button type="button" variant={batchGlobalStatus === 'falta_remunerada' ? 'default' : 'outline'} className={cn('gap-2', batchGlobalStatus === 'falta_remunerada' && 'bg-warning hover:bg-warning/90 text-warning-foreground')} size="sm" onClick={() => setBatchGlobalStatus('falta_remunerada')}>
                  <DollarSign className="w-4 h-4" /> Falta Rem.
                </Button>
                <Button type="button" variant={batchGlobalStatus === 'feriado_remunerado' ? 'default' : 'outline'} className={cn('gap-2', batchGlobalStatus === 'feriado_remunerado' && 'bg-primary hover:bg-primary/90')} size="sm" onClick={() => setBatchGlobalStatus('feriado_remunerado')}>
                  🎉 Feriado Rem.
                </Button>
                <Button type="button" variant={batchGlobalStatus === 'feriado_nao_remunerado' ? 'default' : 'outline'} className={cn('gap-2', batchGlobalStatus === 'feriado_nao_remunerado' && 'bg-muted hover:bg-muted/80 text-muted-foreground')} size="sm" onClick={() => setBatchGlobalStatus('feriado_nao_remunerado')}>
                  📅 Feriado
                </Button>
              </div>
            )}

            {batchStatusMode === 'individual' && selectedPatients.length > 0 && (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {selectedPatients.map(pid => {
                  const patient = patients.find(p => p.id === pid);
                  const st = batchAttendanceStatus[pid] || 'presente';
                  return (
                    <div key={pid} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border">
                      <span className="text-sm font-medium min-w-[120px]">{patient?.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {([
                          { val: 'presente', label: '✅' },
                          { val: 'falta', label: '❌' },
                          { val: 'reposicao', label: '🔄' },
                          { val: 'falta_remunerada', label: '💰' },
                          { val: 'feriado_remunerado', label: '🎉' },
                          { val: 'feriado_nao_remunerado', label: '📅' },
                        ] as const).map(opt => (
                          <Button key={opt.val} type="button" size="sm"
                            variant={st === opt.val ? 'default' : 'outline'}
                            className={cn('h-7 px-2 text-xs', st === opt.val && (
                              opt.val === 'presente' ? 'bg-success hover:bg-success/90' :
                              opt.val === 'falta' ? 'bg-destructive hover:bg-destructive/90' :
                              opt.val === 'falta_remunerada' ? 'bg-warning hover:bg-warning/90 text-warning-foreground' :
                              opt.val === 'feriado_nao_remunerado' ? 'bg-muted hover:bg-muted/80 text-muted-foreground' :
                              'bg-primary hover:bg-primary/90'
                            ))}
                            onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [pid]: opt.val as any }))}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {stamps.length > 1 && (
            <div className="flex items-center gap-3 pt-2">
              <Label className="text-sm font-medium shrink-0">Carimbo:</Label>
              <div className="flex gap-2">
                <Button variant={batchStampMode === 'same' ? 'default' : 'outline'} size="sm" onClick={() => setBatchStampMode('same')}>Mesmo para todos</Button>
                <Button variant={batchStampMode === 'individual' ? 'default' : 'outline'} size="sm" onClick={() => setBatchStampMode('individual')}>Individual</Button>
              </div>
            </div>
          )}

          {batchStampMode === 'same' && stamps.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Carimbo global:</Label>
              <Select value={batchGlobalStampId} onValueChange={setBatchGlobalStampId}>
                <SelectTrigger className="w-full sm:w-[280px]"><SelectValue placeholder="Selecionar carimbo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem carimbo</SelectItem>
                  {stamps.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — {s.clinical_area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-sm font-medium mb-2 block">Modelo de evolução (opcional):</Label>
            <Select value={batchSelectedTemplateId} onValueChange={(v) => { setBatchSelectedTemplateId(v); setBatchTemplateFormValues({}); }}>
              <SelectTrigger className="w-full sm:w-[280px]"><SelectValue placeholder="Selecionar modelo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem modelo (texto livre)</SelectItem>
                {clinicTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {batchSelectedTemplateId !== 'none' && (() => {
            const tmpl = clinicTemplates.find(t => t.id === batchSelectedTemplateId);
            if (!tmpl) return null;
            const fields = tmpl.fields as any[];
            return (
              <div className="space-y-3 p-4 rounded-xl bg-secondary/50 border border-border">
                {fields.map((field: any) => (
                  <div key={field.id}>
                    <Label className="text-sm mb-1 block">{field.label}{field.required && ' *'}</Label>
                    {field.type === 'select' ? (
                      <Select value={batchTemplateFormValues[field.id] || ''} onValueChange={(v) => setBatchTemplateFormValues(prev => ({ ...prev, [field.id]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>
                          {(field.options || []).map((opt: string) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'textarea' ? (
                      <div className="space-y-1">
                        <Textarea
                          value={batchTemplateFormValues[field.id] || ''}
                          onChange={(e) => setBatchTemplateFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                          placeholder={field.placeholder || ''}
                          rows={3}
                        />
                        {batchTemplateFormValues[field.id]?.trim() && (
                          <Button
                            type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
                            disabled={improvingTplFieldId !== null}
                            onClick={async () => {
                              const cur = batchTemplateFormValues[field.id];
                              if (!cur?.trim()) return;
                              if (!hasAI) { setAiUpgradeOpen(true); return; }
                              setImprovingTplFieldId(field.id);
                              try {
                                const { data, error } = await supabase.functions.invoke('improve-evolution', { body: { text: cur } });
                                if (error) throw error;
                                if (data?.improved) {
                                  setBatchTemplateFormValues(prev => ({ ...prev, [field.id]: data.improved }));
                                  toast.success('Texto melhorado com IA!');
                                }
                              } catch { toast.error('Erro ao melhorar texto'); }
                              finally { setImprovingTplFieldId(null); }
                            }}
                          >
                            {improvingTplFieldId === field.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                            Melhorar com IA
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Input
                        value={batchTemplateFormValues[field.id] || ''}
                        onChange={(e) => setBatchTemplateFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder={field.placeholder || ''}
                        type={field.type === 'number' ? 'number' : 'text'}
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {batchSelectedTemplateId === 'none' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Texto da evolução:</Label>
                <Button
                  variant="outline" size="sm" className="gap-1.5 h-7 text-xs"
                  disabled={!batchEvolutionText.trim() || isImprovingBatchText}
                  onClick={async () => {
                    if (!batchEvolutionText.trim()) return;
                    if (!hasAI) { setAiUpgradeOpen(true); return; }
                    setIsImprovingBatchText(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('improve-evolution', { body: { text: batchEvolutionText } });
                      if (error) throw error;
                      if (data?.improved) { setBatchEvolutionText(data.improved); toast.success('Texto melhorado com IA!'); }
                    } catch { toast.error('Erro ao melhorar texto'); }
                    finally { setIsImprovingBatchText(false); }
                  }}
                >
                  {isImprovingBatchText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Melhorar com IA
                </Button>
              </div>
              <Textarea
                value={batchEvolutionText}
                onChange={(e) => setBatchEvolutionText(e.target.value)}
                placeholder="Descreva a evolução para todos os pacientes selecionados..."
                rows={4}
                disabled={isArchived}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-muted-foreground">{selectedPatients.length} paciente(s) selecionado(s)</p>
            <Button
              className="gradient-primary gap-2"
              onClick={handleBatchEvolution}
              disabled={isArchived || selectedPatients.length === 0 || (batchSelectedTemplateId === 'none' && !batchEvolutionText.trim() && batchStatusMode === 'same' && ['presente', 'reposicao', 'anteposicao'].includes(batchGlobalStatus))}
            >
              <FileText className="w-4 h-4" />
              Aplicar Evolução
            </Button>
          </div>
        </div>
      </div>
      <AIUpgradeDialog open={aiUpgradeOpen} onOpenChange={setAiUpgradeOpen} />
    </div>
  );
}