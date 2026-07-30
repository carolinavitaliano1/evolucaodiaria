import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, Pencil, Trash2, FileDown, Clock, Target, DollarSign, NotebookPen, Loader2, Receipt,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SupervisionSessionDialog } from './SupervisionSessionDialog';
import { generateSupervisionCertificate } from './generateSupervisionCertificate';
import { generatePaymentReceiptPdf } from '@/utils/generatePaymentReceiptPdf';
import {
  useSupervisionGoals, useSupervisionPayments, useSupervisionSessions,
} from './useSupervision';
import { ATTENDANCE_LABELS, BILLABLE_STATUSES, COMPETENCIES, HOUR_STATUSES } from './types';
import type { Supervisee, SupervisionSession } from './types';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');

export function SuperviseeDetail({ supervisee }: { supervisee: Supervisee }) {
  const { sessions, loading, save: saveSession, remove: removeSession } = useSupervisionSessions(supervisee.id);
  const { goals, save: saveGoal, remove: removeGoal } = useSupervisionGoals(supervisee.id);
  const { payments, save: savePayment, remove: removePayment } = useSupervisionPayments(supervisee.id);

  const [sessionDialog, setSessionDialog] = useState(false);
  const [editing, setEditing] = useState<SupervisionSession | null>(null);
  const [supervisor, setSupervisor] = useState<{ name: string; registration?: string; cpf?: string | null; cbo?: string | null }>({ name: '' });
  const [stamps, setStamps] = useState<any[]>([]);
  const [stampId, setStampId] = useState<string>('none');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const [{ data: profile }, { data: stampRows }] = await Promise.all([
        supabase.from('profiles').select('name, professional_id, cpf, cbo').eq('user_id', uid).maybeSingle(),
        supabase.from('stamps').select('id, name, stamp_image, signature_image, clinical_area, is_default').eq('user_id', uid).order('is_default', { ascending: false }),
      ]);
      setSupervisor({
        name: (profile as any)?.name || '',
        registration: (profile as any)?.professional_id || (stampRows?.[0] as any)?.clinical_area || undefined,
        cpf: (profile as any)?.cpf || null,
        cbo: (profile as any)?.cbo || null,
      });
      setStamps(stampRows || []);
      if (stampRows?.[0]) setStampId((stampRows[0] as any).id);
    })();
  }, []);

  const stats = useMemo(() => {
    const counted = sessions.filter((s) => HOUR_STATUSES.includes(s.attendance_status));
    const minutes = counted.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const individual = counted.filter((s) => s.modality === 'individual')
      .reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60;
    const hours = minutes / 60;
    const billable = sessions.filter((s) => BILLABLE_STATUSES.includes(s.attendance_status)).length;
    const goal = supervisee.hours_goal || 0;
    return {
      hours,
      individual,
      group: hours - individual,
      sessions: counted.length,
      billable,
      goal,
      progress: goal > 0 ? Math.min(100, (hours / goal) * 100) : 0,
    };
  }, [sessions, supervisee.hours_goal]);

  const handleCertificate = () => {
    if (stats.sessions === 0) {
      toast.info('Nenhuma sessão com presença registrada ainda.');
      return;
    }
    setExporting(true);
    try {
      const stamp = stamps.find((s) => s.id === stampId);
      generateSupervisionCertificate({
        supervisee,
        sessions,
        supervisorName: supervisor.name,
        supervisorRegistration: stamp?.clinical_area || supervisor.registration,
        stampImage: stamp?.stamp_image,
        signatureImage: stamp?.signature_image,
      });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar a declaração');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="sessions">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="sessions" className="gap-1.5"><NotebookPen className="w-4 h-4" /><span className="hidden sm:inline">Sessões</span></TabsTrigger>
          <TabsTrigger value="plan" className="gap-1.5"><Target className="w-4 h-4" /><span className="hidden sm:inline">Plano</span></TabsTrigger>
          <TabsTrigger value="hours" className="gap-1.5"><Clock className="w-4 h-4" /><span className="hidden sm:inline">Horas</span></TabsTrigger>
          <TabsTrigger value="financial" className="gap-1.5"><DollarSign className="w-4 h-4" /><span className="hidden sm:inline">Financeiro</span></TabsTrigger>
        </TabsList>

        {/* ================= SESSÕES ================= */}
        <TabsContent value="sessions" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setSessionDialog(true); }}>
              <Plus className="w-4 h-4" /> Nova sessão
            </Button>
          </div>
          {loading ? (
            <div className="h-24 rounded-xl bg-muted animate-pulse" />
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma sessão registrada.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <Card key={s.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{fmt(s.date)}</span>
                      {s.start_time && <span className="text-xs text-muted-foreground">{s.start_time}{s.end_time ? ` – ${s.end_time}` : ''}</span>}
                      <Badge variant="secondary">{s.modality === 'grupo' ? 'Grupo' : 'Individual'}</Badge>
                      <Badge variant="outline">{s.format === 'presencial' ? 'Presencial' : 'Online'}</Badge>
                      <Badge variant={s.attendance_status === 'presente' ? 'default' : 'secondary'}>
                        {ATTENDANCE_LABELS[s.attendance_status] || s.attendance_status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{(s.duration_minutes / 60).toFixed(1)}h</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setSessionDialog(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm('Excluir esta sessão?')) return;
                          await removeSession(s.id);
                          toast.success('Sessão excluída');
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {s.topics && <p className="text-sm font-medium text-foreground">{s.topics}</p>}
                  {s.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.content}</p>}
                  {s.referrals && (
                    <p className="text-xs text-muted-foreground"><span className="font-semibold">Encaminhamentos:</span> {s.referrals}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ================= PLANO ================= */}
        <TabsContent value="plan" className="mt-4">
          <GoalsPanel goals={goals} onSave={saveGoal} onRemove={removeGoal} />
        </TabsContent>

        {/* ================= HORAS ================= */}
        <TabsContent value="hours" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total de horas</p>
              <p className="text-2xl font-bold text-foreground">{stats.hours.toFixed(1)}h</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Individual</p>
              <p className="text-2xl font-bold text-foreground">{stats.individual.toFixed(1)}h</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Grupo</p>
              <p className="text-2xl font-bold text-foreground">{stats.group.toFixed(1)}h</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Encontros</p>
              <p className="text-2xl font-bold text-foreground">{stats.sessions}</p>
            </Card>
          </div>

          {stats.goal > 0 && (
            <Card className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Meta de horas</span>
                <span className="font-semibold text-foreground">{stats.hours.toFixed(1)}h de {stats.goal}h</span>
              </div>
              <Progress value={stats.progress} />
            </Card>
          )}

          <Card className="p-4 space-y-3">
            <div className="space-y-1.5 max-w-sm">
              <Label>Carimbo / assinatura</Label>
              <Select value={stampId} onValueChange={setStampId}>
                <SelectTrigger><SelectValue placeholder="Selecione o carimbo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem carimbo</SelectItem>
                  {stamps.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.clinical_area || 'Carimbo'}{s.is_default ? ' (padrão)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {stamps.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum carimbo cadastrado no seu perfil.</p>
              )}
            </div>
            <Button onClick={handleCertificate} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Emitir declaração de supervisão (PDF)
            </Button>
          </Card>
        </TabsContent>

        {/* ================= FINANCEIRO ================= */}
        <TabsContent value="financial" className="mt-4">
          <PaymentsPanel
            supervisee={supervisee}
            payments={payments}
            billableSessions={stats.billable}
            onSave={savePayment}
            onRemove={removePayment}
            supervisor={supervisor}
            stamps={stamps}
            stampId={stampId}
          />
        </TabsContent>
      </Tabs>

      <SupervisionSessionDialog
        open={sessionDialog}
        onOpenChange={setSessionDialog}
        session={editing}
        onSave={saveSession}
      />
    </div>
  );
}

/* ---------------- Plano de desenvolvimento ---------------- */
function GoalsPanel({ goals, onSave, onRemove }: any) {
  const [competency, setCompetency] = useState(COMPETENCIES[0]);
  const [goal, setGoal] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setSaving(true);
    try {
      await onSave({ competency, goal: goal || null, due_date: dueDate || null, status: 'em_andamento' });
      setGoal('');
      setDueDate('');
      toast.success('Meta adicionada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 grid sm:grid-cols-4 gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Competência</Label>
          <Select value={competency} onValueChange={setCompetency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPETENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label>Meta</Label>
          <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="O que se espera desenvolver" />
        </div>
        <div className="space-y-1.5">
          <Label>Prazo</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="sm:col-span-4">
          <Button size="sm" onClick={add} disabled={saving} className="gap-2">
            <Plus className="w-4 h-4" /> Adicionar meta
          </Button>
        </div>
      </Card>

      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma meta cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {goals.map((g: any) => (
            <Card key={g.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{g.competency}</p>
                  {g.goal && <p className="text-sm text-muted-foreground">{g.goal}</p>}
                  {g.due_date && <p className="text-xs text-muted-foreground mt-1">Prazo: {fmt(g.due_date)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={g.status} onValueChange={(v) => onSave({ status: v }, g.id)}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="atingida">Atingida</SelectItem>
                      <SelectItem value="pausada">Pausada</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={async () => { await onRemove(g.id); toast.success('Meta removida'); }}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="grid sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nota (0–5)</Label>
                  <Input
                    type="number" min={0} max={5} step={0.5}
                    defaultValue={g.score ?? ''}
                    onBlur={(e) => onSave({ score: e.target.value ? Number(e.target.value) : null }, g.id)}
                    className="h-8"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs">Feedback do supervisor</Label>
                  <Textarea
                    rows={2}
                    defaultValue={g.feedback ?? ''}
                    onBlur={(e) => onSave({ feedback: e.target.value || null }, g.id)}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!receiptTarget} onOpenChange={(o) => !o && setReceiptTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Local e data do recibo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input
                placeholder="Ex.: Natal/RN"
                value={receiptCity}
                onChange={(e) => setReceiptCity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe a cidade em branco para imprimir a linha em branco para preenchimento à mão.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptTarget(null)}>Cancelar</Button>
            <Button
              disabled={!!receiptId}
              onClick={() => receiptTarget && emitReceipt(receiptTarget)}
              className="gap-1.5"
            >
              {receiptId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
              Gerar recibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Financeiro ---------------- */
function PaymentsPanel({ supervisee, payments, billableSessions, onSave, onRemove, supervisor, stamps = [], stampId }: any) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [receiptStamp, setReceiptStamp] = useState<string>(stampId || 'none');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<any | null>(null);
  const [receiptCity, setReceiptCity] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { if (stampId) setReceiptStamp(stampId); }, [stampId]);

  const openReceiptDialog = (p: any) => {
    setReceiptTarget(p);
    setReceiptDate(p.paid_at || p.due_date || new Date().toISOString().slice(0, 10));
  };

  const emitReceipt = async (p: any) => {
    setReceiptId(p.id);
    try {
      const stamp = stamps.find((s: any) => s.id === receiptStamp) || null;
      const location = receiptCity.trim()
        ? `${receiptCity.trim()}, ${fmt(receiptDate)}`
        : null;
      await generatePaymentReceiptPdf({
        therapistName: supervisor?.name || 'Supervisor(a)',
        therapistCpf: supervisor?.cpf,
        therapistProfessionalId: supervisor?.registration,
        therapistCbo: supervisor?.cbo,
        stamp: stamp ? { ...stamp, cbo: supervisor?.cbo } : null,
        location,
        payerName: supervisee.name,
        amount: Number(p.amount || 0),
        serviceName: 'Supervisão clínica',
        period: `${String(p.reference_month).padStart(2, '0')}/${p.reference_year}`,
        paymentMethod: p.payment_method || 'PIX/transferência',
        paymentDate: p.paid_at || p.due_date || new Date().toISOString().slice(0, 10),
      });
      setReceiptTarget(null);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar o recibo');
    } finally {
      setReceiptId(null);
    }
  };

  const suggested =
    supervisee.payment_type === 'mensal'
      ? Number(supervisee.payment_value || 0)
      : Number(supervisee.payment_value || 0) * billableSessions;

  const total = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const received = payments.filter((p: any) => p.status === 'pago')
    .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const add = async () => {
    setSaving(true);
    try {
      const due = supervisee.payment_due_day
        ? `${year}-${String(month).padStart(2, '0')}-${String(supervisee.payment_due_day).padStart(2, '0')}`
        : null;
      await onSave({
        reference_month: Number(month),
        reference_year: Number(year),
        amount: Number(amount || suggested || 0),
        due_date: due,
        status: 'pendente',
      });
      setAmount('');
      toast.success('Cobrança lançada');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Sessões faturáveis</p>
          <p className="text-2xl font-bold text-foreground">{billableSessions}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total lançado</p>
          <p className="text-2xl font-bold text-foreground">{brl(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Recebido</p>
          <p className="text-2xl font-bold text-primary">{brl(received)}</p>
        </Card>
      </div>

      <Card className="p-4 grid sm:grid-cols-4 gap-3 items-end">
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input
            type="number"
            value={amount}
            placeholder={suggested ? String(suggested) : '0'}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={add} disabled={saving} className="gap-2">
          <Plus className="w-4 h-4" /> Lançar cobrança
        </Button>
      </Card>

      {stamps.length > 0 && (
        <Card className="p-4 space-y-1.5 max-w-sm">
          <Label>Carimbo do recibo</Label>
          <Select value={receiptStamp} onValueChange={setReceiptStamp}>
            <SelectTrigger><SelectValue placeholder="Selecione o carimbo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem carimbo</SelectItem>
              {stamps.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name || s.clinical_area || 'Carimbo'}{s.is_default ? ' (padrão)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma cobrança lançada.</p>
      ) : (
        <div className="space-y-2">
          {payments.map((p: any) => (
            <Card key={p.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-foreground">
                  {String(p.reference_month).padStart(2, '0')}/{p.reference_year} — {brl(Number(p.amount))}
                </p>
                {p.due_date && <p className="text-xs text-muted-foreground">Vencimento: {fmt(p.due_date)}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={receiptId === p.id}
                  onClick={() => openReceiptDialog(p)}
                >
                  {receiptId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                  Recibo
                </Button>
                <Select
                  value={p.status}
                  onValueChange={(v) =>
                    onSave({ status: v, paid_at: v === 'pago' ? new Date().toISOString().slice(0, 10) : null }, p.id)
                  }
                >
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={async () => { await onRemove(p.id); toast.success('Cobrança removida'); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}