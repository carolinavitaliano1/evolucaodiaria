import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { History, Trash2 } from 'lucide-react';

interface HistoryRow {
  id: string;
  effective_from: string;
  payment_amount: number;
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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clinic_payment_history')
      .select('id, effective_from, payment_amount')
      .eq('clinic_id', clinicId)
      .order('effective_from', { ascending: false });
    if (!error && data) setRows(data as HistoryRow[]);
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
    </div>
  );
}

function formatDate(iso: string) {
  // iso comes as YYYY-MM-DD; render as dd/mm/yyyy avoiding timezone shifts
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}