import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, Calendar as CalendarIcon, Video, MapPin, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Reuniao, ReuniaoModalidade, ReuniaoStatus } from './types';
import { TelehealthButton } from '@/components/telehealth/TelehealthButton';

interface Props { patientId: string; patientName?: string; clinicId?: string | null; }

const STATUS_LABEL: Record<ReuniaoStatus, string> = {
  agendada: 'Agendada', realizada: 'Realizada', cancelada: 'Cancelada',
};
const STATUS_COLOR: Record<ReuniaoStatus, string> = {
  agendada: 'bg-blue-500/10 text-blue-600',
  realizada: 'bg-emerald-500/10 text-emerald-600',
  cancelada: 'bg-muted text-muted-foreground line-through',
};
const MODALIDADE_LABEL: Record<ReuniaoModalidade, string> = {
  presencial: 'Presencial', online: 'Online', teleatendimento: 'Teleatendimento',
};

export function ReunioesPanel({ patientId, patientName, clinicId }: Props) {
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reuniao | null>(null);
  const [patientInfo, setPatientInfo] = useState<{ name?: string; clinic_id?: string | null }>({
    name: patientName,
    clinic_id: clinicId ?? null,
  });

  useEffect(() => {
    if (patientName && clinicId !== undefined) return;
    (async () => {
      const { data } = await supabase
        .from('patients').select('name, clinic_id').eq('id', patientId).maybeSingle();
      if (data) setPatientInfo({ name: data.name, clinic_id: data.clinic_id });
    })();
  }, [patientId, patientName, clinicId]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('psico_reunioes').select('*').eq('patient_id', patientId)
      .order('data_hora', { ascending: false });
    if (error) toast.error('Erro ao carregar reuniões');
    setReunioes((data || []) as Reuniao[]);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  async function remove(r: Reuniao) {
    if (!confirm('Excluir esta reunião?')) return;
    const { error } = await supabase.from('psico_reunioes').delete().eq('id', r.id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Excluída'); load(); }
  }

  async function updateStatus(r: Reuniao, status: ReuniaoStatus) {
    const { error } = await supabase.from('psico_reunioes').update({ status }).eq('id', r.id);
    if (error) toast.error('Erro ao atualizar'); else { toast.success('Status atualizado'); load(); }
  }

  const filtered = filterStatus === 'TODOS' ? reunioes : reunioes.filter((r) => r.status === filterStatus);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os status</SelectItem>
            <SelectItem value="agendada">Agendadas</SelectItem>
            <SelectItem value="realizada">Realizadas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5" /> Nova reunião
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhuma reunião {filterStatus !== 'TODOS' ? `com status "${STATUS_LABEL[filterStatus as ReuniaoStatus]}"` : 'agendada'}.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-sm font-semibold text-foreground truncate">{r.titulo}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${STATUS_COLOR[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {format(new Date(r.data_hora), "d/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {r.duracao_min ? ` · ${r.duracao_min} min` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {r.modalidade === 'presencial' ? <MapPin className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                      {MODALIDADE_LABEL[r.modalidade]}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(r); setDialogOpen(true); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(r)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {r.local_ou_link && (
                <p className="text-xs text-muted-foreground truncate">
                  <span className="font-medium">{r.modalidade === 'presencial' ? 'Local: ' : 'Link: '}</span>
                  {r.modalidade !== 'presencial' ? (
                    <a href={r.local_ou_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{r.local_ou_link}</a>
                  ) : r.local_ou_link}
                </p>
              )}
              {r.participantes && r.participantes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.participantes.map((p, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p}</span>
                  ))}
                </div>
              )}
              {r.pauta && <p className="text-xs text-foreground/80 whitespace-pre-wrap"><span className="font-medium">Pauta:</span> {r.pauta}</p>}
              {r.notas && <p className="text-xs text-foreground/80 whitespace-pre-wrap border-t pt-1.5"><span className="font-medium">Notas:</span> {r.notas}</p>}
              {r.status === 'agendada' && (
                <div className="flex gap-1.5 pt-1 border-t">
                  {r.modalidade === 'teleatendimento' && (
                    <TelehealthButton
                      patientId={patientId}
                      patientName={patientName}
                      clinicId={clinicId ?? null}
                      size="sm"
                      className="h-7 text-xs"
                    />
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(r, 'realizada')}>Marcar realizada</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(r, 'cancelada')}>Cancelar</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar reunião' : 'Nova reunião'}</DialogTitle>
          </DialogHeader>
          <ReuniaoForm
            patientId={patientId}
            existing={editing}
            onSaved={() => { setDialogOpen(false); load(); }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReuniaoForm({
  patientId, existing, onSaved, onCancel,
}: { patientId: string; existing: Reuniao | null; onSaved: () => void; onCancel: () => void; }) {
  const initialDate = existing
    ? format(new Date(existing.data_hora), "yyyy-MM-dd'T'HH:mm")
    : format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const [titulo, setTitulo] = useState(existing?.titulo || '');
  const [dataHora, setDataHora] = useState(initialDate);
  const [duracao, setDuracao] = useState(existing?.duracao_min ?? 60);
  const [modalidade, setModalidade] = useState<ReuniaoModalidade>(existing?.modalidade || 'presencial');
  const [localLink, setLocalLink] = useState(existing?.local_ou_link || '');
  const [participantesStr, setParticipantesStr] = useState((existing?.participantes || []).join(', '));
  const [pauta, setPauta] = useState(existing?.pauta || '');
  const [status, setStatus] = useState<ReuniaoStatus>(existing?.status || 'agendada');
  const [notas, setNotas] = useState(existing?.notas || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!titulo.trim()) { toast.error('Informe o título'); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');

      const payload = {
        patient_id: patientId,
        therapist_id: uid,
        titulo: titulo.trim(),
        data_hora: new Date(dataHora).toISOString(),
        duracao_min: duracao || null,
        modalidade,
        local_ou_link: localLink || null,
        participantes: participantesStr.split(',').map((s) => s.trim()).filter(Boolean),
        pauta: pauta || null,
        status,
        notas: notas || null,
      };
      const { error } = existing
        ? await supabase.from('psico_reunioes').update(payload).eq('id', existing.id)
        : await supabase.from('psico_reunioes').insert(payload);
      if (error) throw error;
      toast.success(existing ? 'Reunião atualizada' : 'Reunião agendada');
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3 p-1">
      <div className="space-y-1.5">
        <Label className="text-xs">Título</Label>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Reunião com escola" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Data e hora</Label>
          <Input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Duração (min)</Label>
          <Input type="number" min={5} step={5} value={duracao} onChange={(e) => setDuracao(parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Modalidade</Label>
          <Select value={modalidade} onValueChange={(v) => setModalidade(v as ReuniaoModalidade)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="teleatendimento">Teleatendimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ReuniaoStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="agendada">Agendada</SelectItem>
              <SelectItem value="realizada">Realizada</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{modalidade === 'presencial' ? 'Local' : 'Link da reunião'}</Label>
        <Input value={localLink} onChange={(e) => setLocalLink(e.target.value)}
          placeholder={modalidade === 'presencial' ? 'Endereço ou sala' : 'https://meet...'} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Participantes (separe por vírgula)</Label>
        <Input value={participantesStr} onChange={(e) => setParticipantesStr(e.target.value)}
          placeholder="Ex: Mãe, Coordenadora, Psicóloga" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Pauta</Label>
        <Textarea rows={3} value={pauta} onChange={(e) => setPauta(e.target.value)} placeholder="O que será discutido..." />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notas (pós-reunião)</Label>
        <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Conclusões, encaminhamentos..." />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar
        </Button>
      </div>
    </div>
  );
}