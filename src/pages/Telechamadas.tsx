import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useTelehealthAccess } from '@/hooks/useTelehealthAccess';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StartTelehealthDialog } from '@/components/telehealth/StartTelehealthDialog';
import { Video, Loader2, Plus, LogIn, RefreshCcw, Search, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface SessionRow {
  id: string;
  patient_id: string;
  status: string;
  created_at: string;
  scheduled_for: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  daily_room_url: string;
}

function fmtDur(s?: number | null) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, '0')}s`;
}

export default function Telechamadas() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const app = useApp();
  const access = useTelehealthAccess();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'scheduled' | 'ended'>('all');
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedPatient, setPickedPatient] = useState<{ id: string; name: string; clinicId?: string | null } | null>(null);

  const patientMap = useMemo(() => {
    const m = new Map<string, { name: string; clinicId?: string | null }>();
    app.patients.forEach((p: any) => m.set(p.id, { name: p.name, clinicId: p.clinic_id ?? p.clinicId ?? null }));
    return m;
  }, [app.patients]);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('video_sessions')
        .select('id, patient_id, status, created_at, scheduled_for, started_at, ended_at, duration_seconds, daily_room_url')
        .eq('therapist_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setSessions((data || []) as SessionRow[]);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar telechamadas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`telechamadas-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_sessions', filter: `therapist_user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (search.trim()) {
        const name = patientMap.get(s.patient_id)?.name?.toLowerCase() || '';
        if (!name.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [sessions, filter, search, patientMap]);

  const stats = useMemo(() => ({
    active: sessions.filter((s) => s.status === 'active').length,
    scheduled: sessions.filter((s) => s.status === 'scheduled').length,
    ended: sessions.filter((s) => s.status === 'ended').length,
  }), [sessions]);

  if (!access.loading && !access.enabled) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="p-8 text-center space-y-3">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">Telechamadas indisponíveis</h1>
          <p className="text-sm text-muted-foreground">{access.reason || 'Faça upgrade para usar o teleatendimento.'}</p>
          <Button onClick={() => navigate('/pricing')}>Ver planos</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6 text-primary" /> Telechamadas
          </h1>
          <p className="text-sm text-muted-foreground">Inicie e gerencie atendimentos por vídeo dentro do app.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setPickerOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova chamada
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Em andamento</p>
          <p className="text-2xl font-bold text-primary">{stats.active}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Agendadas</p>
          <p className="text-2xl font-bold">{stats.scheduled}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Encerradas</p>
          <p className="text-2xl font-bold text-muted-foreground">{stats.ended}</p>
        </Card>
      </div>

      <Card className="p-3 flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="active">Em andamento</SelectItem>
            <SelectItem value="scheduled">Agendadas</SelectItem>
            <SelectItem value="ended">Encerradas</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma telechamada encontrada. Clique em "Nova chamada" para iniciar.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => {
            const pat = patientMap.get(s.patient_id);
            const isActive = s.status === 'active';
            const isScheduled = s.status === 'scheduled';
            return (
              <Card key={s.id} className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{pat?.name || 'Paciente removido'}</span>
                    <Badge variant={isActive ? 'default' : isScheduled ? 'secondary' : 'outline'} className="text-[10px]">
                      {isActive ? 'Em andamento' : isScheduled ? 'Agendada' : 'Encerrada'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(s.created_at), "d MMM yyyy, HH:mm", { locale: ptBR })}
                    {s.status === 'ended' && s.duration_seconds && ` • ${fmtDur(s.duration_seconds)}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {(isActive || isScheduled) && (
                    <Button size="sm" onClick={() => navigate(`/teleatendimento/sala/${s.id}`)} className="gap-1.5">
                      <LogIn className="w-3.5 h-3.5" /> Entrar
                    </Button>
                  )}
                  {pat && (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/patients/${s.patient_id}#telehealth`)}>
                      Paciente
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={(v) => { setPickerOpen(v); if (!v) setPickedPatient(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar paciente</DialogTitle>
          </DialogHeader>
          <PatientPicker
            patients={app.patients}
            onPick={(p) => {
              setPickedPatient({ id: p.id, name: p.name, clinicId: (p as any).clinic_id ?? (p as any).clinicId ?? null });
              setPickerOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {pickedPatient && (
        <StartTelehealthDialog
          open={!!pickedPatient}
          onOpenChange={(v) => { if (!v) { setPickedPatient(null); load(); } }}
          patientId={pickedPatient.id}
          patientName={pickedPatient.name}
          clinicId={pickedPatient.clinicId || undefined}
        />
      )}
    </div>
  );
}

function PatientPicker({ patients, onPick }: { patients: any[]; onPick: (p: any) => void }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = patients.filter((p) => p.status !== 'arquivado');
    if (!t) return list.slice(0, 50);
    return list.filter((p) => p.name?.toLowerCase().includes(t)).slice(0, 50);
  }, [patients, q]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus placeholder="Buscar paciente..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <div className="max-h-80 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum paciente encontrado.</p>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm"
            >
              {p.name}
            </button>
          ))
        )}
      </div>
    </div>
  );
}