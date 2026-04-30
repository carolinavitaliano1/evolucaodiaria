import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Wallet, Percent, DollarSign, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { ClinicPackage } from '@/types';
import { cn } from '@/lib/utils';

type Member = { id: string; user_id: string | null; email: string; role_label: string | null };

// ===== Zod schema =====
const commissionSchema = z.object({
  memberId: z.string().min(1, 'Selecione um profissional'),
  commissionValue: z
    .number({ invalid_type_error: 'Valor obrigatório' })
    .positive('Valor deve ser maior que zero'),
});

const packageSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome obrigatório').max(100),
    description: z.string().max(500).optional(),
    packageType: z.enum(['mensal', 'por_sessao', 'personalizado']),
    sessionLimit: z.union([z.number().int().positive(), z.literal('').transform(() => undefined)]).optional(),
    price: z.number({ invalid_type_error: 'Preço inválido' }).nonnegative(),
    lancamentoTipo: z.enum(['valor_total', 'valor_procedimento']),
    valorTotal: z
      .number({ invalid_type_error: 'Valor total obrigatório' })
      .positive('Valor total obrigatório'),
    accountName: z.string().trim().min(1, 'Conta obrigatória').max(80),
    commissionPaymentMethod: z.enum(['sem_comissao', 'integral', 'por_atendimento']),
    commissionType: z.enum(['valor_fixo', 'porcentagem']),
    commissionPerProfessional: z.boolean(),
    commissions: z.array(commissionSchema),
  })
  .refine(
    (d) =>
      d.commissionPaymentMethod === 'sem_comissao' ||
      d.commissions.length > 0,
    { message: 'Adicione ao menos um profissional', path: ['commissions'] }
  );

type FormValues = z.infer<typeof packageSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  pkg?: ClinicPackage | null; // when present → edit mode
}

