import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Patient, ClinicPackage } from '@/types';
import { toast } from 'sonner';

const WEEKDAYS = [
  { value: 'Segunda', label: 'Seg' },
  { value: 'Terça', label: 'Ter' },
  { value: 'Quarta', label: 'Qua' },
  { value: 'Quinta', label: 'Qui' },
  { value: 'Sexta', label: 'Sex' },
  { value: 'Sábado', label: 'Sáb' },
];

interface EditPatientDialogProps {
  patient: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Patient>) => void;
  clinicPackages?: ClinicPackage[];
}

export function EditPatientDialog({ patient, open, onOpenChange, onSave, clinicPackages = [] }: EditPatientDialogProps) {
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
    paymentType: '' as '' | 'sessao' | 'fixo',
    paymentValue: '',
    packageId: '',
  });

  useEffect(() => {
    if (open && patient) {
      setFormData({
        name: patient.name || '',
        birthdate: patient.birthdate || '',
        phone: patient.phone || '',
        clinicalArea: patient.clinicalArea || '',
        diagnosis: patient.diagnosis || '',
        professionals: patient.professionals || '',
        observations: patient.observations || '',
        responsibleName: patient.responsibleName || '',
        responsibleEmail: patient.responsibleEmail || '',
        contractStartDate: patient.contractStartDate || '',
        weekdays: patient.weekdays || [],
        scheduleByDay: (patient.scheduleByDay || {}) as { [day: string]: { start: string; end: string } },
        paymentType: (patient.paymentType || '') as '' | 'sessao' | 'fixo',
        paymentValue: patient.paymentValue?.toString() || '',
        packageId: patient.packageId || '',
      });
    }
  }, [open, patient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.birthdate) return;

    const firstDayTime = formData.weekdays.length > 0
      ? formData.scheduleByDay[formData.weekdays[0]]?.start || ''
      : '';

    onSave(patient.id, {
      name: formData.name,
      birthdate: formData.birthdate,
      phone: formData.phone || undefined,
      clinicalArea: formData.clinicalArea || undefined,
      diagnosis: formData.diagnosis || undefined,
      professionals: formData.professionals || undefined,
      observations: formData.observations || undefined,
      responsibleName: formData.responsibleName || undefined,
      responsibleEmail: formData.responsibleEmail || undefined,
      contractStartDate: formData.contractStartDate || undefined,
      weekdays: formData.weekdays,
      scheduleTime: firstDayTime || undefined,
      scheduleByDay: formData.scheduleByDay,
      paymentType: formData.paymentType as 'sessao' | 'fixo' | undefined,
      paymentValue: formData.paymentValue ? parseFloat(formData.paymentValue) : undefined,
      packageId: formData.packageId || undefined,
    });

    toast.success('Paciente atualizado!');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Paciente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Área Clínica</Label>
              <Input
                value={formData.clinicalArea}
                onChange={(e) => setFormData({ ...formData, clinicalArea: e.target.value })}
              />
            </div>
            <div>
              <Label>Profissionais</Label>
              <Input
                value={formData.professionals}
                onChange={(e) => setFormData({ ...formData, professionals: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Diagnóstico</Label>
            <Textarea
              value={formData.diagnosis}
              onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              rows={2}
            />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.observations}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              rows={2}
            />
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Responsável</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  value={formData.responsibleName}
                  onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={formData.responsibleEmail}
                  onChange={(e) => setFormData({ ...formData, responsibleEmail: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Contrato</Label>
            <div className="mt-2">
              <Label className="text-xs">Data de Início</Label>
              <Input
                type="date"
                value={formData.contractStartDate}
                onChange={(e) => setFormData({ ...formData, contractStartDate: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Dias e Horários</Label>
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
            <Label className="text-sm font-medium">Financeiro</Label>
            <div className="space-y-3 mt-2">
              {clinicPackages.length > 0 && (
                <div>
                  <Label className="text-xs">Pacote</Label>
                  <Select
                    value={formData.packageId}
                    onValueChange={(v) => {
                      const pkg = clinicPackages.find(p => p.id === v);
                      setFormData({
                        ...formData,
                        packageId: v,
                        paymentValue: pkg ? pkg.price.toString() : formData.paymentValue,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um pacote" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem pacote</SelectItem>
                      {clinicPackages.filter(p => p.isActive).map(pkg => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.name} - R$ {pkg.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={formData.paymentType}
                    onValueChange={(v) => setFormData({ ...formData, paymentType: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sessao">Por Sessão</SelectItem>
                      <SelectItem value="fixo">Fixo Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.paymentValue}
                    onChange={(e) => setFormData({ ...formData, paymentValue: e.target.value })}
                  />
                </div>
              </div>
            </div>
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
