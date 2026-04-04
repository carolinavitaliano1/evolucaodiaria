import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Loader2, Clock, UserPlus, Trash2, Eye, Link2, Send, Search,
  CheckCircle2, Phone, Mail, Calendar, MapPin, MessageSquare, Copy
} from 'lucide-react';

interface WaitlistEntry {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birthdate: string | null;
  gender: string | null;
  address: string | null;
  reason: string | null;
  preferred_days: string[] | null;
  preferred_time: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export function WaitlistManager() {
  const { user } = useAuth();
  const { clinics } = useApp();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClinic, setFilterClinic] = useState('all');
  const [filterStatus, setFilterStatus] = useState('waiting');
  const [detailEntry, setDetailEntry] = useState<WaitlistEntry | null>(null);
  const [editNotes, setEditNotes] = useState('');

  // Link generation
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkClinicId, setLinkClinicId] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  const activeClinics = useMemo(() => clinics.filter(c => !c.isArchived), [clinics]);

  const loadEntries = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('waitlist_entries' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setEntries((data || []) as unknown as WaitlistEntry[]);
    setLoading(false);
  };

  useEffect(() => { loadEntries(); }, [user]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterClinic !== 'all' && e.clinic_id !== filterClinic) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (search.trim()) {
        const term = search.toLowerCase();
        const fullName = `${e.first_name} ${e.last_name || ''}`.toLowerCase();
        if (!fullName.includes(term) && !e.email?.toLowerCase().includes(term) && !e.phone?.includes(term)) return false;
      }
      return true;
    });
  }, [entries, filterClinic, filterStatus, search]);

  const handleUpdateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('waitlist_entries' as any).update({ status } as any).eq('id', id);
    if (error) { toast.error('Erro ao atualizar'); return; }
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    if (detailEntry?.id === id) setDetailEntry(prev => prev ? { ...prev, status } : null);
    toast.success('Status atualizado');
  };

  const handleSaveNotes = async () => {
    if (!detailEntry) return;
    await supabase.from('waitlist_entries' as any).update({ notes: editNotes } as any).eq('id', detailEntry.id);
    setEntries(prev => prev.map(e => e.id === detailEntry.id ? { ...e, notes: editNotes } : e));
    setDetailEntry(prev => prev ? { ...prev, notes: editNotes } : null);
    toast.success('Notas salvas');
  };

  const handleDelete = async (id: string) => {
    await supabase.from('waitlist_entries' as any).delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    if (detailEntry?.id === id) setDetailEntry(null);
    toast.success('Entrada removida');
  };

  const handleGenerateLink = () => {
    if (!linkClinicId) return;
    const link = `https://evolucaodiaria.app.br/lista-espera/${linkClinicId}`;
    setGeneratedLink(link);
  };

  const handleSendWhatsApp = (entry: WaitlistEntry, message: string) => {
    if (!entry.phone) return;
    const num = entry.phone.replace(/\D/g, '');
    const phone = num.startsWith('55') ? num : `55${num}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const statusCfg: Record<string, { label: string; cls: string }> = {
    waiting: { label: 'Aguardando', cls: 'bg-warning/10 text-warning border-warning/20' },
    contacted: { label: 'Contatado', cls: 'bg-info/10 text-info border-info/20' },
    converted: { label: 'Convertido', cls: 'bg-success/10 text-success border-success/20' },
    cancelled: { label: 'Cancelado', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  };

  const getClinicName = (clinicId: string) => clinics.find(c => c.id === clinicId)?.name || '—';

  const dayLabels: Record<string, string> = {
    segunda: 'Seg', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sabado: 'Sáb',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Lista de Espera
            {entries.filter(e => e.status === 'waiting').length > 0 && (
              <span className="bg-warning/10 text-warning text-[10px] font-medium px-2 py-0.5 rounded-full border border-warning/20">
                {entries.filter(e => e.status === 'waiting').length} aguardando
              </span>
            )}
          </h3>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 border-primary/30 text-primary"
          onClick={() => { setLinkDialogOpen(true); setGeneratedLink(''); setLinkClinicId(activeClinics[0]?.id || ''); }}>
          <Link2 className="w-3 h-3" /> Gerar Link
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail..." className="h-8 text-xs pl-8" />
        </div>
        <Select value={filterClinic} onValueChange={setFilterClinic}>
          <SelectTrigger className="h-8 text-xs w-[160px]">
            <SelectValue placeholder="Clínica" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as clínicas</SelectItem>
            {activeClinics.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="waiting">Aguardando</SelectItem>
            <SelectItem value="contacted">Contatado</SelectItem>
            <SelectItem value="converted">Convertido</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma inscrição encontrada</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Compartilhe o link de lista de espera para receber inscrições.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => {
            const cfg = statusCfg[entry.status] || statusCfg.waiting;
            return (
              <div key={entry.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">
                      {entry.first_name} {entry.last_name || ''}
                    </span>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', cfg.cls)}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-muted-foreground">
                    {entry.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {entry.phone}</span>}
                    {entry.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {entry.email}</span>}
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(entry.created_at), "d MMM yyyy", { locale: ptBR })}</span>
                    <span className="text-[10px] text-muted-foreground/60">{getClinicName(entry.clinic_id)}</span>
                  </div>
                  {entry.preferred_days && entry.preferred_days.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {entry.preferred_days.map(d => (
                        <span key={d} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          {dayLabels[d] || d}
                        </span>
                      ))}
                      {entry.preferred_time && (
                        <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{entry.preferred_time}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Ver detalhes"
                    onClick={() => { setDetailEntry(entry); setEditNotes(entry.notes || ''); }}>
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                  {entry.phone && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Enviar WhatsApp"
                      onClick={() => handleSendWhatsApp(entry, `Olá ${entry.first_name}! Temos uma vaga disponível para atendimento. Gostaria de agendar?`)}>
                      <Send className="w-3.5 h-3.5 text-success" />
                    </Button>
                  )}
                  {entry.status === 'waiting' && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Marcar como contatado"
                      onClick={() => handleUpdateStatus(entry.id, 'contacted')}>
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Remover"
                    onClick={() => handleDelete(entry.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailEntry} onOpenChange={v => !v && setDetailEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserPlus className="w-4 h-4 text-primary" />
              {detailEntry?.first_name} {detailEntry?.last_name || ''}
            </DialogTitle>
          </DialogHeader>
          {detailEntry && (
            <div className="space-y-4 pt-1">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground w-16">Status</Label>
                <Select value={detailEntry.status} onValueChange={v => handleUpdateStatus(detailEntry.id, v)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waiting">Aguardando</SelectItem>
                    <SelectItem value="contacted">Contatado</SelectItem>
                    <SelectItem value="converted">Convertido</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {detailEntry.email && (
                  <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" /> {detailEntry.email}
                  </div>
                )}
                {detailEntry.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {detailEntry.phone}
                  </div>
                )}
                {detailEntry.birthdate && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" /> {format(new Date(detailEntry.birthdate + 'T12:00:00'), "dd/MM/yyyy")}
                  </div>
                )}
                {detailEntry.gender && (
                  <div className="text-muted-foreground capitalize">{detailEntry.gender}</div>
                )}
                {detailEntry.address && (
                  <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" /> {detailEntry.address}
                  </div>
                )}
              </div>

              {/* Preferences */}
              {(detailEntry.preferred_days?.length || detailEntry.preferred_time) && (
                <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Preferência de horário
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {detailEntry.preferred_days?.map(d => (
                      <span key={d} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {dayLabels[d] || d}
                      </span>
                    ))}
                  </div>
                  {detailEntry.preferred_time && (
                    <p className="text-[11px] text-muted-foreground">{detailEntry.preferred_time}</p>
                  )}
                </div>
              )}

              {/* Reason */}
              {detailEntry.reason && (
                <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-1">
                  <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Motivo
                  </p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{detailEntry.reason}</p>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs">Notas internas</Label>
                <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  placeholder="Anotações sobre este paciente..." className="text-xs min-h-[60px] resize-none" />
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleSaveNotes}>
                  Salvar notas
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-border">
                {detailEntry.phone && (
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs"
                    onClick={() => handleSendWhatsApp(detailEntry, `Olá ${detailEntry.first_name}! Temos uma vaga disponível para atendimento. Gostaria de agendar?`)}>
                    <Send className="w-3 h-3" /> WhatsApp
                  </Button>
                )}
                <Button size="sm" variant="destructive" className="gap-1.5 text-xs"
                  onClick={() => handleDelete(detailEntry.id)}>
                  <Trash2 className="w-3 h-3" /> Remover
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                Inscrito em {format(new Date(detailEntry.created_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                {' · '}{getClinicName(detailEntry.clinic_id)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Link Generation Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" /> Link da Lista de Espera
            </DialogTitle>
          </DialogHeader>
          {!generatedLink ? (
            <div className="space-y-4 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">Clínica <span className="text-destructive">*</span></Label>
                <Select value={linkClinicId} onValueChange={setLinkClinicId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecionar clínica..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClinics.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full gap-1.5" onClick={handleGenerateLink} disabled={!linkClinicId}>
                <Link2 className="w-3.5 h-3.5" /> Gerar Link
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs">Link para compartilhar</Label>
                <div className="flex gap-2">
                  <Input readOnly value={generatedLink} className="text-xs" />
                  <Button variant="outline" size="icon" className="shrink-0"
                    onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success('Link copiado!'); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Compartilhe este link com potenciais pacientes. Eles poderão preencher o formulário e entrar na sua lista de espera.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setLinkDialogOpen(false)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
