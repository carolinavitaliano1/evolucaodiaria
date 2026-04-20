import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCalendarBlocks } from '@/hooks/useCalendarBlocks';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import { Trash2, CalendarOff, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarBlockDialog({ open, onOpenChange }: Props) {
  const { clinics } = useApp();
  const { blocks, create, remove, loading } = useCalendarBlocks();
  const activeClinics = clinics.filter(c => !c.isArchived);

  const [blockType, setBlockType] = useState<'feriado' | 'ferias'>('feriado');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [clinicScope, setClinicScope] = useState<string>('all'); // 'all' or clinic id
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setBlockType('feriado');
    setStartDate('');
    setEndDate('');
    setDescription('');
    setClinicScope('all');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) return toast.error('Informe a data de início');
    const finalEnd = blockType === 'feriado' ? startDate : (endDate || startDate);
    if (finalEnd < startDate) return toast.error('A data final deve ser posterior à inicial');
    if (!description.trim()) return toast.error('Adicione uma descrição');

    setSubmitting(true);
    const { error } = await create({
      block_type: blockType,
      start_date: startDate,
      end_date: finalEnd,
      description: description.trim(),
      clinic_id: clinicScope === 'all' ? null : clinicScope,
    });
    setSubmitting(false);
    if (error) return toast.error('Erro ao criar bloqueio');
    toast.success('Bloqueio adicionado');
    reset();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este bloqueio?')) return;
    const { error } = await remove(id);
    if (error) toast.error('Erro ao remover');
    else toast.success('Bloqueio removido');
  };

  const fmt = (d: string) => format(new Date(d + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-primary" />
            Bloqueios de Agenda
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Cadastre feriados ou férias para que o sistema não cobre evoluções pendentes nesses dias.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 border-b border-border pb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={blockType} onValueChange={v => setBlockType(v as 'feriado' | 'ferias')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feriado">Feriado (1 dia)</SelectItem>
                  <SelectItem value="ferias">Férias / Recesso (período)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Estabelecimento</Label>
              <Select value={clinicScope} onValueChange={setClinicScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estabelecimentos</SelectItem>
                  {activeClinics.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data de Início</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            {blockType === 'ferias' && (
              <div>
                <Label className="text-xs">Data Final</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Feriado Municipal, Recesso de Fim de Ano"
              rows={2}
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full gradient-primary">
            <Plus className="w-4 h-4 mr-1" /> Adicionar Bloqueio
          </Button>
        </form>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Bloqueios cadastrados</p>
          {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}
          {!loading && blocks.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-3 text-center">Nenhum bloqueio cadastrado.</p>
          )}
          {blocks.map(b => {
            const clinic = activeClinics.find(c => c.id === b.clinic_id);
            return (
              <div key={b.id} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {b.block_type === 'feriado' ? 'Feriado' : 'Férias'}
                    </span>
                    <span className="text-xs font-medium text-foreground truncate">{b.description}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {b.start_date === b.end_date ? fmt(b.start_date) : `${fmt(b.start_date)} → ${fmt(b.end_date)}`}
                    {' · '}
                    {clinic ? clinic.name : 'Todos os estabelecimentos'}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="w-7 h-7 shrink-0" onClick={() => handleDelete(b.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
