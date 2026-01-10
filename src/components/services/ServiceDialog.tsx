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
import { Briefcase, Calendar, Plus, Trash2, Pencil } from 'lucide-react';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

interface Service {
  id: string;
  name: string;
  type: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

interface PrivateAppointment {
  id: string;
  service_id: string | null;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  date: string;
  time: string;
  price: number;
  status: string;
  notes: string | null;
  paid: boolean;
}

const SERVICE_TYPES = [
  { value: 'atendimento', label: 'Atendimento Particular' },
  { value: 'supervisao', label: 'Supervisão Clínica' },
  { value: 'avaliacao', label: 'Avaliação Psicológica/Fonoaudiológica' },
  { value: 'grupo', label: 'Atendimento em Grupo' },
  { value: 'palestra', label: 'Palestra/Workshop' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'outro', label: 'Outro' },
];

interface ServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServiceDialog({ open, onOpenChange }: ServiceDialogProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('agendar');

  // Service form states
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [serviceType, setServiceType] = useState('atendimento');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceDuration, setServiceDuration] = useState('50');
  const [servicePrice, setServicePrice] = useState('');

  // Appointment form states
  const [selectedService, setSelectedService] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentPrice, setAppointmentPrice] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  useEffect(() => {
    if (open) {
      loadServices();
    }
  }, [open]);

  async function loadServices() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
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
        user_id: DEMO_USER_ID,
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

      const { error } = await supabase
        .from('private_appointments')
        .insert({
          user_id: DEMO_USER_ID,
          service_id: selectedService || null,
          client_name: clientName,
          client_phone: clientPhone || null,
          client_email: clientEmail || null,
          date: appointmentDate,
          time: appointmentTime,
          price: parseFloat(appointmentPrice) || 0,
          notes: appointmentNotes || null,
          status: 'agendado',
          paid: false
        });

      if (error) throw error;

      toast.success('Atendimento agendado!');
      resetAppointmentForm();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error('Erro ao agendar atendimento');
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
            Serviços Particulares
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

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={saveAppointment} disabled={saving}>
                {saving ? 'Salvando...' : 'Agendar'}
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
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="serviceDuration">Duração (min)</Label>
                  <Input
                    id="serviceDuration"
                    type="number"
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="servicePrice">Valor (R$) *</Label>
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
                {editingService && (
                  <Button variant="outline" size="sm" onClick={resetServiceForm}>
                    Cancelar
                  </Button>
                )}
                <Button size="sm" onClick={saveService} disabled={saving}>
                  <Plus className="w-4 h-4 mr-1" />
                  {editingService ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </div>

            {/* Services List */}
            {services.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Serviços Cadastrados</h4>
                <div className="space-y-2">
                  {services.map(service => (
                    <div
                      key={service.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {SERVICE_TYPES.find(t => t.value === service.type)?.label} • {service.duration_minutes}min • R$ {service.price.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => editService(service)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteService(service.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}