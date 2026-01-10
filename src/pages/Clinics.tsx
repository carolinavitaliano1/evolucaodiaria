import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, Users, MapPin, Clock, DollarSign, Edit, Trash2, Stamp } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { Clinic } from '@/types';

const WEEKDAYS = [
  { value: 'Segunda', label: 'Segunda-feira' },
  { value: 'Terça', label: 'Terça-feira' },
  { value: 'Quarta', label: 'Quarta-feira' },
  { value: 'Quinta', label: 'Quinta-feira' },
  { value: 'Sexta', label: 'Sexta-feira' },
  { value: 'Sábado', label: 'Sábado' },
];

export default function Clinics() {
  const { clinics, patients, addClinic, setCurrentClinic } = useApp();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'propria' | 'terceirizada'>('all');
  const [stampFile, setStampFile] = useState<UploadedFile | null>(null);

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

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="glass-card rounded-3xl p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
                <span className="text-4xl">🏥</span>
                Gestão de Clínicas
              </h1>
              <p className="text-muted-foreground">
                Gerencie seus vínculos profissionais e locais de atendimento
              </p>
            </div>

            <div className="flex gap-4">
              <div className="text-center p-4 rounded-2xl gradient-primary shadow-glow">
                <p className="text-primary-foreground text-sm opacity-90 mb-1">Total de Clínicas</p>
                <p className="text-primary-foreground font-bold text-3xl">{clinics.length}</p>
              </div>
              <div className="text-center p-4 rounded-2xl gradient-secondary">
                <p className="text-primary-foreground text-sm opacity-90 mb-1">Total de Pacientes</p>
                <p className="text-primary-foreground font-bold text-3xl">{totalPatients}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Add Button */}
      <div className="glass-card rounded-2xl p-4 mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'propria', 'terceirizada'] as const).map((type) => (
            <Button
              key={type}
              variant={filter === type ? 'default' : 'outline'}
              className={cn(
                filter === type && 'gradient-primary shadow-glow'
              )}
              onClick={() => setFilter(type)}
            >
              {type === 'all' && `Todas (${clinics.length})`}
              {type === 'propria' && `Próprias (${clinics.filter(c => c.type === 'propria').length})`}
              {type === 'terceirizada' && `Terceirizadas (${clinics.filter(c => c.type === 'terceirizada').length})`}
            </Button>
          ))}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary shadow-glow gap-2">
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
                    <Label htmlFor="propria" className="cursor-pointer">Clínica Própria</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="terceirizada" id="terceirizada" />
                    <Label htmlFor="terceirizada" className="cursor-pointer">Convênio / Terceirizada</Label>
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
                <Label>Observações Internas</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ex: Dias de atendimento, taxas, etc."
                />
              </div>

              <div className="border-t pt-4">
                <p className="font-semibold mb-3">📅 Dias e Horários de Atendimento</p>
                
                <Label>Dias da Semana</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {WEEKDAYS.map((day) => (
                    <label key={day.value} className="flex items-center gap-2 cursor-pointer">
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
                      />
                      <span className="text-sm">{day.label}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <TimePicker
                    value={formData.scheduleTimeStart}
                    onChange={(time) => setFormData({ ...formData, scheduleTimeStart: time })}
                    label="Início"
                    placeholder="Horário inicial"
                  />
                  <TimePicker
                    value={formData.scheduleTimeEnd}
                    onChange={(time) => setFormData({ ...formData, scheduleTimeEnd: time })}
                    label="Término"
                    placeholder="Horário final"
                  />
                </div>
                {formData.scheduleTimeStart && formData.scheduleTimeEnd && (
                  <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-secondary/50 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Funcionamento:</span>
                    <span className="font-semibold text-foreground">
                      {formData.scheduleTimeStart} às {formData.scheduleTimeEnd}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="font-semibold mb-3">💰 Remuneração na Clínica</p>

                <Label>Tipo de Remuneração</Label>
                <Select
                  value={formData.paymentType}
                  onValueChange={(v) => setFormData({ ...formData, paymentType: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-- Não informado --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo_mensal">Salário Fixo Mensal</SelectItem>
                    <SelectItem value="fixo_diario">Salário Fixo por Dia</SelectItem>
                    <SelectItem value="sessao">Valor por Sessão</SelectItem>
                  </SelectContent>
                </Select>

                {formData.paymentType && (
                  <div className="mt-3">
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.paymentAmount}
                      onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                      placeholder="Ex: 3500.00"
                    />
                  </div>
                )}

                {formData.paymentType === 'sessao' && (
                  <div className="mt-4 p-4 rounded-xl bg-secondary/50 border border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Recebe por faltas?</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Você recebe o valor da sessão mesmo quando o paciente falta?
                        </p>
                      </div>
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
                          variant={!formData.paysOnAbsence ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFormData({ ...formData, paysOnAbsence: false })}
                          className={!formData.paysOnAbsence ? "bg-destructive hover:bg-destructive/90" : ""}
                        >
                          Não
                        </Button>
                      </div>
                    </div>
                    {!formData.paysOnAbsence && (
                      <p className="text-sm text-amber-600 mt-2 flex items-center gap-2">
                        ⚠️ Faltas de pacientes aparecerão como perda no financeiro
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="font-semibold mb-3 flex items-center gap-2">
                  <Stamp className="w-4 h-4" />
                  Carimbo para Evoluções
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Adicione um carimbo que aparecerá nas evoluções dos pacientes desta clínica.
                </p>
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
                <Button type="submit" className="flex-1 gradient-primary">
                  Confirmar Cadastro
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Clinics Grid */}
      {filteredClinics.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-3xl">
          <div className="text-8xl mb-6 animate-float">🏥</div>
          <h2 className="text-xl font-bold text-foreground mb-3">Nenhuma clínica cadastrada</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Comece criando sua primeira clínica ou local de atendimento.
          </p>
          <Button onClick={() => setIsDialogOpen(true)} className="gradient-primary shadow-glow gap-2">
            <Plus className="w-4 h-4" />
            Nova Clínica
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClinics.map((clinic, index) => {
            const patientCount = patients.filter(p => p.clinicId === clinic.id).length;
            const isPropria = clinic.type === 'propria';

            return (
              <div
                key={clinic.id}
                className={cn(
                  'rounded-3xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-xl animate-scale-in opacity-0',
                  `stagger-${(index % 5) + 1}`
                )}
                style={{ animationFillMode: 'forwards' }}
                onClick={() => handleOpenClinic(clinic)}
              >
                {/* Header with gradient */}
                <div className={cn(
                  'p-6',
                  isPropria ? 'gradient-primary' : 'gradient-secondary'
                )}>
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-white/20 text-primary-foreground">
                    {isPropria ? 'Clínica Própria' : 'Terceirizada / Convênio'}
                  </span>
                  <h3 className="text-primary-foreground font-bold text-xl mb-2">{clinic.name}</h3>
                  {clinic.address && (
                    <p className="text-primary-foreground/80 text-sm flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {clinic.address}
                    </p>
                  )}
                </div>

                {/* Body */}
                <div className="bg-card p-6 space-y-4">
                  {clinic.paymentAmount && (
                    <div className="p-3 rounded-xl bg-warning/10 border border-warning/20">
                      <p className="text-xs text-muted-foreground mb-1">💼 MINHA REMUNERAÇÃO</p>
                      <p className="text-warning font-bold text-lg">
                        R$ {clinic.paymentAmount.toFixed(2)}
                        {clinic.paymentType === 'fixo_mensal' && '/mês'}
                        {clinic.paymentType === 'fixo_diario' && '/dia'}
                        {clinic.paymentType === 'sessao' && '/sessão'}
                      </p>
                    </div>
                  )}

                  {(clinic.weekdays?.length || clinic.scheduleTime) && (
                    <div className="p-3 rounded-xl bg-secondary space-y-1">
                      {clinic.weekdays?.length && (
                        <p className="text-sm text-foreground flex items-center gap-2">
                          <span>📅</span> {clinic.weekdays.join(', ')}
                        </p>
                      )}
                      {clinic.scheduleTime && (
                        <p className="text-sm text-foreground flex items-center gap-2">
                          <Clock className="w-4 h-4" /> {clinic.scheduleTime}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-muted-foreground" />
                      <span className="text-foreground font-bold text-xl">{patientCount}</span>
                      <span className="text-muted-foreground text-sm">Pacientes</span>
                    </div>
                    <span className="text-xs bg-success/10 text-success px-3 py-1 rounded-full font-semibold">
                      ✓ Ativa
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
