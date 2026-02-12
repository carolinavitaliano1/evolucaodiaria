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
    paymentType: '' as '' | 'fixo_mensal' | 'fixo_diario' | 'sessao',
    paymentAmount: '',
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
        paymentType: (clinic.paymentType || '') as '' | 'fixo_mensal' | 'fixo_diario' | 'sessao',
        paymentAmount: clinic.paymentAmount?.toString() || '',
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
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="propria" id="edit-propria" />
                <Label htmlFor="edit-propria" className="cursor-pointer text-sm">Própria</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="terceirizada" id="edit-terceirizada" />
                <Label htmlFor="edit-terceirizada" className="cursor-pointer text-sm">Terceirizada</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label>Endereço</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Dados Institucionais</Label>
            <div className="space-y-3 mt-2">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contato@clinica.com"
                />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div>
                <Label>Serviços / Especialidades</Label>
                <Input
                  value={formData.servicesDescription}
                  onChange={(e) => setFormData({ ...formData, servicesDescription: e.target.value })}
                  placeholder="Psicologia - Psicopedagogia - Fonoaudiologia"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Dias e Horários de Atendimento</Label>
            <div className="space-y-3 mt-3">
              {WEEKDAYS.map((day) => {
                const isSelected = formData.weekdays.includes(day.value);
                return (
                  <div key={day.value} className="flex items-center gap-3 flex-wrap">
                    <label
                      className={cn(
                        "flex items-center justify-center px-3 py-1.5 rounded-lg border cursor-pointer transition-colors text-sm w-14",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:bg-secondary"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
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
                        className="sr-only"
                      />
                      {day.label}
                    </label>
                    {isSelected && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Entrada:</span>
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
                            className="w-24"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Saída:</span>
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
                            className="w-24"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Remuneração</Label>
            <div className="space-y-3 mt-2">
              <Select
                value={formData.paymentType}
                onValueChange={(v) => setFormData({ ...formData, paymentType: v as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo_mensal">Fixo Mensal</SelectItem>
                  <SelectItem value="fixo_diario">Fixo Diário</SelectItem>
                  <SelectItem value="sessao">Por Sessão</SelectItem>
                </SelectContent>
              </Select>

              {formData.paymentType && (
                <div>
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.paymentAmount}
                    onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Cobrança em Faltas</Label>
            <RadioGroup
              value={formData.absencePaymentType}
              onValueChange={(v) => setFormData({ ...formData, absencePaymentType: v as any })}
              className="mt-2 space-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="always" id="edit-always" />
                <Label htmlFor="edit-always" className="text-sm cursor-pointer">Sempre cobra</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="never" id="edit-never" />
                <Label htmlFor="edit-never" className="text-sm cursor-pointer">Nunca cobra</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="confirmed_only" id="edit-confirmed" />
                <Label htmlFor="edit-confirmed" className="text-sm cursor-pointer">Somente confirmados</Label>
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
