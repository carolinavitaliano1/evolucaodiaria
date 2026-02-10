import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Cake, MapPin, Clock, DollarSign, Calendar, User, FileText, Plus, CheckCircle2, XCircle, Image, Stamp, Download, CalendarRange, PenLine, Eye, Edit, X } from 'lucide-react';
import { generateEvolutionPdf, generateMultipleEvolutionsPdf } from '@/utils/generateEvolutionPdf';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

function calculateAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return null;
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
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
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  
  
  // PDF period selection
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  // Edit evolution
  const [editingEvolution, setEditingEvolution] = useState<Evolution | null>(null);

  if (!patient) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Paciente não encontrado</p>
        <Button onClick={() => navigate('/clinics')} className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const handleGeneratePeriodPdf = () => {
    if (!startDate || !endDate) return;
    
    const filteredEvolutions = patientEvolutions.filter(evo => {
      const evoDate = new Date(evo.date);
      return evoDate >= startDate && evoDate <= endDate;
    });
    
    if (filteredEvolutions.length === 0) {
      toast.error('Nenhuma evolução encontrada no período selecionado.');
      return;
    }
    
    generateMultipleEvolutionsPdf({
      evolutions: filteredEvolutions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      patient,
      clinic,
      startDate,
      endDate,
    });
    
    setPeriodDialogOpen(false);
  };

  const handleSubmitEvolution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evolutionText.trim() && attachedFiles.length === 0) return;

    addEvolution({
      patientId: patient.id,
      clinicId: patient.clinicId,
      date: evolutionDate,
      text: evolutionText,
      attendanceStatus,
      attachments: attachedFiles.map(f => ({
        id: f.id,
        parentId: '',
        parentType: 'evolution' as const,
        name: f.name,
        data: f.filePath,
        type: f.fileType,
        createdAt: new Date().toISOString(),
      })),
    });

    setEvolutionText('');
    setAttachedFiles([]);
    
  };

  const handleFileUpload = (files: UploadedFile[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleBack = () => {
    if (currentClinic) {
      navigate(`/clinics/${currentClinic.id}`);
    } else {
      navigate('/clinics');
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={handleBack} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>

        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Patient Info */}
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">{patient.name}</h1>
            
            <div className="flex flex-wrap gap-3">
              {patient.birthdate && calculateAge(patient.birthdate) !== null && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
                  <Cake className="w-4 h-4" />
                  {calculateAge(patient.birthdate)} anos
                </span>
              )}
              {patient.phone && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-sm">
                  <Phone className="w-4 h-4" />
                  {patient.phone}
                </span>
              )}
              {patient.clinicalArea && (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm">
                  {patient.clinicalArea}
                </span>
              )}
            </div>
          </div>

          {/* Clinic badge */}
          {clinic && (
            <div className="bg-secondary rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Atendimento em</p>
              <p className="font-semibold text-foreground">{clinic.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Info */}
      {(patient.diagnosis || patient.observations || patient.paymentValue) && (
        <div className="bg-card rounded-2xl p-6 border-l-4 border-primary shadow-lg mb-8">
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
            📋 Informações Clínicas
          </h2>
          
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

      {/* Evolution Form */}
      <div className="bg-card rounded-2xl p-6 shadow-lg mb-8 border border-border">
        <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Nova Evolução
        </h2>

        <form onSubmit={handleSubmitEvolution} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={evolutionDate}
                onChange={(e) => setEvolutionDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Presença</Label>
              <Select value={attendanceStatus} onValueChange={(v) => setAttendanceStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presente">✅ Presente</SelectItem>
                  <SelectItem value="falta">❌ Falta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Evolução</Label>
            <Textarea
              value={evolutionText}
              onChange={(e) => setEvolutionText(e.target.value)}
              placeholder="Digite a evolução do paciente..."
              className="min-h-32"
            />
          </div>

          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Image className="w-4 h-4" />
              Anexos (opcional)
            </Label>
            <FileUpload
              parentType="evolution"
              parentId={patient.id}
              existingFiles={attachedFiles}
              onUpload={handleFileUpload}
              onRemove={handleRemoveFile}
              maxFiles={5}
            />
          </div>

          {clinic?.stamp && (
            <div className="p-3 rounded-xl bg-secondary/50 border border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Stamp className="w-4 h-4" />
                Carimbo da clínica será incluído
              </div>
              <img src={clinic.stamp} alt="Carimbo" className="h-16 object-contain" />
            </div>
          )}

          <Button type="submit" className="gradient-primary gap-2">
            <Plus className="w-4 h-4" />
            Salvar Evolução
          </Button>
        </form>
      </div>

      {/* Evolution History */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-lg border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <h2 className="font-bold text-foreground flex flex-wrap items-center gap-2 text-sm sm:text-base">
            📜 Histórico de Evoluções
            <span className="text-xs sm:text-sm font-normal text-muted-foreground">
              ({patientEvolutions.length} registros)
            </span>
          </h2>
          
          {patientEvolutions.length > 0 && (
            <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs sm:text-sm w-full sm:w-auto">
                  <CalendarRange className="w-4 h-4" />
                  PDF por Período
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Gerar PDF de Evoluções</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data Início</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !startDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "dd/MM/yyyy") : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label>Data Fim</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !endDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "dd/MM/yyyy") : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  {startDate && endDate && (
                    <p className="text-sm text-muted-foreground">
                      {patientEvolutions.filter(evo => {
                        const evoDate = new Date(evo.date);
                        return evoDate >= startDate && evoDate <= endDate;
                      }).length} evolução(ões) no período selecionado
                    </p>
                  )}
                  
                  <Button 
                    className="w-full gap-2" 
                    onClick={handleGeneratePeriodPdf}
                    disabled={!startDate || !endDate}
                  >
                    <Download className="w-4 h-4" />
                    Gerar PDF
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
            {patientEvolutions.map((evo) => (
              <div key={evo.id} className="bg-secondary/50 rounded-xl p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-foreground text-sm sm:text-base">
                      {format(new Date(evo.date), 'dd/MM/yyyy', { locale: ptBR })}
                    </span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap',
                      evo.attendanceStatus === 'presente' 
                        ? 'bg-success/10 text-success' 
                        : 'bg-destructive/10 text-destructive'
                    )}>
                      {evo.attendanceStatus === 'presente' ? '✅ Presente' : '❌ Falta'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 h-8 px-2 text-xs sm:text-sm"
                      onClick={() => setEditingEvolution(evo)}
                    >
                      <Edit className="w-3 h-3" />
                      <span className="hidden xs:inline">Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 h-8 px-2 text-xs sm:text-sm"
                      onClick={() => generateEvolutionPdf({ evolution: evo, patient, clinic })}
                    >
                      <Download className="w-3 h-3" />
                      PDF
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-8 px-2 text-xs sm:text-sm"
                      onClick={() => deleteEvolution(evo.id)}
                    >
                      <span className="hidden xs:inline">Excluir</span>
                      <X className="w-3 h-3 xs:hidden" />
                    </Button>
                  </div>
                </div>
                <p className="text-foreground whitespace-pre-wrap">{evo.text}</p>
                
                {/* Show attachments if any */}
                {evo.attachments && evo.attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {evo.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.data.startsWith('http') ? att.data : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/attachments/${att.data}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
                      >
                        {att.type.startsWith('image/') ? (
                          <Image className="w-3 h-3" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        {att.name}
                      </a>
                    ))}
                  </div>
                )}

                {/* Show signature if available */}
                {evo.signature && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <PenLine className="w-3 h-3" />
                      Assinatura:
                    </span>
                    <img 
                      src={evo.signature} 
                      alt="Assinatura" 
                      className="h-8 object-contain"
                    />
                  </div>
                )}

                {/* Show clinic stamp if available */}
                {clinic?.stamp && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <img 
                      src={clinic.stamp} 
                      alt="Carimbo" 
                      className="h-12 object-contain opacity-70"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
