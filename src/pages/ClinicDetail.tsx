import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Users, MapPin, Clock, DollarSign, Calendar, Phone, Cake, Check, X, ClipboardList, FileText, Package, Trash2, Edit, Pencil, Stamp as StampIcon, CalendarIcon, Wand2, Loader2, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimeWithDurationPicker } from '@/components/ui/time-picker';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EditClinicDialog } from '@/components/clinics/EditClinicDialog';
import { EditPatientDialog } from '@/components/patients/EditPatientDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateReportPdf } from '@/utils/generateReportPdf';
import { Clinic } from '@/types';

const WEEKDAYS = [
  { value: 'Segunda', label: 'Segunda-feira' },
  { value: 'Terça', label: 'Terça-feira' },
  { value: 'Quarta', label: 'Quarta-feira' },
  { value: 'Quinta', label: 'Quinta-feira' },
  { value: 'Sexta', label: 'Sexta-feira' },
  { value: 'Sábado', label: 'Sábado' },
];

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

function getTodayWeekday() {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[new Date().getDay()];
}

function ClinicReports({ clinicId, clinicName, clinicAddress, clinicLetterhead, clinic }: { clinicId: string; clinicName?: string; clinicAddress?: string; clinicLetterhead?: string; clinic?: Clinic }) {
  const [reports, setReports] = useState<{ id: string; title: string; content: string; created_at: string }[]>([]);

  useEffect(() => {
    supabase.from('saved_reports').select('id, title, content, created_at')
      .eq('clinic_id', clinicId).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setReports(data); });
  }, [clinicId]);

  const handleDownloadPdf = (report: { title: string; content: string }) => {
    generateReportPdf({
      title: report.title,
      content: report.content,
      clinicName,
      clinicAddress,
      clinicLetterhead,
      clinicEmail: clinic?.email,
      clinicCnpj: clinic?.cnpj,
      clinicPhone: clinic?.phone,
      clinicServicesDescription: clinic?.servicesDescription,
    });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('saved_reports').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    setReports(prev => prev.filter(r => r.id !== id));
    toast.success('Relatório excluído!');
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" /> Documentos desta Clínica
      </h2>
      {reports.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-muted-foreground">Nenhum relatório salvo nesta clínica</p>
          <p className="text-sm text-muted-foreground mt-1">Gere relatórios na página de Relatórios IA e salve na pasta da clínica</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border">
              <div>
                <p className="font-medium text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => handleDownloadPdf(r)}>
                  <Download className="w-3 h-3" /> PDF
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(r.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClinicDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clinics, patients, appointments, evolutions, addPatient, updatePatient, addEvolution, setCurrentPatient, updateClinic, getClinicPackages, addPackage, updatePackage, deletePackage } = useApp();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editClinicOpen, setEditClinicOpen] = useState(false);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<typeof patients[0] | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchEvolutionText, setBatchEvolutionText] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [batchDate, setBatchDate] = useState<Date>(new Date());
  const [batchStampMode, setBatchStampMode] = useState<'same' | 'individual'>('same');
  const [batchGlobalStampId, setBatchGlobalStampId] = useState<string>('none');
  const [batchIndividualStamps, setBatchIndividualStamps] = useState<Record<string, string>>({});
  const [batchAttendanceStatus, setBatchAttendanceStatus] = useState<Record<string, 'presente' | 'falta' | 'falta_remunerada'>>({});
  const [stamps, setStamps] = useState<{ id: string; name: string; clinical_area: string; stamp_image: string | null; is_default: boolean | null }[]>([]);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [newPackage, setNewPackage] = useState({ name: '', description: '', price: '' });
  const [editingPackage, setEditingPackage] = useState<{id: string; name: string; description: string; price: string} | null>(null);
  const [isImprovingBatchText, setIsImprovingBatchText] = useState(false);
  const { user } = useAuth();

  // Load stamps
  useEffect(() => {
    if (!user) return;
    supabase.from('stamps').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) {
        setStamps(data);
        const defaultStamp = data.find(s => s.is_default);
        if (defaultStamp) setBatchGlobalStampId(defaultStamp.id);
      }
    });
  }, [user]);

  const clinic = clinics.find(c => c.id === id);
  const clinicPatients = patients.filter(p => p.clinicId === id);

  // Get today's weekday for filtering patients
  const todayWeekday = getTodayWeekday();
  
  // Get patients scheduled for today based on their weekdays
  const todayPatients = useMemo(() => {
    return clinicPatients.filter(p => p.weekdays?.includes(todayWeekday));
  }, [clinicPatients, todayWeekday]);

  // Get appointments for today at this clinic
  const todayAppointments = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return appointments.filter(a => a.clinicId === id && a.date === today);
  }, [appointments, id]);

  // Check if evolution already exists for patient today
  const getPatientTodayEvolution = (patientId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return evolutions.find(e => e.patientId === patientId && e.date === today);
  };

  // Combine scheduled patients with appointments
  const todaySchedule = useMemo(() => {
    const scheduleMap = new Map<string, { patient: typeof clinicPatients[0], time: string, hasEvolution: boolean, evolution?: typeof evolutions[0] }>();
    
    // Add patients based on their weekday schedule
    todayPatients.forEach(patient => {
      const evolution = getPatientTodayEvolution(patient.id);
      scheduleMap.set(patient.id, {
        patient,
        time: patient.scheduleTime || '00:00',
        hasEvolution: !!evolution,
        evolution
      });
    });

    // Sort by time
    return Array.from(scheduleMap.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [todayPatients, evolutions]);

  const [formData, setFormData] = useState({
    name: '',
    birthdate: '',
    phone: '',
    clinicalArea: '',
    diagnosis: '',
    professionals: '',
    observations: '',
    responsibleName: '',
    responsibleEmail: '',
    contractStartDate: '',
    weekdays: [] as string[],
    scheduleByDay: {} as { [day: string]: { start: string; end: string } },
    sessionDuration: '50',
    packageId: '',
  });

  const clinicPackages = clinic ? getClinicPackages(clinic.id) : [];

  // Quick evolution state
  const [quickEvolutionPatient, setQuickEvolutionPatient] = useState<string | null>(null);
  const [quickEvolutionText, setQuickEvolutionText] = useState('');
  const [quickEvolutionStatus, setQuickEvolutionStatus] = useState<'presente' | 'falta'>('presente');

  if (!clinic) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Clínica não encontrada</p>
        <Button onClick={() => navigate('/clinics')} className="mt-4">
          Voltar para Clínicas
        </Button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.birthdate) return;

    // Determinar scheduleTime a partir de scheduleByDay (pegar o primeiro horário para compatibilidade)
    const firstDayTime = formData.weekdays.length > 0 
      ? formData.scheduleByDay[formData.weekdays[0]]?.start || ''
      : '';

    const selectedPkg = formData.packageId ? clinicPackages.find(p => p.id === formData.packageId) : null;

    addPatient({
      clinicId: clinic.id,
      name: formData.name,
      birthdate: formData.birthdate,
      phone: formData.phone,
      clinicalArea: formData.clinicalArea,
      diagnosis: formData.diagnosis,
      professionals: formData.professionals,
      observations: formData.observations,
      responsibleName: formData.responsibleName,
      responsibleEmail: formData.responsibleEmail,
      paymentType: clinic.paymentType === 'sessao' ? 'sessao' : clinic.paymentType === 'fixo_mensal' ? 'fixo' : 'sessao',
      paymentValue: selectedPkg ? selectedPkg.price : clinic.paymentAmount,
      contractStartDate: formData.contractStartDate,
      weekdays: formData.weekdays,
      scheduleTime: firstDayTime,
      scheduleByDay: formData.scheduleByDay,
      packageId: formData.packageId || undefined,
    });

    setFormData({
      name: '',
      birthdate: '',
      phone: '',
      clinicalArea: '',
      diagnosis: '',
      professionals: '',
      observations: '',
      responsibleName: '',
      responsibleEmail: '',
      contractStartDate: '',
      weekdays: [],
      scheduleByDay: {},
      sessionDuration: '50',
      packageId: '',
    });
    setIsDialogOpen(false);
    toast.success('Paciente cadastrado com sucesso!');
  };

  const handleOpenPatient = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      setCurrentPatient(patient);
      navigate(`/patients/${patientId}`);
    }
  };

  const handleQuickAttendance = (patientId: string, status: 'presente' | 'falta') => {
    const today = new Date().toISOString().split('T')[0];
    
    addEvolution({
      patientId,
      clinicId: clinic.id,
      date: today,
      text: status === 'falta' ? 'Paciente faltou à sessão.' : '',
      attendanceStatus: status,
    });
    
    toast.success(status === 'presente' ? 'Presença registrada!' : 'Falta registrada!');
  };

  const handleQuickEvolutionSubmit = () => {
    if (!quickEvolutionPatient) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    addEvolution({
      patientId: quickEvolutionPatient,
      clinicId: clinic.id,
      date: today,
      text: quickEvolutionText,
      attendanceStatus: quickEvolutionStatus,
    });
    
    // Limpar e fechar o modal
    setQuickEvolutionPatient(null);
    setQuickEvolutionText('');
    setQuickEvolutionStatus('presente');
    toast.success('Evolução registrada com sucesso!');
  };

  const handleBatchEvolution = () => {
    if (!clinic) return;
    if (selectedPatients.length === 0) {
      toast.error('Selecione pelo menos um paciente');
      return;
    }
    if (!batchEvolutionText.trim()) {
      toast.error('Digite o texto da evolução');
      return;
    }

    const dateStr = format(batchDate, 'yyyy-MM-dd');
    
    selectedPatients.forEach(patientId => {
      const stampId = batchStampMode === 'same' 
        ? (batchGlobalStampId !== 'none' ? batchGlobalStampId : undefined)
        : (batchIndividualStamps[patientId] && batchIndividualStamps[patientId] !== 'none' ? batchIndividualStamps[patientId] : undefined);
      
      const status = batchAttendanceStatus[patientId] || 'presente';
      
      addEvolution({
        patientId,
        clinicId: clinic.id,
        date: dateStr,
        text: batchEvolutionText,
        attendanceStatus: status,
        stampId,
      });
    });

    toast.success(`Evolução registrada para ${selectedPatients.length} paciente(s)!`);
    setSelectedPatients([]);
    setBatchEvolutionText('');
    setBatchIndividualStamps({});
    setBatchAttendanceStatus({});
  };

  const togglePatientSelection = (patientId: string) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  };

  // Check if evolution exists for patient on the selected batch date
  const getPatientBatchDateEvolution = (patientId: string) => {
    const dateStr = format(batchDate, 'yyyy-MM-dd');
    return evolutions.find(e => e.patientId === patientId && e.date === dateStr);
  };

  const selectAllPatients = () => {
    const patientsWithoutEvolution = clinicPatients
      .filter(p => !getPatientBatchDateEvolution(p.id))
      .map(p => p.id);
    setSelectedPatients(patientsWithoutEvolution);
  };

  const isPropria = clinic.type === 'propria';

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => navigate('/clinics')} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Clínicas
        </Button>

        <div className={cn(
          'rounded-3xl p-6 lg:p-8',
          isPropria ? 'gradient-primary' : 'gradient-secondary'
        )}>
          <span className={cn(
            "inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3",
            isPropria ? "bg-white/20 text-primary-foreground" : "bg-primary/10 text-primary"
          )}>
            {isPropria ? 'Clínica Própria' : 'Terceirizada / Convênio'}
          </span>
          <div className="flex items-start justify-between">
            <div>
              <h1 className={cn(
                "text-2xl lg:text-3xl font-bold mb-2",
                isPropria ? "text-primary-foreground" : "text-foreground"
              )}>{clinic.name}</h1>
              <div className={cn(
                "flex flex-wrap gap-4",
                isPropria ? "text-primary-foreground/80" : "text-muted-foreground"
              )}>
                {clinic.address && (
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {clinic.address}
                  </span>
                )}
                {clinic.scheduleTime && (
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {clinic.scheduleTime}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                isPropria 
                  ? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
              onClick={() => setEditClinicOpen(true)}
            >
              <Pencil className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-2xl p-5 border border-border">
          <Users className="w-8 h-8 text-primary mb-2" />
          <p className="text-muted-foreground text-sm">Pacientes</p>
          <p className="text-2xl font-bold text-foreground">{clinicPatients.length}</p>
        </div>
        
        <div className="bg-card rounded-2xl p-5 border border-border">
          <Calendar className="w-8 h-8 text-accent mb-2" />
          <p className="text-muted-foreground text-sm">Hoje ({todayWeekday})</p>
          <p className="text-2xl font-bold text-foreground">{todaySchedule.length}</p>
        </div>

        {clinic.weekdays?.length && (
          <div className="bg-card rounded-2xl p-5 border border-border">
            <Clock className="w-8 h-8 text-warning mb-2" />
            <p className="text-muted-foreground text-sm">Dias</p>
            <p className="text-sm font-bold text-foreground">{clinic.weekdays.join(', ')}</p>
          </div>
        )}

        {clinic.paymentAmount && (
          <div className="bg-card rounded-2xl p-5 border border-border">
            <DollarSign className="w-8 h-8 text-success mb-2" />
            <p className="text-muted-foreground text-sm">Remuneração</p>
            <p className="text-lg font-bold text-foreground">
              R$ {clinic.paymentAmount.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="today" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="today" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Hoje
          </TabsTrigger>
          <TabsTrigger value="batch" className="gap-2">
            <FileText className="w-4 h-4" />
            Lote
          </TabsTrigger>
          <TabsTrigger value="patients" className="gap-2">
            <Users className="w-4 h-4" />
            Pacientes
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-2">
            <Package className="w-4 h-4" />
            Pacotes
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Documentos
          </TabsTrigger>
        </TabsList>

        {/* Today's Schedule Tab */}
        <TabsContent value="today" className="space-y-4">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Atendimentos de Hoje - {todayWeekday}
            </h2>

            {todaySchedule.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-muted-foreground">Nenhum atendimento agendado para hoje</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySchedule.map(({ patient, time, hasEvolution, evolution }) => (
                  <div
                    key={patient.id}
                    className={cn(
                      "flex flex-col lg:flex-row lg:items-center justify-between p-4 rounded-xl border transition-colors",
                      hasEvolution 
                        ? evolution?.attendanceStatus === 'presente'
                          ? "bg-success/10 border-success/30"
                          : evolution?.attendanceStatus === 'falta_remunerada'
                            ? "bg-warning/10 border-warning/30"
                            : "bg-destructive/10 border-destructive/30"
                        : "bg-secondary/50 border-border"
                    )}
                  >
                    <div className="flex items-center gap-4 mb-3 lg:mb-0">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold">
                        {time}
                      </div>
                      <div>
                        <h3 
                          className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                          onClick={() => handleOpenPatient(patient.id)}
                        >
                          {patient.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {patient.clinicalArea}{calculateAge(patient.birthdate) !== null ? ` • ${calculateAge(patient.birthdate)} anos` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasEvolution ? (
                        <div className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
                          evolution?.attendanceStatus === 'presente'
                            ? "bg-success/20 text-success"
                            : evolution?.attendanceStatus === 'falta_remunerada'
                              ? "bg-warning/20 text-warning"
                              : "bg-destructive/20 text-destructive"
                        )}>
                          {evolution?.attendanceStatus === 'presente' ? (
                            <>
                              <Check className="w-4 h-4" />
                              Presente
                            </>
                          ) : evolution?.attendanceStatus === 'falta_remunerada' ? (
                            <>
                              <DollarSign className="w-4 h-4" />
                              Falta Remunerada
                            </>
                          ) : (
                            <>
                              <X className="w-4 h-4" />
                              Faltou
                            </>
                          )}
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleQuickAttendance(patient.id, 'falta')}
                          >
                            <X className="w-4 h-4" />
                            Falta
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-success/50 text-success hover:bg-success hover:text-success-foreground"
                            onClick={() => handleQuickAttendance(patient.id, 'presente')}
                          >
                            <Check className="w-4 h-4" />
                            Presença
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1 gradient-primary"
                            onClick={() => {
                              setQuickEvolutionPatient(patient.id);
                              setQuickEvolutionText('');
                              setQuickEvolutionStatus('presente');
                            }}
                          >
                            <FileText className="w-4 h-4" />
                            Evolução
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Batch Evolution Tab */}
        <TabsContent value="batch" className="space-y-4">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Evolução Rápida em Lote
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Aplique a mesma evolução para múltiplos pacientes do dia de uma só vez.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Selecione os pacientes:</Label>
                <Button variant="outline" size="sm" onClick={selectAllPatients}>
                  Selecionar todos sem evolução
                </Button>
              </div>

              {clinicPatients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum paciente cadastrado nesta clínica
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clinicPatients.map((patient) => {
                    const hasEvolution = !!getPatientBatchDateEvolution(patient.id);
                    const isSelected = selectedPatients.includes(patient.id);
                    const status = batchAttendanceStatus[patient.id] || 'presente';
                    return (
                      <div
                        key={patient.id}
                        className={cn(
                          "flex flex-col gap-2 p-3 rounded-xl border transition-colors",
                          hasEvolution 
                            ? "bg-muted/50 border-muted opacity-60"
                            : isSelected
                              ? "bg-primary/10 border-primary"
                              : "bg-secondary/50 border-border hover:border-primary/50"
                        )}
                      >
                        <label className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => !hasEvolution && togglePatientSelection(patient.id)}
                            disabled={hasEvolution}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{patient.name}</p>
                            <p className="text-xs text-muted-foreground">{patient.scheduleTime || '--:--'} • {patient.clinicalArea || 'Sem área'}</p>
                          </div>
                          {hasEvolution && (
                            <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-full">
                              Feito
                            </span>
                          )}
                        </label>
                        {isSelected && !hasEvolution && (
                          <div className="flex items-center gap-2 pl-7 flex-wrap">
                            <Button
                              type="button"
                              size="sm"
                              variant={status === 'presente' ? 'default' : 'outline'}
                              className={cn("h-7 text-xs gap-1", status === 'presente' && "bg-success hover:bg-success/90 text-success-foreground")}
                              onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [patient.id]: 'presente' }))}
                            >
                              <Check className="w-3 h-3" /> Presente
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={status === 'falta' ? 'default' : 'outline'}
                              className={cn("h-7 text-xs gap-1", status === 'falta' && "bg-destructive hover:bg-destructive/90 text-destructive-foreground")}
                              onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [patient.id]: 'falta' }))}
                            >
                              <X className="w-3 h-3" /> Falta
                            </Button>
                            {clinic && (clinic.absencePaymentType !== 'never' || clinic.paysOnAbsence !== false) && (
                              <Button
                                type="button"
                                size="sm"
                                variant={status === 'falta_remunerada' ? 'default' : 'outline'}
                                className={cn("h-7 text-xs gap-1", status === 'falta_remunerada' && "bg-warning hover:bg-warning/90 text-warning-foreground")}
                                onClick={() => setBatchAttendanceStatus(prev => ({ ...prev, [patient.id]: 'falta_remunerada' }))}
                              >
                                <DollarSign className="w-3 h-3" /> Falta Remunerada
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-4 border-t border-border space-y-4">
                {/* Date Picker */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <CalendarIcon className="w-4 h-4" /> Data da Evolução
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !batchDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(batchDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={batchDate}
                        onSelect={(d) => d && setBatchDate(d)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Stamp Selection */}
                <div>
                  <Label className="flex items-center gap-2 mb-2">
                    <StampIcon className="w-4 h-4" /> Carimbo
                  </Label>
                  <div className="flex items-center gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="stampMode" checked={batchStampMode === 'same'} onChange={() => setBatchStampMode('same')} className="accent-primary" />
                      <span className="text-sm">Mesmo para todos</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="stampMode" checked={batchStampMode === 'individual'} onChange={() => setBatchStampMode('individual')} className="accent-primary" />
                      <span className="text-sm">Individual por paciente</span>
                    </label>
                  </div>

                  {batchStampMode === 'same' ? (
                    <Select value={batchGlobalStampId} onValueChange={setBatchGlobalStampId}>
                      <SelectTrigger className="w-full sm:w-[280px]">
                        <SelectValue placeholder="Selecione um carimbo (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem carimbo</SelectItem>
                        {stamps.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} — {s.clinical_area}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    selectedPatients.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedPatients.map(pid => {
                          const patient = clinicPatients.find(p => p.id === pid);
                          if (!patient) return null;
                          return (
                            <div key={pid} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                              <span className="text-sm font-medium min-w-[120px] truncate">{patient.name}</span>
                              <Select value={batchIndividualStamps[pid] || 'none'} onValueChange={(v) => setBatchIndividualStamps(prev => ({ ...prev, [pid]: v }))}>
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Carimbo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Sem carimbo</SelectItem>
                                  {stamps.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name} — {s.clinical_area}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Selecione pacientes primeiro para atribuir carimbos individuais.</p>
                    )
                  )}
                </div>

                {/* Evolution Text */}
                <div>
                  <Label className="mb-2 block">Texto da Evolução</Label>
                  <Textarea
                    value={batchEvolutionText}
                    onChange={(e) => setBatchEvolutionText(e.target.value)}
                    placeholder="Digite a evolução que será aplicada a todos os pacientes selecionados..."
                    className="min-h-[120px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-2"
                    disabled={!batchEvolutionText.trim() || isImprovingBatchText}
                    onClick={async () => {
                      setIsImprovingBatchText(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('improve-evolution', {
                          body: { text: batchEvolutionText },
                        });
                        if (error) throw error;
                        if (data?.improved) {
                          setBatchEvolutionText(data.improved);
                          toast.success('Texto melhorado com IA!');
                        }
                      } catch (e) {
                        toast.error('Erro ao melhorar texto');
                      } finally {
                        setIsImprovingBatchText(false);
                      }
                    }}
                  >
                    {isImprovingBatchText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Melhorar com IA
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  {selectedPatients.length} paciente(s) selecionado(s)
                </p>
                <Button 
                  className="gradient-primary gap-2"
                  onClick={handleBatchEvolution}
                  disabled={selectedPatients.length === 0 || !batchEvolutionText.trim()}
                >
                  <FileText className="w-4 h-4" />
                  Aplicar Evolução
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Patients Tab */}
        <TabsContent value="patients">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Pacientes</h2>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Paciente
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Novo Paciente</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label>Nome Completo *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: João Silva"
                        required
                      />
                    </div>

                    <div>
                      <Label>Data de Nascimento *</Label>
                      <Input
                        type="date"
                        value={formData.birthdate}
                        onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label>Telefone</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    </div>

                    <div>
                      <Label>Área Clínica</Label>
                      <Input
                        value={formData.clinicalArea}
                        onChange={(e) => setFormData({ ...formData, clinicalArea: e.target.value })}
                        placeholder="Ex: Psicologia Clínica"
                      />
                    </div>

                    <div>
                      <Label>Hipótese Diagnóstica (CID/DSM)</Label>
                      <Input
                        value={formData.diagnosis}
                        onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                        placeholder="Ex: F84 - TEA"
                      />
                    </div>

                    <div>
                      <Label>Observações</Label>
                      <Textarea
                        value={formData.observations}
                        onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                        placeholder="Queixa inicial, histórico..."
                      />
                    </div>

                    {/* Package selection and payment info */}
                    <div className="border-t pt-4">
                      <p className="font-semibold mb-2">💰 Pagamento</p>
                      
                      {clinicPackages.length > 0 && (
                        <div className="mb-3">
                          <Label>Pacote</Label>
                          <Select
                            value={formData.packageId}
                            onValueChange={(v) => setFormData({ ...formData, packageId: v === 'none' ? '' : v })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Selecione um pacote (opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem pacote (valor da clínica)</SelectItem>
                              {clinicPackages.map(pkg => (
                                <SelectItem key={pkg.id} value={pkg.id}>
                                  {pkg.name} - R$ {pkg.price.toFixed(2)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formData.packageId ? (
                        <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                          Pacote: <span className="font-semibold text-foreground">{clinicPackages.find(p => p.id === formData.packageId)?.name}</span>
                          {' - '}
                          <span className="font-semibold text-success">R$ {clinicPackages.find(p => p.id === formData.packageId)?.price.toFixed(2)}</span>
                        </p>
                      ) : clinic.paymentAmount ? (
                        <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">
                          Valor herdado da clínica: <span className="font-semibold text-foreground">R$ {clinic.paymentAmount.toFixed(2)}</span>
                          {clinic.paymentType === 'sessao' && ' por sessão'}
                          {clinic.paymentType === 'fixo_mensal' && ' mensal'}
                          {clinic.paymentType === 'fixo_diario' && ' por dia'}
                        </p>
                      ) : null}
                    </div>


                    <div className="border-t pt-4">
                      <p className="font-semibold mb-3">📅 Horários de Atendimento</p>
                      
                      <Label className="mb-2 block">Selecione os dias e defina o horário de entrada e saída:</Label>
                      <div className="space-y-3 mt-2">
                        {WEEKDAYS.map((day) => {
                          const isSelected = formData.weekdays.includes(day.value);
                          return (
                            <div key={day.value} className="flex items-center gap-3 flex-wrap">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFormData({
                                      ...formData,
                                      weekdays: [...formData.weekdays, day.value],
                                    });
                                  } else {
                                    const newScheduleByDay = { ...formData.scheduleByDay };
                                    delete newScheduleByDay[day.value];
                                    setFormData({
                                      ...formData,
                                      weekdays: formData.weekdays.filter(d => d !== day.value),
                                      scheduleByDay: newScheduleByDay,
                                    });
                                  }
                                }}
                              />
                              <span className="text-sm w-24">{day.label}</span>
                              {isSelected && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="time"
                                    value={formData.scheduleByDay[day.value]?.start || ''}
                                    onChange={(e) => setFormData({
                                      ...formData,
                                      scheduleByDay: {
                                        ...formData.scheduleByDay,
                                        [day.value]: {
                                          start: e.target.value,
                                          end: formData.scheduleByDay[day.value]?.end || ''
                                        }
                                      }
                                    })}
                                    className="w-24"
                                    placeholder="Entrada"
                                  />
                                  <span className="text-xs text-muted-foreground">até</span>
                                  <Input
                                    type="time"
                                    value={formData.scheduleByDay[day.value]?.end || ''}
                                    onChange={(e) => setFormData({
                                      ...formData,
                                      scheduleByDay: {
                                        ...formData.scheduleByDay,
                                        [day.value]: {
                                          start: formData.scheduleByDay[day.value]?.start || '',
                                          end: e.target.value
                                        }
                                      }
                                    })}
                                    className="w-24"
                                    placeholder="Saída"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <Label>Duração da sessão:</Label>
                        <Select
                          value={formData.sessionDuration}
                          onValueChange={(v) => setFormData({ ...formData, sessionDuration: v })}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="40">40 min</SelectItem>
                            <SelectItem value="50">50 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                            <SelectItem value="90">90 min</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button type="submit" className="flex-1 gradient-primary">
                        Salvar Paciente
                      </Button>
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {clinicPatients.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-muted-foreground">Nenhum paciente cadastrado nesta clínica</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clinicPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="bg-secondary/50 rounded-xl p-4 hover:bg-secondary transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 
                        className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                        onClick={() => handleOpenPatient(patient.id)}
                      >
                        {patient.name}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPatientToEdit(patient);
                          setEditPatientOpen(true);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground cursor-pointer" onClick={() => handleOpenPatient(patient.id)}>
                      {patient.birthdate && (
                        <p className="flex items-center gap-2">
                          <Cake className="w-4 h-4" />
                          {calculateAge(patient.birthdate)} anos
                        </p>
                      )}
                      {patient.phone && (
                        <p className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {patient.phone}
                        </p>
                      )}
                      {patient.clinicalArea && (
                        <p className="text-primary font-medium">{patient.clinicalArea}</p>
                      )}
                    </div>

                    {patient.paymentValue && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <span className="text-success font-semibold">
                          R$ {patient.paymentValue.toFixed(2)}
                          {patient.paymentType === 'sessao' ? '/sessão' : '/mês'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Pacotes
              </h2>
              
              <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Pacote
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Novo Pacote</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Nome do Pacote *</Label>
                      <Input
                        value={newPackage.name}
                        onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                        placeholder="Ex: Pacote Social, Pacote Premium"
                      />
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        value={newPackage.description}
                        onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                        placeholder="Detalhes do pacote..."
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>Valor (R$) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newPackage.price}
                        onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={!newPackage.name.trim() || !newPackage.price}
                      onClick={() => {
                        addPackage({
                          userId: '',
                          clinicId: clinic.id,
                          name: newPackage.name,
                          description: newPackage.description || undefined,
                          price: parseFloat(newPackage.price),
                          isActive: true,
                        });
                        setNewPackage({ name: '', description: '', price: '' });
                        setPackageDialogOpen(false);
                      }}
                    >
                      Criar Pacote
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {clinicPackages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-muted-foreground mb-2">Nenhum pacote cadastrado</p>
                <p className="text-sm text-muted-foreground">
                  Crie pacotes com valores diferentes para organizar seus atendimentos
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clinicPackages.map((pkg) => (
                  <div key={pkg.id} className="bg-secondary/50 rounded-xl p-4 border border-border">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{pkg.name}</h3>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setEditingPackage({ id: pkg.id, name: pkg.name, description: pkg.description || '', price: pkg.price.toString() })}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deletePackage(pkg.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {pkg.description && (
                      <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>
                    )}
                    <p className="text-lg font-bold text-success">
                      R$ {pkg.price.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <ClinicReports clinicId={clinic.id} clinicName={clinic.name} clinicAddress={clinic.address || undefined} clinicLetterhead={clinic.letterhead || undefined} clinic={clinic} />
        </TabsContent>
      </Tabs>

      {/* Edit Package Dialog */}
      {editingPackage && (
        <Dialog open={!!editingPackage} onOpenChange={(open) => !open && setEditingPackage(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar Pacote</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Nome do Pacote *</Label>
                <Input value={editingPackage.name}
                  onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                  placeholder="Ex: Pacote Social" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editingPackage.description}
                  onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })}
                  placeholder="Detalhes do pacote..." rows={2} />
              </div>
              <div>
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={editingPackage.price}
                  onChange={(e) => setEditingPackage({ ...editingPackage, price: e.target.value })}
                  placeholder="0.00" />
              </div>
              <Button className="w-full" disabled={!editingPackage.name.trim() || !editingPackage.price}
                onClick={() => {
                  updatePackage(editingPackage.id, {
                    name: editingPackage.name,
                    description: editingPackage.description || undefined,
                    price: parseFloat(editingPackage.price),
                  });
                  setEditingPackage(null);
                  toast.success('Pacote atualizado!');
                }}>
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quick Evolution Dialog */}
      <Dialog open={!!quickEvolutionPatient} onOpenChange={(open) => !open && setQuickEvolutionPatient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Evolução Rápida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status de Presença</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={quickEvolutionStatus === 'presente' ? 'default' : 'outline'}
                  className={cn(
                    "flex-1 gap-2",
                    quickEvolutionStatus === 'presente' && "bg-success hover:bg-success/90"
                  )}
                  onClick={() => setQuickEvolutionStatus('presente')}
                >
                  <Check className="w-4 h-4" />
                  Presente
                </Button>
                <Button
                  type="button"
                  variant={quickEvolutionStatus === 'falta' ? 'default' : 'outline'}
                  className={cn(
                    "flex-1 gap-2",
                    quickEvolutionStatus === 'falta' && "bg-destructive hover:bg-destructive/90"
                  )}
                  onClick={() => setQuickEvolutionStatus('falta')}
                >
                  <X className="w-4 h-4" />
                  Falta
                </Button>
              </div>
            </div>

            <div>
              <Label>Evolução</Label>
              <Textarea
                value={quickEvolutionText}
                onChange={(e) => setQuickEvolutionText(e.target.value)}
                placeholder="Descreva a evolução do atendimento..."
                className="min-h-[120px] mt-2"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                className="flex-1 gradient-primary"
                onClick={handleQuickEvolutionSubmit}
              >
                Salvar Evolução
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setQuickEvolutionPatient(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Clinic Dialog */}
      <EditClinicDialog
        clinic={clinic}
        open={editClinicOpen}
        onOpenChange={setEditClinicOpen}
        onSave={updateClinic}
      />

      {/* Edit Patient Dialog */}
      {patientToEdit && (
        <EditPatientDialog
          patient={patientToEdit}
          open={editPatientOpen}
          onOpenChange={(open) => {
            setEditPatientOpen(open);
            if (!open) setPatientToEdit(null);
          }}
          onSave={updatePatient}
          clinicPackages={clinicPackages}
        />
      )}
    </div>
  );
}
