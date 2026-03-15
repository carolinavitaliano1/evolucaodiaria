import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Clinic } from '@/types';
import { toast } from 'sonner';

const WEEKDAYS = [
  { value: 'Segunda', label: 'Seg' },
  { value: 'Terça', label: 'Ter' },
  { value: 'Quarta', label: 'Qua' },
  { value: 'Quinta', label: 'Qui' },
  { value: 'Sexta', label: 'Sex' },
  { value: 'Sábado', label: 'Sáb' },
];

interface EditClinicDialogProps {
  clinic: Clinic;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Clinic>) => void;
}

export function EditClinicDialog({ clinic, open, onOpenChange, onSave }: EditClinicDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'propria' as 'propria' | 'terceirizada',
    address: '',
    notes: '',
    email: '',
    cnpj: '',
    phone: '',
    servicesDescription: '',
    weekdays: [] as string[],
    scheduleByDay: {} as { [day: string]: { start: string; end: string } },
    paymentType: '' as '' | 'fixo_mensal' | 'fixo_diario' | 'sessao' | 'variado',
    paymentAmount: '',
    discountPercentage: '',
    absencePaymentType: 'always' as 'always' | 'never' | 'confirmed_only',
  });

  useEffect(() => {
    if (open && clinic) {
      setFormData({
        name: clinic.name || '',
        type: clinic.type || 'propria',
        address: clinic.address || '',
        notes: clinic.notes || '',
        email: clinic.email || '',
        cnpj: clinic.cnpj || '',
        phone: clinic.phone || '',
        servicesDescription: clinic.servicesDescription || '',
        weekdays: clinic.weekdays || [],
        scheduleByDay: (clinic.scheduleByDay || {}) as { [day: string]: { start: string; end: string } },
        paymentType: (clinic.paymentType || '') as '' | 'fixo_mensal' | 'fixo_diario' | 'sessao' | 'variado',
        paymentAmount: clinic.paymentAmount?.toString() || '',
        discountPercentage: clinic.discountPercentage?.toString() || '0',
        absencePaymentType: clinic.absencePaymentType || 'always',
      });
    }
  }, [open, clinic]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const firstDayTime = formData.weekdays.length > 0
      ? formData.scheduleByDay[formData.weekdays[0]]?.start || ''
      : '';

    onSave(clinic.id, {
      name: formData.name,
      type: formData.type,
      address: formData.address || undefined,
      notes: formData.notes || undefined,
      email: formData.email || undefined,
      cnpj: formData.cnpj || undefined,
      phone: formData.phone || undefined,
      servicesDescription: formData.servicesDescription || undefined,
      weekdays: formData.weekdays,
      scheduleTime: firstDayTime || undefined,
      scheduleByDay: formData.scheduleByDay,
      paymentType: formData.paymentType as 'fixo_mensal' | 'fixo_diario' | 'sessao' | undefined,
      paymentAmount: formData.paymentAmount ? parseFloat(formData.paymentAmount) : undefined,
      discountPercentage: formData.discountPercentage ? parseFloat(formData.discountPercentage) : 0,
      paysOnAbsence: formData.absencePaymentType !== 'never',
      absencePaymentType: formData.absencePaymentType,
    });

    toast.success('Clínica atualizada!');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Clínica</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome da Clínica *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Tipo de Vínculo *</Label>
            <RadioGroup
              value={formData.type}
              onValueChange={(v) => setFormData({ ...formData, type: v as any })}
              className="flex gap-4 mt-1"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="propria" id="edit-propria" />
                <Label htmlFor="edit-propria" className="cursor-pointer text-sm">Consultório</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="terceirizada" id="edit-terceirizada" />
                <Label htmlFor="edit-terceirizada" className="cursor-pointer text-sm">Contratante</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@clinica.com"
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>CNPJ</Label>
              <Input
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, cidade"
              />
            </div>
          </div>

          <div>
            <Label>Descrição dos Serviços</Label>
            <Textarea
              value={formData.servicesDescription}
              onChange={(e) => setFormData({ ...formData, servicesDescription: e.target.value })}
              rows={2}
              placeholder="Descreva os serviços oferecidos..."
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          {/* Schedule */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Dias e Horários de Atendimento</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {WEEKDAYS.map((day) => (
                <div key={day.value} className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <Checkbox
                      id={`edit-day-${day.value}`}
                      checked={formData.weekdays.includes(day.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, weekdays: [...formData.weekdays, day.value] });
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
                    <Label htmlFor={`edit-day-${day.value}`} className="text-xs cursor-pointer">{day.label}</Label>
                  </div>
                  {formData.weekdays.includes(day.value) && (
                    <div className="flex flex-col gap-0.5">
                      <Input
                        type="time"
                        value={formData.scheduleByDay[day.value]?.start || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          scheduleByDay: {
                            ...formData.scheduleByDay,
                            [day.value]: {
                              ...formData.scheduleByDay[day.value],
                              start: e.target.value,
                              end: formData.scheduleByDay[day.value]?.end || ''
                            }
                          }
                        })}
                        className="h-7 text-xs w-24"
                      />
                      <Input
                        type="time"
                        value={formData.scheduleByDay[day.value]?.end || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          scheduleByDay: {
                            ...formData.scheduleByDay,
                            [day.value]: {
                              ...formData.scheduleByDay[day.value],
                              start: formData.scheduleByDay[day.value]?.start || '',
                              end: e.target.value,
                            }
                          }
                        })}
                        className="h-7 text-xs w-24"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-medium">Pagamento</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de Pagamento</Label>
                <Select
                  value={formData.paymentType}
                  onValueChange={(v) => setFormData({ ...formData, paymentType: v as any })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sessao">Por sessão</SelectItem>
                    <SelectItem value="fixo_mensal">Fixo mensal</SelectItem>
                    <SelectItem value="fixo_diario">Fixo diário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  value={formData.paymentAmount}
                  onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Porcentagem retida pela clínica</Label>
              <Input
                type="number"
                value={formData.discountPercentage}
                onChange={(e) => setFormData({ ...formData, discountPercentage: e.target.value })}
                placeholder="0"
                className="mt-1"
              />
            </div>
          </div>

          {/* Absence payment */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Cobrança em Faltas</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Define se você recebe pagamento quando o paciente falta a sessão nesta clínica.
            </p>
            <RadioGroup
              value={formData.absencePaymentType}
              onValueChange={(v) => setFormData({ ...formData, absencePaymentType: v as any })}
              className="space-y-2"
            >
              <div className={cn('flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors', formData.absencePaymentType === 'always' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                <RadioGroupItem value="always" id="edit-always" className="mt-0.5" />
                <Label htmlFor="edit-always" className="cursor-pointer flex-1">
                  <span className="font-medium text-sm">Sempre cobra</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Você recebe por todas as faltas, independentemente de aviso prévio.</p>
                </Label>
              </div>
              <div className={cn('flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors', formData.absencePaymentType === 'never' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                <RadioGroupItem value="never" id="edit-never" className="mt-0.5" />
                <Label htmlFor="edit-never" className="cursor-pointer flex-1">
                  <span className="font-medium text-sm">Nunca cobra</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Faltas não são cobradas. Você só recebe pelas sessões realizadas.</p>
                </Label>
              </div>
              <div className={cn('flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors', formData.absencePaymentType === 'confirmed_only' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                <RadioGroupItem value="confirmed_only" id="edit-confirmed" className="mt-0.5" />
                <Label htmlFor="edit-confirmed" className="cursor-pointer flex-1">
                  <span className="font-medium text-sm">Somente confirmados</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Cobra apenas faltas em que o paciente confirmou presença e não compareceu.</p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar Alterações</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
