import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Briefcase, Calendar, MapPin, Plus, Trash2, Pencil } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';

interface Service {
  id: string;
  name: string;
  type: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

interface ClinicOption {
  id: string;
  name: string;
}

import { PrivateAppointment } from '@/hooks/usePrivateAppointments';

const SERVICE_TYPES = [
  { value: 'atendimento', label: 'Atendimento' },
  { value: 'supervisao', label: 'Supervisão Clínica' },
  { value: 'avaliacao', label: 'Avaliação Psicológica/Fonoaudiológica' },
  { value: 'grupo', label: 'Atendimento em Grupo' },
  { value: 'palestra', label: 'Palestra/Workshop' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'outro', label: 'Outro' },
];

const INITIAL_CUSTOM_TYPES: string[] = [];

interface PatientOption { id: string; name: string; phone: string | null; responsible_email: string | null; }

interface ServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editAppointment?: PrivateAppointment | null;
  onAppointmentSaved?: () => void;
  /** Pre-select and lock the clinic for new appointments */
  clinicId?: string;
}

export function ServiceDialog({ open, onOpenChange, editAppointment, onAppointmentSaved, clinicId }: ServiceDialogProps) {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('servicos');
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [newCustomType, setNewCustomType] = useState('');
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);
  const [propriaClinics, setPropriaClinics] = useState<ClinicOption[]>([]);
  const [clinicPatients, setClinicPatients] = useState<PatientOption[]>([]);

  // Service form states
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceType, setServiceType] = useState('atendimento');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceDuration, setServiceDuration] = useState('50');
  const [servicePrice, setServicePrice] = useState('');

  // Appointment form states
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentPrice, setAppointmentPrice] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState('agendado');
  const [appointmentPaid, setAppointmentPaid] = useState(false);

  useEffect(() => {
    if (open) {
      loadServices();
      loadCustomTypes();
      loadPropriaClinics();
      if (clinicId) loadClinicPatients(clinicId);
      // Pre-fill form if editing an appointment
      if (editAppointment) {
        setActiveTab('agendar');
        setEditingAppointmentId(editAppointment.id);
        setSelectedService(editAppointment.service_id || '');
        setSelectedClinicId((editAppointment as any).clinic_id || clinicId || '');
        setClientName(editAppointment.client_name);
        setClientPhone(editAppointment.client_phone || '');
        setClientEmail(editAppointment.client_email || '');
        setAppointmentDate(editAppointment.date);
        setAppointmentTime(editAppointment.time);
        setAppointmentPrice(editAppointment.price.toString());
        setAppointmentNotes(editAppointment.notes || '');
        setAppointmentStatus(editAppointment.status);
        setAppointmentPaid(editAppointment.paid || false);
      } else {
        setEditingAppointmentId(null);
        setActiveTab(clinicId ? 'agendar' : 'servicos');
        setSelectedClinicId(clinicId || '');
      }
    }
  }, [open, editAppointment, clinicId]);

  async function loadClinicPatients(cid: string) {
    const { data } = await supabase
      .from('patients')
      .select('id, name, phone, responsible_email')
      .eq('clinic_id', cid)
      .eq('is_archived', false)
      .order('name');
    if (data) setClinicPatients(data as PatientOption[]);
  }

  function handlePatientSelect(patientId: string) {
    const p = clinicPatients.find(pt => pt.id === patientId);
    if (!p) return;
    setClientName(p.name);
    setClientPhone(p.phone || '');
    setClientEmail(p.responsible_email || '');
  }

  async function loadPropriaClinics() {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      const { data } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('user_id', u.id)
        .eq('type', 'propria')
        .eq('is_archived', false)
        .order('name');
      if (data) setPropriaClinics(data);
    } catch {}
  }

  async function loadCustomTypes() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('custom_service_types' as any)
        .select('name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setCustomTypes((data || []).map((d: any) => d.name));
    } catch (error) {
      console.error('Error loading custom types:', error);
    }
  }

  async function loadServices() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleServiceSelect(serviceId: string) {
    setSelectedService(serviceId);
    const service = services.find(s => s.id === serviceId);
    if (service) {
      setAppointmentPrice(service.price.toString());
    }
  }

  function resetServiceForm() {
    setEditingService(null);
    setServiceName('');
    setServiceType('atendimento');
    setServiceDescription('');
    setServiceDuration('50');
    setServicePrice('');
  }

  function resetAppointmentForm() {
    setSelectedService('');
    setSelectedClinicId(clinicId || '');
    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentPrice('');
    setAppointmentNotes('');
  }

  function editService(service: Service) {
    setEditingService(service);
    setServiceName(service.name);
    setServiceType(service.type);
    setServiceDescription(service.description || '');
    setServiceDuration(service.duration_minutes.toString());
    setServicePrice(service.price.toString());
    setActiveTab('servicos');
  }

  async function saveService() {
    try {
      setSaving(true);

      if (!serviceName) {
        toast.error('Preencha o nome do serviço');
        return;
      }

      const serviceData = {
        user_id: user?.id!,
        name: serviceName,
        type: serviceType,
        description: serviceDescription || null,
        duration_minutes: parseInt(serviceDuration) || 50,
        price: parseFloat(servicePrice) || 0,
        is_active: true
      };

      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id);

        if (error) throw error;
        toast.success('Serviço atualizado!');
      } else {
        const { error } = await supabase
          .from('services')
          .insert(serviceData);

        if (error) throw error;
        toast.success('Serviço cadastrado!');
      }

      resetServiceForm();
      loadServices();
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Erro ao salvar serviço');
    } finally {
      setSaving(false);
    }
  }

  async function deleteService(serviceId: string) {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: false })
        .eq('id', serviceId);

      if (error) throw error;
      toast.success('Serviço removido');
      loadServices();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Erro ao remover serviço');
    }
  }

  async function saveAppointment() {
    try {
      setSaving(true);

      if (!clientName || !appointmentDate || !appointmentTime) {
        toast.error('Preencha nome, data e horário');
        return;
      }

      const appointmentData: any = {
        service_id: selectedService || null,
        clinic_id: selectedClinicId || null,
        client_name: clientName,
        client_phone: clientPhone || null,
        client_email: clientEmail || null,
        date: appointmentDate,
        time: appointmentTime,
        price: parseFloat(appointmentPrice) || 0,
        notes: appointmentNotes || null,
        status: appointmentStatus,
        paid: appointmentPaid,
      };

      if (editingAppointmentId) {
        const { error } = await supabase
          .from('private_appointments')
          .update(appointmentData)
          .eq('id', editingAppointmentId);
        if (error) throw error;
        toast.success('Atendimento atualizado!');
      } else {
        const { error } = await supabase
          .from('private_appointments')
          .insert({ ...appointmentData, user_id: user?.id! });
        if (error) throw error;
        toast.success('Atendimento agendado!');
      }

      resetAppointmentForm();
      onAppointmentSaved?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error('Erro ao salvar atendimento');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Serviços
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="agendar">
              <Calendar className="w-4 h-4 mr-2" />
              Agendar
            </TabsTrigger>
            <TabsTrigger value="servicos">
              <Briefcase className="w-4 h-4 mr-2" />
              Meus Serviços
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agendar" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              <Select value={selectedService} onValueChange={handleServiceSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - R$ {service.price.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {services.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum serviço cadastrado. Vá em "Meus Serviços" para adicionar.
                </p>
              )}
            </div>

            {/* Clinic selector — hidden when clinicId is fixed */}
            {!clinicId && propriaClinics.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Local (Clínica Própria)
                </Label>
                <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum local vinculado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum local</SelectItem>
                    {propriaClinics.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {clinicId && propriaClinics.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm text-primary">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{propriaClinics.find(c => c.id === clinicId)?.name ?? 'Clínica vinculada'}</span>
              </div>
            )}

            {/* Patient selector — only when coming from a clinic */}
            {clinicId && clinicPatients.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Paciente cadastrado nesta clínica
                </Label>
                <Select onValueChange={handlePatientSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar paciente (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinicPatients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Preenche os campos abaixo automaticamente</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="clientName">Nome do Cliente *</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Telefone</Label>
                <Input
                  id="clientPhone"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">E-mail</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appointmentDate">Data *</Label>
                <Input
                  id="appointmentDate"
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointmentTime">Horário *</Label>
                <Input
                  id="appointmentTime"
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appointmentPrice">Valor (R$)</Label>
              <Input
                id="appointmentPrice"
                type="number"
                step="0.01"
                value={appointmentPrice}
                onChange={(e) => setAppointmentPrice(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appointmentNotes">Observações</Label>
              <Textarea
                id="appointmentNotes"
                value={appointmentNotes}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                placeholder="Notas sobre o atendimento..."
                rows={2}
              />
            </div>

            {editingAppointmentId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={appointmentStatus} onValueChange={setAppointmentStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="realizado">Realizado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pagamento</Label>
                  <Select value={appointmentPaid ? 'pago' : 'pendente'} onValueChange={v => setAppointmentPaid(v === 'pago')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={saveAppointment} disabled={saving}>
                {saving ? 'Salvando...' : editingAppointmentId ? 'Salvar Alterações' : 'Agendar'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="servicos" className="space-y-4 mt-4">
            {/* Service Form */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <h4 className="font-medium text-sm">
                {editingService ? 'Editar Serviço' : 'Novo Serviço'}
              </h4>
              
              <div className="space-y-2">
                <Label htmlFor="serviceName">Nome do Serviço *</Label>
                <Input
                  id="serviceName"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="Ex: Atendimento Individual"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={serviceType} onValueChange={(val) => {
                  if (val === 'outro') {
                    setShowCustomTypeInput(true);
                  } else {
                    setServiceType(val);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.filter(t => t.value !== 'outro').map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                    {customTypes.map(ct => (
                      <SelectItem key={ct} value={ct}>
                        {ct}
                      </SelectItem>
                    ))}
                    <SelectItem value="outro">+ Outro (cadastrar novo tipo)</SelectItem>
                  </SelectContent>
                </Select>

                {showCustomTypeInput && (
                  <div className="flex gap-2 items-end mt-2 p-3 border rounded-lg bg-muted/30">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Nome do novo tipo</Label>
                      <Input
                        value={newCustomType}
                        onChange={e => setNewCustomType(e.target.value)}
                        placeholder="Ex: Orientação Parental"
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={async () => {
                        if (!newCustomType.trim()) return;
                        const { data: { user: u } } = await supabase.auth.getUser();
                        if (!u) return;
                        await supabase.from('custom_service_types' as any).insert({ user_id: u.id, name: newCustomType.trim() });
                        setCustomTypes(prev => [...prev, newCustomType.trim()]);
                        setServiceType(newCustomType.trim());
                        setNewCustomType('');
                        setShowCustomTypeInput(false);
                      }}
                    >
                      Adicionar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowCustomTypeInput(false)}>
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="serviceDuration">Duração (min)</Label>
                  <Input
                    id="serviceDuration"
                    type="number"
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(e.target.value)}
                    placeholder="50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="servicePrice">Valor (R$)</Label>
                  <Input
                    id="servicePrice"
                    type="number"
                    step="0.01"
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceDescription">Descrição</Label>
                <Textarea
                  id="serviceDescription"
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  placeholder="Descrição do serviço..."
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={saveService} disabled={saving} className="flex-1">
                  {saving ? 'Salvando...' : editingService ? 'Salvar' : 'Cadastrar Serviço'}
                </Button>
                {editingService && (
                  <Button variant="outline" onClick={resetServiceForm}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>

            {/* Services List */}
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
            ) : services.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum serviço cadastrado ainda.</p>
            ) : (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Serviços cadastrados</h4>
                {services.map(service => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {service.duration_minutes}min · R$ {service.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => editService(service)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteService(service.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
