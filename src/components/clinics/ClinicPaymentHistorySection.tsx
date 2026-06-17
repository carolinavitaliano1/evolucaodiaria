import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { History, Trash2, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';

interface HistoryRow {
  id: string;
  effective_from: string;
  payment_amount: number;
}

interface AuditRow {
  id: string;
  action: 'insert' | 'update' | 'delete';
  old_payment_amount: number | null;
  new_payment_amount: number | null;
  old_effective_from: string | null;
  new_effective_from: string | null;
  changed_by_email: string | null;
  created_at: string;
}

interface Props {
  clinicId: string;
  currentAmount: string;
  onApplied: (newAmount: number) => void;
}

export function ClinicPaymentHistorySection({ clinicId, currentAmount, onApplied }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [showAudit, setShowAudit] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clinic_payment_history')
      .select('id, effective_from, payment_amount')
      .eq('clinic_id', clinicId)
      .order('effective_from', { ascending: false });
    if (!error && data) setRows(data as HistoryRow[]);

    const { data: auditData } = await supabase
      .from('clinic_payment_history_audit')
      .select('id, action, old_payment_amount, new_payment_amount, old_effective_from, new_effective_from, changed_by_email, created_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (auditData) setAudit(auditData as AuditRow[]);

    setLoading(false);
  };

  useEffect(() => { if (clinicId) load(); }, [clinicId]);

  const handleApply = async () => {
    if (!date || !amount) {
      toast.error('Preencha data e novo valor');
      return;
    }
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) {
      toast.error('Valor inválido');
      return;
    }
    setSaving(true);
    try {
      const { error: insErr } = await supabase
        .from('clinic_payment_history')
        .insert({ clinic_id: clinicId, effective_from: date, payment_type: 'sessao', payment_amount: value });
      if (insErr) throw insErr;

      const { error: updErr } = await supabase
        .from('clinics')
        .update({ payment_amount: value })
        .eq('id', clinicId);
      if (updErr) throw updErr;

      toast.success(`Repasse atualizado para R$ ${value.toFixed(2)} a partir de ${formatDate(date)}`);
      onApplied(value);
      setDate('');
      setAmount('');
      await load();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao aplicar alteração');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta entrada do histórico? O cálculo das sessões dessa data passa a usar a entrada anterior.')) return;
    const { error } = await supabase.from('clinic_payment_history').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover');
      return;
    }
    toast.success('Entrada removida');
    await load();
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <History className="w-3.5 h-3.5" />
        Alterar valor de repasse a partir de uma data
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        O novo valor passa a valer da data escolhida em diante. Meses anteriores continuam com o valor que estava vigente.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-1">
          <Label className="text-[11px]">A partir de</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-9 text-sm" />
        </div>
        <div className="sm:col-span-1">
          <Label className="text-[11px]">Novo valor (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={currentAmount || '0,00'}
            className="mt-1 h-9 text-sm"
          />
        </div>
        <div className="sm:col-span-1 flex items-end">
          <Button type="button" onClick={handleApply} disabled={saving} size="sm" className="w-full h-9">
            {saving ? 'Aplicando...' : 'Aplicar alteração'}
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="pt-2 border-t border-primary/10">
          <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Histórico</p>
          <ul className="space-y-1">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-xs bg-background rounded px-2 py-1">
                <span>
                  <span className="font-medium">{formatDate(r.effective_from)}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  R$ {Number(r.payment_amount).toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {loading && <p className="text-[11px] text-muted-foreground">Carregando histórico...</p>}

      <div className="pt-2 border-t border-primary/10">
        <button
          type="button"
          onClick={() => setShowAudit((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-primary"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Log de auditoria ({audit.length})
          {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showAudit && (
          audit.length === 0 ? (
            <p className="text-[11px] text-muted-foreground mt-1.5">Sem alterações registradas.</p>
          ) : (
            <ul className="mt-1.5 space-y-1 max-h-56 overflow-y-auto">
              {audit.map((a) => (
                <li key={a.id} className="text-[11px] bg-background rounded px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={
                      a.action === 'insert' ? 'font-medium text-success'
                      : a.action === 'delete' ? 'font-medium text-destructive'
                      : 'font-medium text-primary'
                    }>
                      {a.action === 'insert' ? 'Criado' : a.action === 'delete' ? 'Removido' : 'Alterado'}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {a.action === 'update' && (
                      <>
                        R$ {Number(a.old_payment_amount ?? 0).toFixed(2)} → R$ {Number(a.new_payment_amount ?? 0).toFixed(2)}
                        {' · '}vigência {a.old_effective_from ? formatDate(a.old_effective_from) : '—'} → {a.new_effective_from ? formatDate(a.new_effective_from) : '—'}
                      </>
                    )}
                    {a.action === 'insert' && (
                      <>R$ {Number(a.new_payment_amount ?? 0).toFixed(2)} a partir de {a.new_effective_from ? formatDate(a.new_effective_from) : '—'}</>
                    )}
                    {a.action === 'delete' && (
                      <>R$ {Number(a.old_payment_amount ?? 0).toFixed(2)} (vigência {a.old_effective_from ? formatDate(a.old_effective_from) : '—'})</>
                    )}
                  </div>
                  {a.changed_by_email && (
                    <div className="text-muted-foreground/70 mt-0.5 truncate">por {a.changed_by_email}</div>
                  )}
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  // iso comes as YYYY-MM-DD; render as dd/mm/yyyy avoiding timezone shifts
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}