import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Pencil, Trash2, GraduationCap, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useSupervisees } from '@/modules/supervision/useSupervision';
import { SuperviseeDialog } from '@/modules/supervision/SuperviseeDialog';
import { SuperviseeDetail } from '@/modules/supervision/SuperviseeDetail';
import { useModuleAccess } from '@/modules/specialties/useModuleAccess';
import { ModulePaywall } from '@/modules/specialties/ModulePaywall';
import { getModule } from '@/modules/specialties/config';
import type { Supervisee } from '@/modules/supervision/types';

export default function Supervision() {
  const { hasAccess, loading: accessLoading } = useModuleAccess('supervisao' as any);
  const { supervisees, loading, save, remove } = useSupervisees();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supervisee | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => supervisees.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())),
    [supervisees, query],
  );
  const selected = supervisees.find((s) => s.id === selectedId) || null;

  if (accessLoading) {
    return <div className="p-6"><div className="h-40 rounded-xl bg-muted animate-pulse" /></div>;
  }
  if (!hasAccess) {
    const mod = getModule('supervisao' as any);
    return <div className="max-w-4xl mx-auto p-4 sm:p-6">{mod && <ModulePaywall module={mod} />}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <Helmet>
        <title>Supervisão Clínica | Evolução Diária</title>
        <meta
          name="description"
          content="Gerencie supervisionandos, sessões de supervisão, horas, declarações e cobranças em um só lugar."
        />
      </Helmet>

      {selected ? (
        <>
          <div className="flex items-start gap-3 flex-wrap">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{selected.name}</h1>
              <p className="text-xs text-muted-foreground">
                {[selected.education, selected.council_registration, selected.approach].filter(Boolean).join(' · ') || 'Supervisionando'}
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => { setEditing(selected); setDialogOpen(true); }}>
              <Pencil className="w-4 h-4" /> Editar
            </Button>
          </div>
          <SuperviseeDetail supervisee={selected} />
        </>
      ) : (
        <>
          <header className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <GraduationCap className="w-6 h-6 text-primary" /> Supervisão
              </h1>
              <p className="text-sm text-muted-foreground">
                Supervisionandos, sessões, horas, declarações e cobranças.
              </p>
            </div>
            <Button className="gap-2" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4" /> Novo supervisionando
            </Button>
          </header>

          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar supervisionando..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhum supervisionando cadastrado ainda.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((s) => (
                <Card
                  key={s.id}
                  className="p-4 space-y-2 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => setSelectedId(s.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.council_registration || s.education || '—'}
                      </p>
                    </div>
                    <Badge variant={s.status === 'ativo' ? 'default' : 'secondary'}>
                      {s.status === 'ativo' ? 'Ativo' : 'Encerrado'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                    <Badge variant="outline">{s.link_type === 'equipe' ? 'Equipe' : 'Externo'}</Badge>
                    {s.recurrence_time && <span>{s.recurrence_frequency} · {s.recurrence_time}</span>}
                    {s.hours_goal ? <span>Meta: {s.hours_goal}h</span> : null}
                  </div>
                  <div className="flex justify-end gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setDialogOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Excluir ${s.name} e todos os registros de supervisão?`)) return;
                        await remove(s.id);
                        toast.success('Supervisionando excluído');
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <SuperviseeDialog open={dialogOpen} onOpenChange={setDialogOpen} supervisee={editing} onSave={save} />
    </div>
  );
}