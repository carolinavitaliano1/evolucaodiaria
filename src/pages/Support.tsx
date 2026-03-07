import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadSupportCount } from '@/hooks/useUnreadSupport';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Send, MessageCircle, HeadphonesIcon, CheckCheck, Search,
  ChevronLeft, Clock, PhoneOff, User, Mail, Phone, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SupportMessage {
  id: string;
  user_id: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
}

interface Conversation {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_avatar: string | null;
  user_phone: string | null;
  last_message: string;
  last_at: string;
  unread: number;
  is_closed: boolean;
  closed_by: string | null;
}

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Ontem';
  return format(d, 'dd/MM/yy');
}

function formatFullTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Ontem ' + format(d, 'HH:mm');
  return format(d, "dd/MM 'às' HH:mm", { locale: ptBR });
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "dd 'de' MMMM", { locale: ptBR });
}

function initials(name: string | null, email: string | null) {
  return (name || email || 'U').charAt(0).toUpperCase();
}

// ─────────────────────────────────────────────
// ADMIN VIEW
// ─────────────────────────────────────────────
function AdminSupportView() {
  const { user } = useAuth();
  const { markAdminSeen } = useUnreadSupportCount();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filtered, setFiltered] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [closingChat, setClosingChat] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [reopening, setReopening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Mark admin as seen as soon as the view mounts
  useEffect(() => { markAdminSeen(); }, []);

  const loadConversations = useCallback(async () => {
    const { data: msgs } = await supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (!msgs) return;

    // Fetch which user_ids have a closed session
    const { data: sessions } = await supabase
      .from('support_chat_sessions')
      .select('user_id, closed_at, closed_by')
      .order('closed_at', { ascending: false });

    // Keep only the LATEST session per user_id
    const closedMap = new Map<string, { closed_at: string; closed_by: string }>();
    for (const s of (sessions || []) as any[]) {
      if (!closedMap.has(s.user_id)) closedMap.set(s.user_id, { closed_at: s.closed_at, closed_by: s.closed_by });
    }

    const map = new Map<string, SupportMessage[]>();
    for (const m of msgs as SupportMessage[]) {
      if (!map.has(m.user_id)) map.set(m.user_id, []);
      map.get(m.user_id)!.push(m);
    }

    const userIds = Array.from(map.keys());
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, email, avatar_url, phone')
      .in('user_id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const convs: Conversation[] = userIds.map(uid => {
      const userMsgs = map.get(uid)!;
      const latest = userMsgs[0];
      const profile = profileMap.get(uid) as any;
      const sessionInfo = closedMap.get(uid);
      const closedAt = sessionInfo?.closed_at;

      // A conversation is "closed" if the latest session close happened AFTER the last message
      const isClosed = closedAt
        ? new Date(closedAt) >= new Date(latest.created_at)
        : false;

      // unread = non-admin msgs after last close (or all non-admin if no close)
      const unread = userMsgs.filter(m => {
        if (m.is_admin_reply) return false;
        if (closedAt) return new Date(m.created_at) > new Date(closedAt);
        return true;
      }).length;

      return {
        user_id: uid,
        user_name: profile?.name || null,
        user_email: profile?.email || null,
        user_avatar: profile?.avatar_url || null,
        user_phone: profile?.phone || null,
        last_message: latest.message,
        last_at: latest.created_at,
        unread,
        is_closed: isClosed,
        closed_by: isClosed ? (sessionInfo?.closed_by || null) : null,
      };
    });
    convs.sort((a, b) => {
      // Open chats first, then by recency
      if (!a.is_closed && b.is_closed) return -1;
      if (a.is_closed && !b.is_closed) return 1;
      return new Date(b.last_at).getTime() - new Date(a.last_at).getTime();
    });
    setConversations(convs);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Filter by search
  useEffect(() => {
    if (!search.trim()) { setFiltered(conversations); return; }
    const q = search.toLowerCase();
    setFiltered(conversations.filter(c =>
      (c.user_name || '').toLowerCase().includes(q) ||
      (c.user_email || '').toLowerCase().includes(q) ||
      c.last_message.toLowerCase().includes(q)
    ));
  }, [search, conversations]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    markAdminSeen();
    supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', selected)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setMessages(data as SupportMessage[]); });
  }, [selected]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('support-admin-v4')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
        const msg = payload.new as SupportMessage;
        if (msg.user_id === selected) {
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
          markAdminSeen();
        }
        loadConversations();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_chat_sessions' }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected, loadConversations]);

  const handleSend = async () => {
    if (!user || !selected || !text.trim()) return;
    setSending(true);
    const optimistic: SupportMessage = {
      id: `tmp-${Date.now()}`,
      user_id: selected,
      message: text.trim(),
      is_admin_reply: true,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setText('');
    const { error } = await supabase.from('support_messages').insert({
      user_id: selected,
      message: optimistic.message,
      is_admin_reply: true,
      admin_id: user.id,
    });
    if (error) {
      toast.error('Erro ao enviar resposta');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } else {
      markAdminSeen();
      loadConversations();
      // Push notification to user (fire-and-forget)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        supabase.functions.invoke('push-support', {
          body: { targetUserId: selected, title: 'Suporte respondeu ✉️', body: optimistic.message.slice(0, 100) },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
      } catch (_) { /* silent */ }
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleCloseChat = async () => {
    if (!selected) return;
    setClosingChat(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke('close-support-chat', {
        body: { userId: selected, closedBy: 'admin' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      markAdminSeen();
      toast.success('Atendimento encerrado.');
      loadConversations();
    } catch {
      toast.error('Erro ao encerrar o chat');
    }
    setClosingChat(false);
    setShowCloseDialog(false);
  };

  // Reopen: delete the closed session so the conversation becomes open again
  const handleReopenChat = async () => {
    if (!selected) return;
    setReopening(true);
    try {
      // Delete the latest session for this user — edge function handles auth bypass
      // We use service-level deletion via the admin's session and RLS-exempt approach
      const { error } = await supabase
        .from('support_chat_sessions')
        .delete()
        .eq('user_id', selected);
      if (error) throw error;
      toast.success('Chamado reaberto com sucesso.');
      loadConversations();
    } catch {
      toast.error('Erro ao reabrir chamado');
    }
    setReopening(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const selectedConv = conversations.find(c => c.user_id === selected);
  const isClosed = selectedConv?.is_closed ?? false;

  const grouped: { date: string; msgs: SupportMessage[] }[] = [];
  for (const msg of messages) {
    const day = format(new Date(msg.created_at), 'yyyy-MM-dd');
    const last = grouped[grouped.length - 1];
    if (last && last.date === day) last.msgs.push(msg);
    else grouped.push({ date: day, msgs: [msg] });
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] md:h-[calc(100dvh-5rem)] overflow-hidden">
      {/* ── Sidebar ── */}
      <div className={cn(
        'flex flex-col bg-card border-r border-border',
        'w-full md:w-80 md:min-w-[280px]',
        selected ? 'hidden md:flex' : 'flex'
      )}>
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <HeadphonesIcon className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-base font-bold text-foreground">Suporte</h1>
            {conversations.filter(c => !c.is_closed).reduce((s, c) => s + c.unread, 0) > 0 && (
              <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {conversations.filter(c => !c.is_closed).reduce((s, c) => s + c.unread, 0)}
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
              <MessageCircle className="w-8 h-8 opacity-30" />
              <p className="text-sm">Nenhuma conversa</p>
            </div>
          ) : (
            filtered.map(conv => (
              <button
                key={conv.user_id}
                onClick={() => setSelected(conv.user_id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-accent transition-colors border-b border-border/50',
                  selected === conv.user_id && 'bg-primary/5 border-l-2 border-l-primary'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className={cn('w-11 h-11', conv.is_closed && 'opacity-60')}>
                    <AvatarImage src={conv.user_avatar ?? undefined} alt={conv.user_name || 'Usuário'} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-base">
                      {initials(conv.user_name, conv.user_email)}
                    </AvatarFallback>
                  </Avatar>
                  {!conv.is_closed && conv.unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-success text-success-foreground text-[9px] font-bold flex items-center justify-center">
                      {conv.unread > 9 ? '9+' : conv.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className={cn('text-sm text-foreground truncate', conv.unread > 0 && !conv.is_closed ? 'font-bold' : 'font-semibold', conv.is_closed && 'text-muted-foreground')}>
                      {conv.user_name || conv.user_email?.split('@')[0] || 'Sem nome'}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatMsgTime(conv.last_at)}
                    </span>
                  </div>
                  {conv.user_email && (
                    <p className="text-[10px] text-muted-foreground truncate mb-0.5">{conv.user_email}</p>
                  )}
                  <div className="flex items-center gap-1.5">
                    {/* Status tag */}
                    {conv.is_closed ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-muted-foreground border border-border shrink-0">
                        Finalizado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-warning/15 text-warning border border-warning/30 shrink-0">
                        Aguardando
                      </span>
                    )}
                    <p className={cn('text-xs truncate', conv.unread > 0 && !conv.is_closed ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                      {conv.last_message}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
            <button className="md:hidden p-1.5 rounded-lg hover:bg-accent" onClick={() => setSelected(null)}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left hover:bg-accent/50 rounded-lg px-1 py-0.5 transition-colors">
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={selectedConv?.user_avatar ?? undefined} alt={selectedConv?.user_name || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                      {initials(selectedConv?.user_name ?? null, selectedConv?.user_email ?? null)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">
                        {selectedConv?.user_name || selectedConv?.user_email?.split('@')[0] || 'Sem nome'}
                      </p>
                      {/* Status inline in header */}
                      {isClosed ? (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-muted-foreground border border-border">
                          Finalizado
                        </span>
                      ) : (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-warning/15 text-warning border border-warning/30">
                          Aguardando
                        </span>
                      )}
                    </div>
                    {selectedConv?.user_email && (
                      <p className="text-xs text-muted-foreground truncate">{selectedConv.user_email}</p>
                    )}
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-[min(16rem,calc(100vw-2rem))] p-0 overflow-hidden z-50">
                <div className="bg-primary/5 px-4 py-3 border-b border-border flex items-center gap-3">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={selectedConv?.user_avatar ?? undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {initials(selectedConv?.user_name ?? null, selectedConv?.user_email ?? null)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-semibold text-sm text-foreground truncate">
                    {selectedConv?.user_name || selectedConv?.user_email?.split('@')[0] || 'Sem nome'}
                  </p>
                </div>
                <div className="px-4 py-3 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground">{selectedConv?.user_name || <span className="text-muted-foreground italic text-xs">Não informado</span>}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {selectedConv?.user_email
                      ? <a href={`mailto:${selectedConv.user_email}`} className="text-sm text-primary underline underline-offset-2 break-all">{selectedConv.user_email}</a>
                      : <span className="text-muted-foreground italic text-xs">Não informado</span>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {selectedConv?.user_phone
                      ? <a href={`tel:${selectedConv.user_phone}`} className="text-sm text-primary">{selectedConv.user_phone}</a>
                      : <span className="text-muted-foreground italic text-xs">Não informado</span>}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Reopen / Close button in header */}
            {isClosed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReopenChat}
                disabled={reopening}
                className="shrink-0 gap-1.5 text-primary border-primary/30 hover:bg-primary/10 text-xs h-8 px-3"
              >
                <RefreshCw className={cn('w-3 h-3', reopening && 'animate-spin')} />
                Reabrir
              </Button>
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowCloseDialog(true)}
                disabled={closingChat}
                title="Encerrar Atendimento"
                className="shrink-0 h-8 w-8 rounded-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
            {grouped.map(({ date, msgs }) => (
              <div key={date} className="space-y-1">
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 rounded-full bg-background border border-border text-xs text-muted-foreground">
                    {dayLabel(date)}
                  </span>
                </div>
                {msgs.map((msg, idx) => {
                  const isMe = msg.is_admin_reply;
                  const prevSameSide = idx > 0 && msgs[idx - 1].is_admin_reply === msg.is_admin_reply;
                  const showAvatar = !isMe && !prevSameSide;
                  return (
                    <div key={msg.id} className={cn('flex items-end gap-2', isMe ? 'justify-end' : 'justify-start', prevSameSide ? 'mt-0.5' : 'mt-3')}>
                      {!isMe && (
                        <div className="shrink-0 w-7">
                          {showAvatar && (
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={selectedConv?.user_avatar ?? undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                                {initials(selectedConv?.user_name ?? null, selectedConv?.user_email ?? null)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      )}
                      <div className={cn(
                        'max-w-[75%] sm:max-w-[58%] px-3 py-2 text-sm shadow-sm',
                        isMe
                          ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                          : 'bg-card text-foreground rounded-2xl rounded-tl-sm border border-border'
                      )}>
                        {!isMe && !prevSameSide && (
                          <p className="text-[10px] font-bold text-primary mb-1">
                            {selectedConv?.user_name || selectedConv?.user_email?.split('@')[0] || 'Usuário'}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className={cn('text-[10px]', isMe ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                            {formatFullTime(msg.created_at)}
                          </span>
                          {isMe && <CheckCheck className="w-3 h-3 text-primary-foreground/60" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {isClosed && (
              <div className="flex items-center justify-center py-4">
                <span className="px-4 py-2 rounded-full bg-muted border border-border text-xs text-muted-foreground text-center">
                  🔒 Chat encerrado por {selectedConv?.closed_by === 'admin' ? 'Administrador' : (selectedConv?.user_name || 'Usuário')}
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input or closed state */}
          {isClosed ? (
            <div className="flex items-center justify-center gap-3 px-4 py-3 bg-card border-t border-border">
              <p className="text-xs text-muted-foreground">Chat finalizado.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReopenChat}
                disabled={reopening}
                className="gap-1.5 text-primary border-primary/30 hover:bg-primary/10 text-xs h-8 px-3"
              >
                <RefreshCw className={cn('w-3 h-3', reopening && 'animate-spin')} />
                Reabrir chamado
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-2 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] bg-card border-t border-border">
              <Textarea
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Responder..."
                className="resize-none min-h-[42px] max-h-28 text-sm rounded-2xl bg-muted border-0 focus-visible:ring-1"
                rows={1}
              />
              <Button size="icon" onClick={handleSend} disabled={sending || !text.trim()} className="shrink-0 h-10 w-10 rounded-full">
                {sending ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-3 text-muted-foreground">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <HeadphonesIcon className="w-10 h-10 opacity-30" />
          </div>
          <p className="text-sm font-medium">Selecione uma conversa para responder</p>
        </div>
      )}

      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent className="mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Um e-mail com a transcrição será enviado ao usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {closingChat ? 'Encerrando...' : 'Sim, encerrar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// USER VIEW
// ─────────────────────────────────────────────
function UserSupportView() {
  const { user } = useAuth();
  const { markSupportSeen } = useUnreadSupportCount();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isClosed, setIsClosed] = useState(false);
  const [closedBy, setClosedBy] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closingChat, setClosingChat] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [reopening, setReopening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    const [{ data: msgs }, { data: sessions }] = await Promise.all([
      supabase.from('support_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('support_chat_sessions').select('closed_at, closed_by').eq('user_id', user.id).order('closed_at', { ascending: false }).limit(1),
    ]);

    const msgList = (msgs as SupportMessage[]) || [];
    setMessages(msgList);

    if (sessions && sessions.length > 0) {
      const closedAt = (sessions[0] as any).closed_at;
      const sessionClosedBy = (sessions[0] as any).closed_by || null;
      const lastMsg = msgList[msgList.length - 1];
      const closed = lastMsg
        ? new Date(closedAt).getTime() >= new Date(lastMsg.created_at).getTime() - 2000
        : true;
      setIsClosed(closed);
      setClosedBy(closed ? sessionClosedBy : null);
    } else {
      setIsClosed(false);
      setClosedBy(null);
    }

    setLoading(false);
  }, [user]);

  // Mark as seen immediately when user opens the support page
  useEffect(() => {
    markSupportSeen();
    loadMessages();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`support-user-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'support_messages',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const newMsg = payload.new as SupportMessage;
        setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        // New message means chat was reopened/active
        setIsClosed(false);
        setClosedBy(null);
        // If admin replied, mark as seen immediately (user is on the page)
        if (newMsg.is_admin_reply) markSupportSeen();
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'support_chat_sessions',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setIsClosed(true);
        setClosedBy((payload.new as any)?.closed_by || null);
        markSupportSeen();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSend = async () => {
    if (!user || !text.trim() || isClosed) return;
    setSending(true);
    const msgText = text.trim();
    const optimistic: SupportMessage = {
      id: `tmp-${Date.now()}`,
      user_id: user.id,
      message: msgText,
      is_admin_reply: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setText('');

    const { error } = await supabase.from('support_messages').insert({
      user_id: user.id,
      message: msgText,
      is_admin_reply: false,
    });

    if (error) {
      toast.error('Erro ao enviar mensagem');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setSending(false);
      return;
    }

    // Notify admins (fire-and-forget)
    try {
      const { data: profile } = await supabase.from('profiles').select('name, email').eq('user_id', user.id).single();
      supabase.functions.invoke('notify-support', {
        body: {
          senderName: (profile as any)?.name || null,
          senderEmail: (profile as any)?.email || user.email || null,
          senderUserId: user.id,
          messageText: msgText,
        },
      });
    } catch (_) { /* silent */ }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleCloseChat = async () => {
    if (!user) return;
    setClosingChat(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke('close-support-chat', {
        body: { userId: user.id, closedBy: 'user' },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      toast.success('Atendimento encerrado.');
      markSupportSeen();
      setIsClosed(true);
    } catch {
      toast.error('Erro ao encerrar o chat');
    }
    setClosingChat(false);
    setShowCloseDialog(false);
  };

  // User reopen: delete sessions and mark chat as open
  const handleReopenChat = async () => {
    if (!user) return;
    setReopening(true);
    try {
      const { error } = await supabase
        .from('support_chat_sessions')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      setIsClosed(false);
      toast.success('Chamado reaberto. Você pode enviar novas mensagens.');
    } catch {
      toast.error('Erro ao reabrir chamado');
    }
    setReopening(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const grouped: { date: string; msgs: SupportMessage[] }[] = [];
  for (const msg of messages) {
    const day = format(new Date(msg.created_at), 'yyyy-MM-dd');
    const last = grouped[grouped.length - 1];
    if (last && last.date === day) last.msgs.push(msg);
    else grouped.push({ date: day, msgs: [msg] });
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-[calc(100dvh-5rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <HeadphonesIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground leading-tight">Suporte Evolução Diária</h1>
          {isClosed ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-muted text-muted-foreground border border-border">
              Finalizado
            </span>
          ) : (
            <p className="text-xs text-success font-medium">online</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ background: 'hsl(var(--muted) / 0.3)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-primary/40" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Olá! Como podemos ajudar?</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Descreva sua dúvida ou problema abaixo e responderemos o mais breve possível.
              </p>
            </div>
          </div>
        ) : (
          grouped.map(({ date, msgs }) => (
            <div key={date} className="space-y-1">
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 rounded-full bg-background border border-border text-xs text-muted-foreground">
                  {dayLabel(date)}
                </span>
              </div>
              {msgs.map((msg, idx) => {
                const isMe = !msg.is_admin_reply;
                const prevSameSide = idx > 0 && msgs[idx - 1].is_admin_reply === msg.is_admin_reply;
                return (
                  <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start', prevSameSide ? 'mt-0.5' : 'mt-3')}>
                    <div className={cn(
                      'max-w-[78%] sm:max-w-[60%] px-3 py-2 text-sm shadow-sm',
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                        : 'bg-card text-foreground rounded-2xl rounded-tl-sm border border-border'
                    )}>
                      {!isMe && !prevSameSide && <p className="text-[10px] font-bold text-primary mb-1">Suporte</p>}
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className={cn('text-[10px]', isMe ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                          {formatFullTime(msg.created_at)}
                        </span>
                        {isMe && <CheckCheck className="w-3 h-3 text-primary-foreground/60" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        {isClosed && messages.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <span className="px-4 py-2 rounded-full bg-muted border border-border text-xs text-muted-foreground text-center">
              Atendimento encerrado
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Closed state bar */}
      {isClosed ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-card border-t border-border">
          <p className="text-xs text-muted-foreground">Precisa de mais ajuda?</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReopenChat}
            disabled={reopening}
            className="shrink-0 gap-1.5 text-primary border-primary/30 hover:bg-primary/10 text-xs h-8 px-3"
          >
            <RefreshCw className={cn('w-3 h-3', reopening && 'animate-spin')} />
            Reabrir chamado
          </Button>
        </div>
      ) : (
        <>
          {messages.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card border-t border-border/60">
              <p className="text-xs text-muted-foreground truncate">Atendimento resolvido?</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCloseDialog(true)}
                disabled={closingChat}
                className="shrink-0 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-xs h-8 px-3"
              >
                <PhoneOff className="w-3 h-3" />
                Encerrar
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] bg-card border-t border-border">
            <Textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mensagem"
              className="resize-none min-h-[42px] max-h-28 text-sm rounded-2xl bg-muted border-0 focus-visible:ring-1"
              rows={1}
            />
            <Button size="icon" onClick={handleSend} disabled={sending || !text.trim()} className="shrink-0 h-10 w-10 rounded-full">
              {sending
                ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </>
      )}

      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent className="mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Você pode reabrir o chamado a qualquer momento se precisar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {closingChat ? 'Encerrando...' : 'Sim, encerrar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// SMART ENTRY POINT
// ─────────────────────────────────────────────
export default function Support() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_support_admin')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => setIsAdmin(!!(data as any)?.is_support_admin));
  }, [user]);

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return isAdmin ? <AdminSupportView /> : <UserSupportView />;
}
