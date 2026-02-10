import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Cake, MapPin, Clock, DollarSign, Calendar, User, FileText, Plus, CheckCircle2, XCircle, Image, Stamp, Download, CalendarRange, PenLine, Eye, Edit, X, ClipboardList, Paperclip, ListTodo } from 'lucide-react';
import { generateEvolutionPdf, generateMultipleEvolutionsPdf } from '@/utils/generateEvolutionPdf';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { EditEvolutionDialog } from '@/components/evolutions/EditEvolutionDialog';
import { Evolution } from '@/types';

const MOOD_OPTIONS = [
  { value: 'otima', emoji: '😄', label: 'Ótima' },
  { value: 'boa', emoji: '😊', label: 'Boa' },
  { value: 'neutra', emoji: '😐', label: 'Neutra' },
  { value: 'ruim', emoji: '😟', label: 'Ruim' },
  { value: 'muito_ruim', emoji: '😢', label: 'Muito ruim' },
] as const;

function getMoodInfo(mood?: string) {
  return MOOD_OPTIONS.find(m => m.value === mood);
}

function calculateAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { patients, clinics, evolutions, addEvolution, updateEvolution, deleteEvolution, currentClinic } = useApp();

  const patient = patients.find(p => p.id === id);
  const clinic = clinics.find(c => c.id === patient?.clinicId);
  const patientEvolutions = evolutions
    .filter(e => e.patientId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const [evolutionText, setEvolutionText] = useState('');
  const [evolutionDate, setEvolutionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceStatus, setAttendanceStatus] = useState<'presente' | 'falta'>('presente');
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  
  // Document attachments for patient
  const [patientDocs, setPatientDocs] = useState<UploadedFile[]>([]);
  
  // Patient tasks
  const [patientTasks, setPatientTasks] = useState<{id: string; title: string; completed: boolean}[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // PDF period selection
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [editingEvolution, setEditingEvolution] = useState<Evolution | null>(null);

  if (!patient) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Paciente não encontrado</p>
        <Button onClick={() => navigate('/clinics')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  // Summaries
  const totalPresent = patientEvolutions.filter(e => e.attendanceStatus === 'presente').length;
  const totalAbsent = patientEvolutions.filter(e => e.attendanceStatus === 'falta').length;
  const totalSessions = patientEvolutions.length;
  const attendanceRate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;

  const totalFinancial = patientEvolutions
    .filter(e => e.attendanceStatus === 'presente')
    .length * (patient.paymentValue || 0);

  const moodCounts = MOOD_OPTIONS.map(m => ({
    ...m,
    count: patientEvolutions.filter(e => e.mood === m.value).length,
  }));
  const totalMoods = moodCounts.reduce((sum, m) => sum + m.count, 0);

  const handleGeneratePeriodPdf = () => {
    if (!startDate || !endDate) return;
    const filteredEvolutions = patientEvolutions.filter(evo => {
      const evoDate = new Date(evo.date);
      return evoDate >= startDate && evoDate <= endDate;
    });
    if (filteredEvolutions.length === 0) { toast.error('Nenhuma evolução encontrada no período.'); return; }
    generateMultipleEvolutionsPdf({
      evolutions: filteredEvolutions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      patient, clinic, startDate, endDate,
    });
    setPeriodDialogOpen(false);
  };

  const handleSubmitEvolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evolutionText.trim() && attachedFiles.length === 0) return;
    addEvolution({
      patientId: patient.id, clinicId: patient.clinicId, date: evolutionDate,
      text: evolutionText, attendanceStatus,
      mood: (selectedMood || undefined) as Evolution['mood'],
      attachments: attachedFiles.map(f => ({
        id: f.id, parentId: '', parentType: 'evolution' as const,
        name: f.name, data: f.filePath, type: f.fileType, createdAt: new Date().toISOString(),
      })),
    });
    setEvolutionText(''); setAttachedFiles([]); setSelectedMood('');
  };

  const handleBack = () => {
    if (currentClinic) navigate(`/clinics/${currentClinic.id}`);
    else navigate('/clinics');
  };

  const addPatientTask = () => {
    if (!newTaskTitle.trim()) return;
    setPatientTasks(prev => [...prev, { id: `task_${Date.now()}`, title: newTaskTitle, completed: false }]);
    setNewTaskTitle('');
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={handleBack} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">{patient.name}</h1>
            <div className="flex flex-wrap gap-3">
              {patient.birthdate && calculateAge(patient.birthdate) !== null && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
                  <Cake className="w-4 h-4" /> {calculateAge(patient.birthdate)} anos
                </span>
              )}
              {patient.phone && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm">
                  <Phone className="w-4 h-4" /> {patient.phone}
                </span>
              )}
              {patient.clinicalArea && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm">
                  {patient.clinicalArea}
                </span>
              )}
            </div>
          </div>
          {clinic && (
            <div className="bg-secondary rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Atendimento em</p>
              <p className="font-semibold text-foreground">{clinic.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Attendance */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-3">📊 Frequência</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold text-foreground">{attendanceRate}%</span>
            <span className="text-sm text-muted-foreground">presença</span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-success">✅ {totalPresent}</span>
            <span className="text-destructive">❌ {totalAbsent}</span>
            <span className="text-muted-foreground">Total: {totalSessions}</span>
          </div>
        </div>

        {/* Financial */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-3">💰 Financeiro</p>
          <p className="text-2xl font-bold text-success mb-1">
            R$ {totalFinancial.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">
            {totalPresent} sessões × R$ {(patient.paymentValue || 0).toFixed(2)}
          </p>
        </div>

        {/* Mood Summary */}
        <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-3">🎭 Humor</p>
          {totalMoods === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro ainda</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {moodCounts.filter(m => m.count > 0).map(m => (
                <div key={m.value} className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-sm">
                  <span>{m.emoji}</span>
                  <span className="font-medium">{m.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Clinical Info */}
      {(patient.diagnosis || patient.observations || patient.paymentValue) && (
        <div className="bg-card rounded-2xl p-6 border-l-4 border-primary shadow-lg mb-8">
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">📋 Informações Clínicas</h2>
          <div className="space-y-4">
            {patient.diagnosis && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Diagnóstico</p>
                <p className="text-foreground">{patient.diagnosis}</p>
              </div>
            )}
            {patient.observations && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Observações</p>
                <p className="text-foreground whitespace-pre-wrap">{patient.observations}</p>
              </div>
            )}
            {patient.paymentValue && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-1">💰 Financeiro</p>
                <p className="text-success font-bold">
                  R$ {patient.paymentValue.toFixed(2)}
                  {patient.paymentType === 'sessao' ? '/sessão' : '/mês'}
                </p>
              </div>
            )}
            {(patient.weekdays?.length || patient.scheduleTime) && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-1">📅 Horários</p>
                {patient.weekdays?.length && <p className="text-foreground">{patient.weekdays.join(', ')}</p>}
                {patient.scheduleTime && <p className="text-foreground">🕐 {patient.scheduleTime}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="evolutions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="evolutions" className="gap-2">
            <FileText className="w-4 h-4" /> Evoluções
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <Paperclip className="w-4 h-4" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="w-4 h-4" /> Tarefas
          </TabsTrigger>
        </TabsList>

        {/* Evolutions Tab */}
        <TabsContent value="evolutions" className="space-y-6">
          {/* Evolution Form */}
          <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
            <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Nova Evolução
            </h2>
            <form onSubmit={handleSubmitEvolution} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={evolutionDate} onChange={(e) => setEvolutionDate(e.target.value)} />
                </div>
                <div>
                  <Label>Presença</Label>
                  <Select value={attendanceStatus} onValueChange={(v) => setAttendanceStatus(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presente">✅ Presente</SelectItem>
                      <SelectItem value="falta">❌ Falta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Humor da Sessão</Label>
                  <div className="flex gap-1 mt-1">
                    {MOOD_OPTIONS.map(m => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setSelectedMood(selectedMood === m.value ? '' : m.value)}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-0.5 p-2 rounded-lg border-2 transition-all text-center",
                          selectedMood === m.value
                            ? "border-primary bg-primary/10"
                            : "border-transparent bg-secondary hover:bg-secondary/80"
                        )}
                        title={m.label}
                      >
                        <span className="text-lg">{m.emoji}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label>Evolução</Label>
                <Textarea
                  value={evolutionText} onChange={(e) => setEvolutionText(e.target.value)}
                  placeholder="Digite a evolução do paciente..." className="min-h-32"
                />
              </div>

              <div>
                <Label className="flex items-center gap-2 mb-2"><Image className="w-4 h-4" /> Anexos (opcional)</Label>
                <FileUpload
                  parentType="evolution" parentId={patient.id}
                  existingFiles={attachedFiles}
                  onUpload={(files) => setAttachedFiles(prev => [...prev, ...files])}
                  onRemove={(fileId) => setAttachedFiles(prev => prev.filter(f => f.id !== fileId))}
                  maxFiles={5}
                />
              </div>

              {clinic?.stamp && (
                <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Stamp className="w-4 h-4" /> Carimbo da clínica será incluído
                  </div>
                  <img src={clinic.stamp} alt="Carimbo" className="h-16 object-contain" />
                </div>
              )}

              <Button type="submit" className="gradient-primary gap-2">
                <Plus className="w-4 h-4" /> Salvar Evolução
              </Button>
            </form>
          </div>

          {/* Evolution History */}
          <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
              <h2 className="font-bold text-foreground flex flex-wrap items-center gap-2 text-sm sm:text-base">
                📜 Histórico de Evoluções
                <span className="text-xs sm:text-sm font-normal text-muted-foreground">({patientEvolutions.length} registros)</span>
              </h2>
              {patientEvolutions.length > 0 && (
                <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm w-full sm:w-auto">
                      <CalendarRange className="w-4 h-4" /> PDF por Período
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Gerar PDF de Evoluções</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Data Início</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                                <Calendar className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "dd/MM/yyyy") : "Selecione"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Data Fim</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                                <Calendar className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "dd/MM/yyyy") : "Selecione"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      {startDate && endDate && (
                        <p className="text-sm text-muted-foreground">
                          {patientEvolutions.filter(evo => { const d = new Date(evo.date); return d >= startDate && d <= endDate; }).length} evolução(ões) no período
                        </p>
                      )}
                      <Button className="w-full gap-2" onClick={handleGeneratePeriodPdf} disabled={!startDate || !endDate}>
                        <Download className="w-4 h-4" /> Gerar PDF
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {patientEvolutions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">📝</div>
                <p className="text-muted-foreground">Nenhuma evolução registrada ainda.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {patientEvolutions.map((evo) => {
                  const moodInfo = getMoodInfo(evo.mood);
                  return (
                    <div key={evo.id} className="bg-secondary/50 rounded-xl p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground text-sm sm:text-base">
                            {format(new Date(evo.date), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap',
                            evo.attendanceStatus === 'presente' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                          )}>
                            {evo.attendanceStatus === 'presente' ? '✅ Presente' : '❌ Falta'}
                          </span>
                          {moodInfo && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium" title={moodInfo.label}>
                              {moodInfo.emoji} {moodInfo.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Button variant="ghost" size="sm" className="gap-1 h-8 px-2 text-xs sm:text-sm" onClick={() => setEditingEvolution(evo)}>
                            <Edit className="w-3 h-3" /> <span className="hidden xs:inline">Editar</span>
                          </Button>
                          <Button variant="outline" size="sm" className="gap-1 h-8 px-2 text-xs sm:text-sm"
                            onClick={() => generateEvolutionPdf({ evolution: evo, patient, clinic })}>
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 px-2 text-xs sm:text-sm"
                            onClick={() => deleteEvolution(evo.id)}>
                            <span className="hidden xs:inline">Excluir</span>
                            <X className="w-3 h-3 xs:hidden" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-foreground whitespace-pre-wrap">{evo.text}</p>

                      {evo.attachments && evo.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {evo.attachments.map((att) => (
                            <a key={att.id}
                              href={att.data.startsWith('http') ? att.data : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/attachments/${att.data}`}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors">
                              {att.type.startsWith('image/') ? <Image className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                              {att.name}
                            </a>
                          ))}
                        </div>
                      )}

                      {evo.signature && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><PenLine className="w-3 h-3" /> Assinatura:</span>
                          <img src={evo.signature} alt="Assinatura" className="h-8 object-contain" />
                        </div>
                      )}

                      {clinic?.stamp && (
                        <div className="mt-4 pt-3 border-t border-border/50">
                          <img src={clinic.stamp} alt="Carimbo" className="h-12 object-contain opacity-70" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
            <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-primary" /> Documentos do Paciente
            </h2>
            <FileUpload
              parentType="patient"
              parentId={patient.id}
              existingFiles={patientDocs}
              onUpload={(files) => setPatientDocs(prev => [...prev, ...files])}
              onRemove={(fileId) => setPatientDocs(prev => prev.filter(f => f.id !== fileId))}
              maxFiles={20}
              label="Anexe laudos, receitas, documentos e outros arquivos do paciente"
            />
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
            <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" /> Tarefas do Paciente
            </h2>
            
            <div className="flex gap-2 mb-6">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Nova tarefa..."
                onKeyDown={(e) => e.key === 'Enter' && addPatientTask()}
              />
              <Button onClick={addPatientTask} disabled={!newTaskTitle.trim()} className="gap-2">
                <Plus className="w-4 h-4" /> Adicionar
              </Button>
            </div>

            {patientTasks.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">📋</div>
                <p className="text-muted-foreground">Nenhuma tarefa cadastrada.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {patientTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                    <button
                      onClick={() => setPatientTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))}
                      className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        task.completed ? "bg-success border-success text-success-foreground" : "border-muted-foreground"
                      )}
                    >
                      {task.completed && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <span className={cn("flex-1 text-foreground", task.completed && "line-through text-muted-foreground")}>{task.title}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => setPatientTasks(prev => prev.filter(t => t.id !== task.id))}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Evolution Dialog */}
      {editingEvolution && (
        <EditEvolutionDialog
          evolution={editingEvolution}
          open={!!editingEvolution}
          onOpenChange={(open) => !open && setEditingEvolution(null)}
          onSave={(updates) => updateEvolution(editingEvolution.id, updates)}
        />
      )}
    </div>
  );
}