export function PackageFormDialog({ open, onOpenChange, clinicId, pkg }: Props) {
  const { clinics, addPackage, updatePackage, setPackageCommissions } = useApp();
  const clinic = clinics.find((c) => c.id === clinicId);
  const isEdit = !!pkg;
  // Comissão só se aplica a Clínicas (modo multi-profissional).
  // Consultório/Contratante não usam comissionamento de pacotes.
  const showCommission = clinic?.type === 'clinica';

  const [members, setMembers] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const defaultValues: FormValues = useMemo(
    () => ({
      name: pkg?.name ?? '',
      description: pkg?.description ?? '',
      packageType: (pkg?.packageType as any) ?? 'mensal',
      sessionLimit: pkg?.sessionLimit ?? undefined,
      price: pkg?.price ?? 0,
      lancamentoTipo: (pkg?.lancamentoTipo as any) ?? 'valor_total',
      valorTotal: pkg?.valorTotal ?? pkg?.price ?? 0,
      accountName: pkg?.accountName ?? '',
      commissionPaymentMethod: (pkg?.commissionPaymentMethod as any) ?? 'sem_comissao',
      commissionType: (pkg?.commissionType as any) ?? 'valor_fixo',
      commissionPerProfessional: pkg?.commissionPerProfessional ?? false,
      commissions:
        pkg?.commissions?.map((c) => ({
          memberId: c.memberId,
          commissionValue: Number(c.commissionValue),
        })) ?? [],
    }),
    [pkg]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(packageSchema) as any,
    defaultValues,
    mode: 'onSubmit',
  });
  const { register, handleSubmit, control, watch, setValue, reset, formState } = form;
  const { errors } = formState;

  const { fields, append, remove } = useFieldArray({ control, name: 'commissions' });

  // Reset form whenever opening or switching package
  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  // Load org members for the clinic
  useEffect(() => {
    if (!open || !clinic?.organizationId) {
      setMembers([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('id, user_id, email, role_label')
        .eq('organization_id', clinic.organizationId)
        .eq('status', 'active');
      if (!error && data) setMembers(data as Member[]);
    })();
  }, [open, clinic?.organizationId]);

  const watchedMethod = watch('commissionPaymentMethod');
  const watchedType = watch('commissionType');
  const watchedPerPro = watch('commissionPerProfessional');
  const watchedPackageType = watch('packageType');
  const watchedValorTotal = watch('valorTotal');
  const watchedSessionLimit = watch('sessionLimit');

  // Keep at least one commission row when method != sem_comissao
  useEffect(() => {
    if (watchedMethod !== 'sem_comissao' && fields.length === 0) {
      append({ memberId: '', commissionValue: 0 });
    }
    if (watchedMethod === 'sem_comissao' && fields.length > 0) {
      // Keep but UI will hide; no-op
    }
  }, [watchedMethod, fields.length, append]);

  // If toggle OFF and there are >1 commissions, trim to single
  useEffect(() => {
    if (!watchedPerPro && fields.length > 1) {
      // Remove extras keeping the first
      for (let i = fields.length - 1; i > 0; i--) remove(i);
    }
  }, [watchedPerPro, fields.length, remove]);

  const memberLabel = (m: Member) =>
    m.role_label ? `${m.email} — ${m.role_label}` : m.email;

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      // Força sem comissão para tipos que não usam comissionamento
      const effectiveMethod = showCommission ? values.commissionPaymentMethod : 'sem_comissao';
      const commissionsPayload =
        effectiveMethod === 'sem_comissao'
          ? []
          : values.commissions.map((c) => ({
              memberId: c.memberId,
              commissionValue: c.commissionValue,
              commissionType: values.commissionType,
            }));

      if (isEdit && pkg) {
        await updatePackage(pkg.id, {
          name: values.name,
          description: values.description || undefined,
          packageType: values.packageType,
          sessionLimit:
            values.packageType === 'personalizado' && values.sessionLimit
              ? Number(values.sessionLimit)
              : null,
          price: values.valorTotal,
          lancamentoTipo: values.lancamentoTipo,
          valorTotal: values.valorTotal,
          accountName: values.accountName,
          commissionPaymentMethod: effectiveMethod,
          commissionType: values.commissionType,
          commissionPerProfessional: values.commissionPerProfessional,
        });
        await setPackageCommissions(pkg.id, commissionsPayload);
        toast.success('Pacote atualizado');
      } else {
        await addPackage({
          userId: '',
          clinicId,
          name: values.name,
          description: values.description || undefined,
          price: values.valorTotal,
          isActive: true,
          packageType: values.packageType,
          sessionLimit:
            values.packageType === 'personalizado' && values.sessionLimit
              ? Number(values.sessionLimit)
              : null,
          lancamentoTipo: values.lancamentoTipo,
          valorTotal: values.valorTotal,
          accountName: values.accountName,
          commissionPaymentMethod: effectiveMethod,
          commissionType: values.commissionType,
          commissionPerProfessional: values.commissionPerProfessional,
          commissions: commissionsPayload.map((c) => ({
            id: '',
            packageId: '',
            memberId: c.memberId,
            commissionValue: c.commissionValue,
            commissionType: c.commissionType,
          })),
        });
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const formatBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Pacote' : 'Novo Pacote'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* ============ Card 1: Dados básicos ============ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados básicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Nome do Pacote *</Label>
                <Input
                  {...register('name')}
                  placeholder="Ex: Pacote Social, Pacote Premium"
                  className="mt-1"
                />
                {errors.name && (
                  <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  {...register('description')}
                  placeholder="Detalhes do pacote..."
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de Pacote</Label>
                  <Controller
                    control={control}
                    name="packageType"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          if (v !== 'personalizado') setValue('sessionLimit', undefined);
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="por_sessao">Por Sessão</SelectItem>
                          <SelectItem value="personalizado">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                {watchedPackageType === 'personalizado' && (
                  <div className="animate-in fade-in duration-200">
                    <Label>Quantidade de Sessões</Label>
                    <Input
                      type="number"
                      min={1}
                      className="mt-1"
                      {...register('sessionLimit', {
                        setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)),
                      })}
                      placeholder="Ex: 8"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ============ Card 2: Lançamento Financeiro ============ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                Lançamento financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Tipo de lançamento</Label>
                <Controller
                  control={control}
                  name="lancamentoTipo"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      <label className="flex items-center gap-2 rounded-md border border-border p-2.5 cursor-pointer hover:bg-muted/50">
                        <RadioGroupItem value="valor_total" id="lt-total" />
                        <span className="text-sm">Valor total do pacote</span>
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-border p-2.5 cursor-pointer hover:bg-muted/50">
                        <RadioGroupItem value="valor_procedimento" id="lt-proc" />
                        <span className="text-sm">Valor de cada procedimento</span>
                      </label>
                    </RadioGroup>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Valor total (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="mt-1"
                    {...register('valorTotal', { valueAsNumber: true })}
                    placeholder="0,00"
                  />
                  {errors.valorTotal && (
                    <p className="text-xs text-destructive mt-1">{errors.valorTotal.message}</p>
                  )}
                  {watchedPackageType === 'personalizado' &&
                    watchedValorTotal &&
                    watchedSessionLimit &&
                    Number(watchedSessionLimit) > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Valor por sessão:{' '}
                        <span className="font-semibold">
                          {formatBRL(Number(watchedValorTotal) / Number(watchedSessionLimit))}
                        </span>
                      </p>
                    )}
                </div>
                <div>
                  <Label>Conta *</Label>
                  <Input
                    {...register('accountName')}
                    placeholder="Ex: Caixa Principal"
                    className="mt-1"
                  />
                  {errors.accountName && (
                    <p className="text-xs text-destructive mt-1">{errors.accountName.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============ Card 3: Comissão ============ */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="w-4 h-4 text-primary" />
                Comissão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Forma de pagamento da comissão</Label>
                <Controller
                  control={control}
                  name="commissionPaymentMethod"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem_comissao">Sem comissão</SelectItem>
                        <SelectItem value="integral">Integral</SelectItem>
                        <SelectItem value="por_atendimento">Por atendimento</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {watchedMethod === 'por_atendimento' && (
                  <p className="mt-1.5 text-xs text-muted-foreground italic">
                    Um lançamento de comissão será gerado a cada atendimento.
                  </p>
                )}
              </div>

              {watchedMethod !== 'sem_comissao' && (
                <>
                  <div>
                    <Label className="mb-2 block">Tipo de comissão</Label>
                    <Controller
                      control={control}
                      name="commissionType"
                      render={({ field }) => (
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid grid-cols-2 gap-2"
                        >
                          <label className="flex items-center gap-2 rounded-md border border-border p-2.5 cursor-pointer hover:bg-muted/50">
                            <RadioGroupItem value="valor_fixo" id="ct-fixo" />
                            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm">Valor fixo</span>
                          </label>
                          <label className="flex items-center gap-2 rounded-md border border-border p-2.5 cursor-pointer hover:bg-muted/50">
                            <RadioGroupItem value="porcentagem" id="ct-pct" />
                            <Percent className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm">Porcentagem</span>
                          </label>
                        </RadioGroup>
                      )}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3 bg-muted/30">
                    <div className="min-w-0">
                      <Label className="text-sm">
                        A comissão pode ser diferente dependendo do profissional que atender?
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Ative para definir valores específicos para cada profissional.
                      </p>
                    </div>
                    <Controller
                      control={control}
                      name="commissionPerProfessional"
                      render={({ field }) => (
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ============ Card 4: Profissionais ============ */}
          {watchedMethod !== 'sem_comissao' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {watchedPerPro ? 'Profissionais e comissões' : 'Profissional'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {clinic?.organizationId ? null : (
                  <p className="text-xs text-warning bg-warning/10 rounded-md p-2">
                    Esta clínica não pertence a uma organização. Cadastre uma equipe para vincular profissionais.
                  </p>
                )}

                {fields.map((field, index) => {
                  const valueWatch = watch(`commissions.${index}.commissionValue`);
                  const numericValue = Number(valueWatch) || 0;
                  const summary =
                    watchedType === 'porcentagem'
                      ? `Será lançado ${numericValue}% sobre o valor a cada atendimento que o profissional fizer para este pacote.`
                      : `Será lançado o valor de ${formatBRL(numericValue)} a cada atendimento que o profissional fizer para este pacote.`;

                  return (
                    <div
                      key={field.id}
                      className="rounded-lg border border-border p-3 bg-card space-y-3 relative"
                    >
                      {watchedPerPro && fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => remove(index)}
                          title="Remover profissional"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label>Profissional *</Label>
                          <Controller
                            control={control}
                            name={`commissions.${index}.memberId`}
                            render={({ field: f }) => (
                              <Select value={f.value} onValueChange={f.onChange}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {members.length === 0 && (
                                    <div className="px-2 py-3 text-xs text-muted-foreground">
                                      Nenhum membro disponível
                                    </div>
                                  )}
                                  {members.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                      {memberLabel(m)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.commissions?.[index]?.memberId && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.commissions[index]?.memberId?.message as string}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Comissão por atendimento *</Label>
                          <div className="relative mt-1">
                            <span
                              className={cn(
                                'absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none'
                              )}
                            >
                              {watchedType === 'porcentagem' ? '%' : 'R$'}
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              className="pl-10"
                              {...register(`commissions.${index}.commissionValue`, {
                                valueAsNumber: true,
                              })}
                              placeholder="0,00"
                            />
                          </div>
                          {errors.commissions?.[index]?.commissionValue && (
                            <p className="text-xs text-destructive mt-1">
                              {errors.commissions[index]?.commissionValue?.message as string}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground italic">{summary}</p>
                    </div>
                  );
                })}

                {watchedPerPro && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => append({ memberId: '', commissionValue: 0 })}
                  >
                    <Plus className="w-4 h-4" /> Adicionar outro profissional
                  </Button>
                )}

                {errors.commissions && typeof errors.commissions.message === 'string' && (
                  <p className="text-xs text-destructive">{errors.commissions.message}</p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 pt-2 sticky bottom-0 bg-background pb-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar Pacote'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
