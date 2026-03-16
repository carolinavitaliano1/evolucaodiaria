import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Patient, ClinicPackage } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';

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
  clinicType?: 'propria' | 'terceirizada';
}

export function EditPatientDialog({ patient, open, onOpenChange, onSave, clinicPackages = [], clinicType }: EditPatientDialogProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    birthdate: '',
    cpf: '',
    phone: '',
    whatsapp: '',
    email: '',
    clinicalArea: '',
    diagnosis: '',
    professionals: '',
    observations: '',
    responsibleName: '',
    responsibleEmail: '',
    responsibleWhatsapp: '',
    responsibleCpf: '',
    responsibleIsFinancial: true,
    financialResponsibleName: '',
    financialResponsibleCpf: '',
    financialResponsibleWhatsapp: '',
    contractStartDate: '',
    weekdays: [] as string[],
    scheduleByDay: {} as { [day: string]: { start: string; end: string } },
    paymentType: '' as '' | 'sessao' | 'fixo',
    paymentValue: '',
    packageId: '',
    paymentDueDay: '',
    paymentInfo: '',
  });

  // Payment status for current month (propria only)
  const [currentPaymentRecord, setCurrentPaymentRecord] = useState<any>(null);
  const [initialPaymentStatus, setInitialPaymentStatus] = useState(false);
  const [initialPaymentDate, setInitialPaymentDate] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const isPropria = clinicType === 'propria';
  const isTerceirizada = clinicType === 'terceirizada';
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (open && patient) {
      const p = patient as any;
      setFormData({
        name: patient.name || '',
        birthdate: patient.birthdate || '',
        cpf: p.cpf || '',
        phone: patient.phone || '',
        whatsapp: patient.whatsapp || '',
        email: p.email || '',
        clinicalArea: patient.clinicalArea || '',
        diagnosis: patient.diagnosis || '',
        professionals: patient.professionals || '',
        observations: patient.observations || '',
        responsibleName: patient.responsibleName || '',
        responsibleEmail: patient.responsibleEmail || '',
        responsibleWhatsapp: patient.responsibleWhatsapp || '',
        responsibleCpf: p.responsible_cpf || '',
        responsibleIsFinancial: p.responsible_is_financial !== false,
        financialResponsibleName: p.financial_responsible_name || '',
        financialResponsibleCpf: p.financial_responsible_cpf || '',
        financialResponsibleWhatsapp: p.financial_responsible_whatsapp || '',
        contractStartDate: patient.contractStartDate || '',
        weekdays: patient.weekdays || [],
        scheduleByDay: (patient.scheduleByDay || {}) as { [day: string]: { start: string; end: string } },
        paymentType: (patient.paymentType || '') as '' | 'sessao' | 'fixo',
        paymentValue: patient.paymentValue?.toString() || '',
        packageId: patient.packageId || '',
        paymentDueDay: p.payment_due_day?.toString() || '',
        paymentInfo: p.payment_info || '',
      });

      // Load current month payment record for propria
      if (isPropria && user) {
        supabase
          .from('patient_payment_records' as any)
          .select('*')
          .eq('patient_id', patient.id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .maybeSingle()
          .then(({ data }) => {
            setCurrentPaymentRecord(data);
            setInitialPaymentStatus((data as any)?.paid || false);
            setInitialPaymentDate((data as any)?.payment_date || '');
          });
      }
    }
  }, [open, patient, isPropria, user]);

  const handleSavePaymentRecord = async (paid: boolean, paymentDate: string) => {
    if (!user || !isPropria) return;
    setSavingPayment(true);
    try {
      const revenue = patient.paymentValue || 0;
      if (currentPaymentRecord?.id) {
        await supabase.from('patient_payment_records' as any).update({
          paid,
          payment_date: paid ? (paymentDate || new Date().toISOString().split('T')[0]) : null,
        }).eq('id', currentPaymentRecord.id);
      } else {
        const { data } = await supabase.from('patient_payment_records' as any).insert({
          user_id: user.id,
          patient_id: patient.id,
          clinic_id: patient.clinicId,
          month: currentMonth,
          year: currentYear,
          amount: revenue,
          paid,
          payment_date: paid ? (paymentDate || new Date().toISOString().split('T')[0]) : null,
        }).select().maybeSingle();
        setCurrentPaymentRecord(data);
      }
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.birthdate) return;

    const firstDayTime = formData.weekdays.length > 0
      ? formData.scheduleByDay[formData.weekdays[0]]?.start || ''
      : '';

    onSave(patient.id, {
      name: formData.name,
      birthdate: formData.birthdate,
      ...(formData.cpf !== undefined && { cpf: formData.cpf } as any),
      ...(formData.email !== undefined && { email: formData.email } as any),
      phone: formData.phone || undefined,
      whatsapp: formData.whatsapp || undefined,
      clinicalArea: formData.clinicalArea || undefined,
      diagnosis: formData.diagnosis || undefined,
      professionals: formData.professionals || undefined,
      observations: formData.observations || undefined,
      responsibleName: formData.responsibleName || undefined,
      responsibleEmail: formData.responsibleEmail || undefined,
      responsibleWhatsapp: formData.responsibleWhatsapp || undefined,
      ...(formData.responsibleCpf && { responsible_cpf: formData.responsibleCpf } as any),
      responsible_is_financial: formData.responsibleIsFinancial,
      financial_responsible_name: formData.financialResponsibleName || null,
      financial_responsible_cpf: formData.financialResponsibleCpf || null,
      financial_responsible_whatsapp: formData.financialResponsibleWhatsapp || null,
      contractStartDate: formData.contractStartDate || undefined,
      weekdays: formData.weekdays,
      scheduleTime: firstDayTime || undefined,
      scheduleByDay: formData.scheduleByDay,
      paymentType: formData.paymentType as 'sessao' | 'fixo' | undefined,
      paymentValue: formData.paymentValue ? parseFloat(formData.paymentValue) : undefined,
      packageId: formData.packageId || undefined,
      ...(formData.paymentDueDay && { payment_due_day: parseInt(formData.paymentDueDay) } as any),
      payment_info: formData.paymentInfo || null,
    } as any);

    // Save payment record if propria and status changed
    if (isPropria) {
      const wasPaid = currentPaymentRecord?.paid || false;
      if (initialPaymentStatus !== wasPaid || initialPaymentDate !== (currentPaymentRecord?.payment_date || '')) {
        // already saved via toggle, no need to re-save
      }
    }

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CPF / CNPJ</Label>
              <Input
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1.5">
                <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                WhatsApp do Paciente
              </Label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
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
            <Label className="text-sm font-medium">Responsável Legal</Label>
            <p className="text-xs text-muted-foreground mb-3">Preencha se o paciente for menor de 18 anos ou tiver representante legal.</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome do Responsável</Label>
                  <Input
                    value={formData.responsibleName}
                    onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label className="text-xs">CPF do Responsável</Label>
                  <Input
                    value={formData.responsibleCpf}
                    onChange={(e) => setFormData({ ...formData, responsibleCpf: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">E-mail do Responsável</Label>
                <Input
                  type="email"
                  value={formData.responsibleEmail}
                  onChange={(e) => setFormData({ ...formData, responsibleEmail: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  <WhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                  WhatsApp do Responsável
                </Label>
                <Input
                  value={formData.responsibleWhatsapp}
                  onChange={(e) => setFormData({ ...formData, responsibleWhatsapp: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>

              {/* Financial responsible toggle */}
              {formData.responsibleName && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-foreground">Responsável financeiro</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formData.responsibleIsFinancial
                          ? 'O responsável legal acima é também o responsável financeiro'
                          : 'Há um responsável financeiro diferente do responsável legal'}
                      </p>
                    </div>
                    <Switch
                      checked={formData.responsibleIsFinancial}
                      onCheckedChange={(v) => setFormData({ ...formData, responsibleIsFinancial: v, financialResponsibleName: '', financialResponsibleCpf: '', financialResponsibleWhatsapp: '' })}
                    />
                  </div>

                  {!formData.responsibleIsFinancial && (
                    <div className="space-y-2 pt-1 border-t border-border">
                      <p className="text-xs font-medium text-foreground">Dados do Responsável Financeiro</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Nome *</Label>
                          <Input
                            value={formData.financialResponsibleName}
                            onChange={(e) => setFormData({ ...formData, financialResponsibleName: e.target.value })}
                            placeholder="Nome completo"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">CPF</Label>
                          <Input
                            value={formData.financialResponsibleCpf}
                            onChange={(e) => setFormData({ ...formData, financialResponsibleCpf: e.target.value })}
                            placeholder="000.000.000-00"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs flex items-center gap-1.5">
                          <WhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                          WhatsApp
                        </Label>
                        <Input
                          value={formData.financialResponsibleWhatsapp}
                          onChange={(e) => setFormData({ ...formData, financialResponsibleWhatsapp: e.target.value })}
                          placeholder="(11) 99999-9999"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
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

          {!isTerceirizada && (
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

              <div>
                <Label className="text-xs flex items-center gap-1">
                  Dia de Vencimento
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Ex: 10"
                  value={formData.paymentDueDay}
                  onChange={(e) => setFormData({ ...formData, paymentDueDay: e.target.value })}
                />
                {formData.paymentDueDay && (
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    🔔 O dashboard avisará 3 dias antes com botão de WhatsApp
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1">
                  Chave PIX / Dados de pagamento (visível no portal do paciente)
                </Label>
                <Textarea
                  placeholder="Ex: PIX: 11999998888 (CPF) — Banco Nubank&#10;Ou TED: Ag 0001 / CC 123456-7"
                  value={formData.paymentInfo}
                  onChange={(e) => setFormData({ ...formData, paymentInfo: e.target.value })}
                  className="resize-none text-sm min-h-[72px]"
                />
                {formData.paymentInfo && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    📲 O paciente verá esses dados no app para efetuar o pagamento
                  </p>
                )}
              </div>
            </div>
          </div>
          )}

          {isPropria && (
            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Status do Pagamento (mês atual)</Label>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-secondary/40 border border-border/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {currentPaymentRecord?.paid ? '✅ Pago' : '⏳ Pendente'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <Switch
                    checked={currentPaymentRecord?.paid || false}
                    disabled={savingPayment}
                    onCheckedChange={async (checked) => {
                      const dateVal = checked ? new Date().toISOString().split('T')[0] : '';
                      setCurrentPaymentRecord((prev: any) => ({ ...(prev || {}), paid: checked, payment_date: dateVal || null }));
                      await handleSavePaymentRecord(checked, dateVal);
                    }}
                  />
                </div>
                {currentPaymentRecord?.paid && (
                  <div>
                    <Label className="text-xs">Data do Pagamento</Label>
                    <Input
                      type="date"
                      value={currentPaymentRecord?.payment_date || ''}
                      onChange={async (e) => {
                        const d = e.target.value;
                        setCurrentPaymentRecord((prev: any) => ({ ...prev, payment_date: d }));
                        await handleSavePaymentRecord(true, d);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

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
