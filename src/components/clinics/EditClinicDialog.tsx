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
import { Upload, X } from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
  onSave: (id: string, updates: Partial<Clinic>) => Promise<void> | void;
}

export function EditClinicDialog({ clinic, open, onOpenChange, onSave }: EditClinicDialogProps) {
  const { hasTeam } = useFeatureAccess();
  const { user } = useAuth();
  const forceIndividualPro = user?.email === 'carolinavitaliano1@gmail.com';
  const canCreateClinica = hasTeam && !forceIndividualPro;
  const isClinicaProOnly = canCreateClinica;
  const [formData, setFormData] = useState({
    name: '',
    type: 'propria' as 'propria' | 'terceirizada' | 'clinica',
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
    absenceChargeMode: 'integral' as 'integral' | 'parcial',
    absenceChargeAmount: '',
    letterhead: '' as string,
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
        absenceChargeMode: (clinic.absenceChargeMode as 'integral' | 'parcial') || 'integral',
        absenceChargeAmount: clinic.absenceChargeAmount != null ? String(clinic.absenceChargeAmount) : '',
        letterhead: (clinic as any).letterhead || '',
      });
    }
  }, [open, clinic]);

  const [saving, setSaving] = useState(false);

  const handleLetterheadUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem (PNG ou JPG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 2MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, letterhead: reader.result as string }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const firstDayTime = formData.weekdays.length > 0
      ? formData.scheduleByDay[formData.weekdays[0]]?.start || ''
      : '';

    setSaving(true);
    try {
      const newPaymentAmount = formData.type === 'terceirizada' && formData.paymentAmount
        ? parseFloat(formData.paymentAmount)
        : undefined;
      const oldPaymentAmount = clinic.paymentAmount ?? undefined;
      const newPaymentType = formData.type === 'terceirizada' ? formData.paymentType : undefined;

      await onSave(clinic.id, {
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
        paymentType: formData.type === 'terceirizada'
          ? (formData.paymentType as 'fixo_mensal' | 'fixo_diario' | 'sessao' | undefined)
          : undefined,
        paymentAmount: newPaymentAmount,
        discountPercentage: formData.type === 'terceirizada' && formData.discountPercentage
          ? parseFloat(formData.discountPercentage)
          : 0,
        paysOnAbsence: formData.absencePaymentType !== 'never',
        absencePaymentType: formData.absencePaymentType,
        absenceChargeMode: formData.absenceChargeMode,
        absenceChargeAmount: formData.absenceChargeMode === 'parcial' && formData.absenceChargeAmount
          ? parseFloat(formData.absenceChargeAmount)
          : undefined,
        letterhead: formData.letterhead || undefined,
      });

      // Propaga novo valor de repasse para pacientes vinculados (Contratante / por sessão)
      if (
        formData.type === 'terceirizada' &&
        newPaymentType === 'sessao' &&
        typeof newPaymentAmount === 'number' &&
        newPaymentAmount !== oldPaymentAmount
      ) {
        const { data: linked, error: fetchErr } = await supabase
          .from('patients')
          .select('id, payment_value')
          .eq('clinic_id', clinic.id)
          .eq('payment_type', 'sessao')
          .is('package_id', null)
          .or('is_archived.is.null,is_archived.eq.false');

        if (!fetchErr && linked && linked.length > 0) {
          const toUpdate = linked.filter(p => Number(p.payment_value) !== newPaymentAmount);
          if (toUpdate.length > 0) {
            const { error: updErr } = await supabase
              .from('patients')
              .update({ payment_value: newPaymentAmount })
              .in('id', toUpdate.map(p => p.id));
            if (updErr) {
              console.error(updErr);
              toast.warning(`Clínica salva, mas falhou ao sincronizar ${toUpdate.length} paciente(s).`);
            } else {
              toast.success(`Clínica atualizada! Valor de repasse sincronizado em ${toUpdate.length} paciente(s).`);
            }
          } else {
            toast.success('Clínica atualizada!');
          }
        } else {
          toast.success('Clínica atualizada!');
        }
      } else {
        toast.success('Clínica atualizada!');
      }

      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar clínica');
    } finally {
      setSaving(false);
    }
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

          {!isClinicaProOnly && (
            <div>
              <Label>Tipo de Vínculo *</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as any })}
                className="flex gap-4 mt-1 flex-wrap"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="propria" id="edit-propria" />
                  <Label htmlFor="edit-propria" className="cursor-pointer text-sm">Consultório</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="clinica" id="edit-clinica" />
                  <Label htmlFor="edit-clinica" className="cursor-pointer text-sm">Clínica</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="terceirizada" id="edit-terceirizada" />
                  <Label htmlFor="edit-terceirizada" className="cursor-pointer text-sm">Contratante</Label>
                </div>
              </RadioGroup>
              {formData.type === 'clinica' && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                  🏥 Modalidade que permite usar a Gestão de Equipe para convidar terapeutas e colaboradores.
                </p>
              )}
            </div>
          )}

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
            <Label>{clinic?.type === 'clinica' ? 'Descrição dos Procedimentos' : 'Descrição dos Serviços'}</Label>
            <Textarea
              value={formData.servicesDescription}
              onChange={(e) => setFormData({ ...formData, servicesDescription: e.target.value })}
              rows={2}
              placeholder={clinic?.type === 'clinica' ? 'Descreva os procedimentos oferecidos...' : 'Descreva os serviços oferecidos...'}
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
            <Label className="text-sm font-medium">Timbrado da Clínica</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Imagem aplicada como cabeçalho nos PDFs gerados (relatórios, recibos, fichas). Use uma imagem horizontal (ex: 1200×300px), PNG ou JPG, até 2MB.
            </p>
            {formData.letterhead ? (
              <div className="relative inline-block">
                <img loading="lazy" decoding="async"
                  src={formData.letterhead}
                  alt="Timbrado"
                  className="max-h-24 rounded-md border border-border bg-background"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={() => setFormData({ ...formData, letterhead: '' })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="edit-letterhead-upload"
                className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors text-sm text-muted-foreground"
              >
                <Upload className="h-4 w-4" />
                Enviar imagem do timbrado
                <input
                  id="edit-letterhead-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleLetterheadUpload}
                  className="hidden"
                />
              </label>
            )}
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

          {/* Payment - only for Contratante (terceirizada) */}
          {formData.type === 'terceirizada' && (
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
                      <SelectItem value="variado">Variado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.paymentType !== 'variado' && (
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
                )}
              </div>
              {formData.paymentType === 'variado' && (
                <p className="text-xs text-muted-foreground p-3 rounded-lg bg-secondary/50">
                  Valor variado: o recebimento é definido individualmente por paciente ou pacote cadastrado na contratante.
                </p>
              )}
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
              <div>
                <Label className="text-xs">Pagamento em caso de falta</Label>
                <Select
                  value={formData.absencePaymentType}
                  onValueChange={(v) => setFormData({ ...formData, absencePaymentType: v as 'always' | 'never' | 'confirmed_only' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Sempre cobrar faltas</SelectItem>
                    <SelectItem value="confirmed_only">Cobrar apenas se houve confirmação prévia</SelectItem>
                    <SelectItem value="never">Nunca cobrar faltas</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground mt-2 p-3 rounded-lg bg-secondary/50 space-y-1.5">
                  <p><strong>Sempre cobrar faltas:</strong> toda falta registrada entra como receita no financeiro, mesmo sem confirmação prévia do paciente.</p>
                  <p><strong>Cobrar apenas se houve confirmação prévia:</strong> a falta só vira receita quando o paciente havia confirmado presença antes da sessão.</p>
                  <p><strong>Nunca cobrar faltas:</strong> faltas comuns não entram como receita — aparecem apenas como perda no relatório. Use "Falta Remunerada" pontualmente quando quiser cobrar uma falta específica.</p>
                </div>
              </div>
              {formData.absencePaymentType !== 'never' && (
                <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <div>
                    <Label className="text-xs">Quanto o terapeuta recebe pela falta cobrada</Label>
                    <Select
                      value={formData.absenceChargeMode}
                      onValueChange={(v) => setFormData({ ...formData, absenceChargeMode: v as 'integral' | 'parcial' })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="integral">Integral (valor cheio da sessão)</SelectItem>
                        <SelectItem value="parcial">Parcial (valor fixo em R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.absenceChargeMode === 'parcial' && (
                    <div>
                      <Label className="text-xs">Valor por falta (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.absenceChargeAmount}
                        onChange={(e) => setFormData({ ...formData, absenceChargeAmount: e.target.value })}
                        placeholder="0,00"
                        className="mt-1"
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    <strong>Integral:</strong> quando a contratante paga a falta, o terapeuta recebe o mesmo valor de uma sessão normal (conforme o modelo de remuneração configurado).<br />
                    <strong>Parcial:</strong> a contratante paga, mas o terapeuta recebe apenas o valor fixo informado por falta. A diferença fica retida pela clínica.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Alterações'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
