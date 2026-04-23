import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, UserCheck, UserX, Briefcase, Mail, Phone, MessageSquare, ChevronDown, ChevronUp, Inbox, Cake, IdCard, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TeamApplication {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  specialty: string | null;
  specialties: string[] | null;
  professional_id: string | null;
  message: string | null;
  role: string | null;
  birthdate: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface TeamApplicationsPanelProps {
  organizationId: string;
  canManage: boolean;
}

export function TeamApplicationsPanel({ organizationId, canManage }: TeamApplicationsPanelProps) {
  const [applications, setApplications] = useState<TeamApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('team_applications' as any)
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!error && data) setApplications(data as any);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`team-apps-${organizationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_applications',
        filter: `organization_id=eq.${organizationId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organizationId, load]);

  const handleApprove = async (app: TeamApplication) => {
    if (!canManage) return;
    setActingId(app.id);
    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          organization_id: organizationId,
          email: app.email,
          role: 'professional',
          role_label: app.role || (app.specialties && app.specialties[0]) || app.specialty || null,
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);

      const { error: upErr } = await supabase
        .from('team_applications' as any)
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq('id', app.id);
      if (upErr) throw upErr;

      toast.success(`Convite enviado para ${app.email}`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao aprovar cadastro');
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (app: TeamApplication) => {
    if (!canManage) return;
    setActingId(app.id);
    const { error } = await supabase
      .from('team_applications' as any)
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq('id', app.id);
    setActingId(null);
    if (error) toast.error('Erro ao recusar cadastro');
    else {
      toast.success('Cadastro recusado');
      load();
    }
  };

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return null;

  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm text-foreground">Cadastros de funcionários pendentes</h3>
          </div>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={load}>
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Nenhum cadastro pendente. Quando alguém preencher o link de cadastro de funcionário, aparecerá aqui para revisão.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-warning/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-warning" />
          <h3 className="font-semibold text-sm text-foreground">
            Cadastros de funcionários pendentes
          </h3>
          <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-[10px] h-5">
            {applications.length}
          </Badge>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {applications.map(app => {
            const isExpanded = expandedItems.has(app.id);
            return (
              <div key={app.id} className="rounded-lg border border-border bg-card">
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground">{app.name}</p>
                        {(app.specialties && app.specialties.length > 0
                          ? app.specialties
                          : app.specialty ? [app.specialty] : []
                        ).map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {s}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3" /> {app.email}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Recebida em {format(new Date(app.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleReject(app)}
                          disabled={actingId === app.id}
                        >
                          <UserX className="w-3 h-3" /> Recusar
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => handleApprove(app)}
                          disabled={actingId === app.id}
                        >
                          {actingId === app.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                          Aprovar
                        </Button>
                      </div>
                    )}
                  </div>

                  {(app.whatsapp || app.professional_id || app.message || app.role || app.birthdate) && (
                    <button
                      onClick={() => toggleItem(app.id)}
                      className="text-[11px] text-primary hover:underline mt-2"
                    >
                      {isExpanded ? 'Ocultar detalhes' : 'Ver mais detalhes'}
                    </button>
                  )}

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs">
                      {app.role && (
                        <p className="text-muted-foreground flex items-center gap-1.5">
                          <IdCard className="w-3 h-3" /> Função: <strong className="text-foreground font-medium">{app.role}</strong>
                        </p>
                      )}
                      {app.birthdate && (
                        <p className="text-muted-foreground flex items-center gap-1.5">
                          <Cake className="w-3 h-3" /> Nascimento: {format(new Date(app.birthdate + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      )}
                      {app.whatsapp && (
                        <p className="text-muted-foreground flex items-center gap-1.5">
                          <Phone className="w-3 h-3" /> {app.whatsapp}
                        </p>
                      )}
                      {app.professional_id && (
                        <p className="text-muted-foreground flex items-center gap-1.5">
                          <Briefcase className="w-3 h-3" /> Registro: {app.professional_id}
                        </p>
                      )}
                      {app.message && (
                        <div className="text-muted-foreground flex gap-1.5">
                          <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                          <p className="leading-relaxed whitespace-pre-wrap">{app.message}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}