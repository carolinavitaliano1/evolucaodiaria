import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Users, MapPin, Clock, DollarSign, Stamp, Briefcase, Phone, Mail, Check, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimePicker } from '@/components/ui/time-picker';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { Clinic } from '@/types';
import { ServiceDialog } from '@/components/services/ServiceDialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WEEKDAYS = [
  { value: 'Segunda', label: 'Seg' },
  { value: 'Terça', label: 'Ter' },
  { value: 'Quarta', label: 'Qua' },
  { value: 'Quinta', label: 'Qui' },
  { value: 'Sexta', label: 'Sex' },
  { value: 'Sábado', label: 'Sáb' },
];

interface PrivateAppointment {
  id: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  service_id?: string;
  date: string;
  time: string;
  price: number;
  status: string;
  notes?: string;
  paid?: boolean;
}

export default function Clinics() {
  const { clinics, patients, addClinic, setCurrentClinic } = useApp();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'propria' | 'terceirizada'>('all');
  const [stampFile, setStampFile] = useState<UploadedFile | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('clinics');
  const [privateAppointments, setPrivateAppointments] = useState<PrivateAppointment[]>([]);
  const [loadingPrivate, setLoadingPrivate] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: 'propria' as 'propria' | 'terceirizada',
    address: '',
    notes: '',
    weekdays: [] as string[],
    scheduleTimeStart: '',
    scheduleTimeEnd: '',
    paymentType: '' as '' | 'fixo_mensal' | 'fixo_diario' | 'sessao',
    paymentAmount: '',
    paysOnAbsence: true,
  });

  useEffect(() => {
    if (activeTab === 'particulares') {
      loadPrivateAppointments();
    }
  }, [activeTab]);

  const loadPrivateAppointments = async () => {
    try {
      setLoadingPrivate(true);
      const { data, error } = await supabase
        .from('private_appointments')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: true });

      if (error) throw error;
      setPrivateAppointments(data || []);
    } catch (error) {
      console.error('Error loading private appointments:', error);
    } finally {
      setLoadingPrivate(false);
    }
  };

  const updateAppointmentStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('private_appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      loadPrivateAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
    }
  };

  const togglePaid = async (id: string, currentPaid: boolean) => {
    try {
      const { error } = await supabase
        .from('private_appointments')
        .update({ paid: !currentPaid })
        .eq('id', id);

      if (error) throw error;
      loadPrivateAppointments();
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    addClinic({
      name: formData.name,
      type: formData.type,
      address: formData.address,
      notes: formData.notes,
      weekdays: formData.weekdays,
      scheduleTime: formData.scheduleTimeStart && formData.scheduleTimeEnd 
        ? `${formData.scheduleTimeStart} às ${formData.scheduleTimeEnd}` 
        : '',
      paymentType: formData.paymentType as any,
      paymentAmount: formData.paymentAmount ? parseFloat(formData.paymentAmount) : undefined,
      paysOnAbsence: formData.paysOnAbsence,
      stamp: stampFile?.url,
    });

    setFormData({
      name: '',
      type: 'propria',
      address: '',
      notes: '',
      weekdays: [],
      scheduleTimeStart: '',
      scheduleTimeEnd: '',
      paymentType: '',
      paymentAmount: '',
      paysOnAbsence: true,
    });
    setStampFile(null);
    setIsDialogOpen(false);
  };

  const handleOpenClinic = (clinic: Clinic) => {
    setCurrentClinic(clinic);
    navigate(`/clinics/${clinic.id}`);
  };

  const filteredClinics = clinics.filter(c => 
    filter === 'all' || c.type === filter
  );

  const totalPatients = patients.length;
  const pendingAppointments = privateAppointments.filter(a => a.status === 'agendado');
  const completedAppointments = privateAppointments.filter(a => a.status === 'concluído');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'agendado': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'concluído': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelado': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-foreground mb-1">
          Locais de Atendimento
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas clínicas e atendimentos particulares
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{clinics.length}</p>
              <p className="text-xs text-muted-foreground">Clínicas</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <Users className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalPatients}</p>
              <p className="text-xs text-muted-foreground">Pacientes</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Briefcase className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingAppointments.length}</p>
              <p className="text-xs text-muted-foreground">Particulares</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <DollarSign className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                R$ {privateAppointments.filter(a => a.status === 'concluído').reduce((sum, a) => sum + a.price, 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-muted-foreground">Faturado</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="clinics" className="gap-2">
              <Building2 className="w-4 h-4" />
              Clínicas
            </TabsTrigger>
            <TabsTrigger value="particulares" className="gap-2">
              <Briefcase className="w-4 h-4" />
              Particulares
              {pendingAppointments.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {pendingAppointments.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === 'clinics' ? (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nova Clínica
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Clínica</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Nome da Clínica *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Clínica Viva Bem"
                      required
                    />
                  </div>

                  <div>
                    <Label>Tipo de Vínculo *</Label>
                    <RadioGroup
                      value={formData.type}
                      onValueChange={(v) => setFormData({ ...formData, type: v as any })}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="propria" id="propria" />
                        <Label htmlFor="propria" className="cursor-pointer text-sm">Própria</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="terceirizada" id="terceirizada" />
                        <Label htmlFor="terceirizada" className="cursor-pointer text-sm">Terceirizada</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label>Endereço</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Endereço completo"
                    />
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Anotações internas"
                      rows={2}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-sm font-medium">Dias de Atendimento</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {WEEKDAYS.map((day) => (
                        <label 
                          key={day.value} 
                          className={cn(
                            "flex items-center justify-center px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-sm",
                            formData.weekdays.includes(day.value) 
                              ? "bg-primary text-primary-foreground border-primary" 
                              : "bg-card border-border hover:bg-secondary"
                          )}
                        >
                          <Checkbox
                            checked={formData.weekdays.includes(day.value)}
                            onCheckedChange={(checked) => {
                              setFormData({
                                ...formData,
                                weekdays: checked
                                  ? [...formData.weekdays, day.value]
                                  : formData.weekdays.filter(d => d !== day.value),
                              });
                            }}
                            className="sr-only"
                          />
                          {day.label}
                        </label>
                      ))}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <TimePicker
                        value={formData.scheduleTimeStart}
                        onChange={(time) => setFormData({ ...formData, scheduleTimeStart: time })}
                        label="Início"
                        placeholder="08:00"
                      />
                      <TimePicker
                        value={formData.scheduleTimeEnd}
                        onChange={(time) => setFormData({ ...formData, scheduleTimeEnd: time })}
                        label="Término"
                        placeholder="18:00"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <Label className="text-sm font-medium">Remuneração</Label>
                    <Select
                      value={formData.paymentType}
                      onValueChange={(v) => setFormData({ ...formData, paymentType: v as any })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Tipo de pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixo_mensal">Fixo Mensal</SelectItem>
                        <SelectItem value="fixo_diario">Fixo por Dia</SelectItem>
                        <SelectItem value="sessao">Por Sessão</SelectItem>
                      </SelectContent>
                    </Select>

                    {formData.paymentType && (
                      <div className="mt-3">
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.paymentAmount}
                          onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                          placeholder="Valor (R$)"
                        />
                      </div>
                    )}

                    {formData.paymentType === 'sessao' && (
                      <div className="mt-3 flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                        <span className="text-sm">Recebe por faltas?</span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={formData.paysOnAbsence ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFormData({ ...formData, paysOnAbsence: true })}
                          >
                            Sim
                          </Button>
                          <Button
                            type="button"
                            variant={!formData.paysOnAbsence ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => setFormData({ ...formData, paysOnAbsence: false })}
                          >
                            Não
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Stamp className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">Carimbo</Label>
                    </div>
                    <FileUpload
                      parentType="clinic"
                      parentId="new"
                      existingFiles={stampFile ? [stampFile] : []}
                      onUpload={(files) => setStampFile(files[0])}
                      onRemove={() => setStampFile(null)}
                      accept="image/*"
                      multiple={false}
                      maxFiles={1}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1">
                      Criar Clínica
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <Button size="sm" className="gap-2" onClick={() => setServiceDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Novo Atendimento
            </Button>
          )}
        </div>

        {/* Clinics Tab */}
        <TabsContent value="clinics" className="space-y-4">
          {/* Filter Chips */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'propria', 'terceirizada'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  filter === type 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                )}
              >
                {type === 'all' && `Todas (${clinics.length})`}
                {type === 'propria' && `Próprias (${clinics.filter(c => c.type === 'propria').length})`}
                {type === 'terceirizada' && `Terceirizadas (${clinics.filter(c => c.type === 'terceirizada').length})`}
              </button>
            ))}
          </div>

          {/* Clinics List */}
          {filteredClinics.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma clínica</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Adicione sua primeira clínica ou local de atendimento
              </p>
              <Button onClick={() => setIsDialogOpen(true)} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Clínica
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredClinics.map((clinic) => {
                const patientCount = patients.filter(p => p.clinicId === clinic.id).length;
                const isPropria = clinic.type === 'propria';

                return (
                  <div
                    key={clinic.id}
                    onClick={() => handleOpenClinic(clinic)}
                    className="bg-card rounded-xl border border-border p-4 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground truncate">{clinic.name}</h3>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs shrink-0",
                              isPropria ? "border-primary/50 text-primary" : "border-secondary text-muted-foreground"
                            )}
                          >
                            {isPropria ? 'Própria' : 'Terceirizada'}
                          </Badge>
                        </div>
                        
                        {clinic.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{clinic.address}</span>
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            {patientCount} pac.
                          </span>
                          {clinic.scheduleTime && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span className="truncate max-w-[80px] sm:max-w-none">{clinic.scheduleTime}</span>
                            </span>
                          )}
                          {clinic.paymentAmount && (
                            <span className="flex items-center gap-1 text-success font-medium">
                              <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              R$ {clinic.paymentAmount.toFixed(0)}
                              <span className="hidden sm:inline">{clinic.paymentType === 'sessao' && '/sessão'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Particulares Tab */}
        <TabsContent value="particulares" className="space-y-4">
          {loadingPrivate ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando...
            </div>
          ) : privateAppointments.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum atendimento particular</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Agende seu primeiro atendimento particular
              </p>
              <Button onClick={() => setServiceDialogOpen(true)} size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Atendimento
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {privateAppointments.map((apt) => (
                <div 
                  key={apt.id}
                  className="bg-card rounded-xl border border-border p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <h3 className="font-medium text-foreground text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">{apt.client_name}</h3>
                        <Badge className={cn("text-xs shrink-0", getStatusColor(apt.status))}>
                          {apt.status === 'agendado' && 'Agendado'}
                          {apt.status === 'concluído' && 'Concluído'}
                          {apt.status === 'cancelado' && 'Cancelado'}
                        </Badge>
                        {apt.paid && (
                          <Badge variant="outline" className="text-xs border-success/50 text-success shrink-0">
                            Pago
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {format(new Date(apt.date + 'T00:00:00'), "dd/MM/yy", { locale: ptBR })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          {apt.time}
                        </span>
                        <span className="flex items-center gap-1 text-success font-medium">
                          <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          R$ {apt.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {(apt.client_phone || apt.client_email) && (
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                          {apt.client_phone && (
                            <span className="flex items-center gap-1 truncate">
                              <Phone className="w-3 h-3 shrink-0" />
                              <span className="truncate">{apt.client_phone}</span>
                            </span>
                          )}
                          {apt.client_email && (
                            <span className="flex items-center gap-1 truncate max-w-[180px] sm:max-w-none">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{apt.client_email}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {apt.status === 'agendado' && (
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                          onClick={() => updateAppointmentStatus(apt.id, 'concluído')}
                          title="Marcar como concluído"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => updateAppointmentStatus(apt.id, 'cancelado')}
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {apt.status === 'concluído' && !apt.paid && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-success border-success/50 hover:bg-success/10 text-xs w-full sm:w-auto mt-2 sm:mt-0"
                        onClick={() => togglePaid(apt.id, apt.paid || false)}
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        <span className="sm:hidden">Pago</span>
                        <span className="hidden sm:inline">Confirmar Pagamento</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Service Dialog */}
      <ServiceDialog 
        open={serviceDialogOpen} 
        onOpenChange={(open) => {
          setServiceDialogOpen(open);
          if (!open) loadPrivateAppointments();
        }} 
      />
    </div>
  );
}
