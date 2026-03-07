import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadSupportCount } from '@/hooks/useUnreadSupport';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Send, HeadphonesIcon, ChevronLeft, CheckCheck, Search, PhoneOff, Info, User, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  user_phone: string | null;
  user_avatar: string | null;
  last_message: string;
  last_at: string;
  unread: number;
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
  const src = name || email || 'U';
  return src.charAt(0).toUpperCase();
}

export default function AdminSupport() {
  const { user } = useAuth();
  const { markAdminSeen } = useUnreadSupportCount();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filtered, setFiltered] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [closingChat, setClosingChat] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check admin
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_support_admin')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => { setIsAdmin(!!(data as any)?.is_support_admin); });
  }, [user]);

  const loadConversations = async () => {
    const { data: msgs } = await supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (!msgs) return;

    const map = new Map<string, SupportMessage[]>();
    for (const m of msgs as SupportMessage[]) {
      if (!map.has(m.user_id)) map.set(m.user_id, []);
      map.get(m.user_id)!.push(m);
    }

    const userIds = Array.from(map.keys());
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, email, phone')
      .in('user_id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

    const convs: Conversation[] = userIds.map(uid => {
      const userMsgs = map.get(uid)!;
      const latest = userMsgs[0];
      const profile = profileMap.get(uid) as any;
      return {
        user_id: uid,
        user_name: profile?.name || null,
        user_email: profile?.email || null,
        user_phone: profile?.phone || null,
        last_message: latest.message,
        last_at: latest.created_at,
        unread: userMsgs.filter(m => !m.is_admin_reply).length,
      };
    });
    convs.sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
    setConversations(convs);
  };

  useEffect(() => { if (isAdmin) loadConversations(); }, [isAdmin]);

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
    supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', selected)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setMessages(data as SupportMessage[]); });
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('support-admin-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
        const msg = payload.new as SupportMessage;
        if (msg.user_id === selected) {
          setMessages(prev => {
            const exists = prev.some(m => m.id === msg.id);
            return exists ? prev : [...prev, msg];
          });
        }
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, selected]);

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
      // Fire push notification to user (fire-and-forget)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        supabase.functions.invoke('push-support', {
          body: {
            targetUserId: selected,
            title: 'Suporte respondeu ✉️',
            body: optimistic.message.slice(0, 100),
          },
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
      toast.success('Chat encerrado. Histórico enviado por e-mail.');
      setSelected(null);
      setMessages([]);
      loadConversations();
    } catch {
      toast.error('Erro ao encerrar o chat');
    }
    setClosingChat(false);
    setShowCloseDialog(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-center p-6">
        <HeadphonesIcon className="w-10 h-10 text-muted-foreground/40" />
        <p className="font-semibold text-foreground">Acesso restrito</p>
        <p className="text-sm text-muted-foreground">Esta área é exclusiva para administradores de suporte.</p>
      </div>
    );
  }

  const selectedConv = conversations.find(c => c.user_id === selected);

  // Group messages by date
  const grouped: { date: string; msgs: SupportMessage[] }[] = [];
  for (const msg of messages) {
    const day = format(new Date(msg.created_at), 'yyyy-MM-dd');
    const last = grouped[grouped.length - 1];
    if (last && last.date === day) last.msgs.push(msg);
    else grouped.push({ date: day, msgs: [msg] });
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] overflow-hidden">
      {/* ── Sidebar: conversation list ── */}
      <div className={cn(
        'flex flex-col bg-card border-r border-border',
        'w-full md:w-80 md:min-w-[280px]',
        selected ? 'hidden md:flex' : 'flex'
      )}>
        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-border">
          <h1 className="text-base font-bold text-foreground mb-2">Suporte</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar conversa..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
            </div>
          ) : (
            filtered.map(conv => (
              <button
                key={conv.user_id}
                onClick={() => setSelected(conv.user_id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors',
                  selected === conv.user_id && 'bg-primary/5'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-11 h-11">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {initials(conv.user_name, conv.user_email)}
                    </AvatarFallback>
                  </Avatar>
                  {conv.unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-success text-success-foreground text-[9px] font-bold flex items-center justify-center">
                      {conv.unread > 9 ? '9+' : conv.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={cn('text-sm font-semibold text-foreground truncate', conv.unread > 0 && 'font-bold')}>
                      {conv.user_name || conv.user_email || 'Usuário'}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatMsgTime(conv.last_at)}
                    </span>
                  </div>
                  <p className={cn('text-xs text-muted-foreground truncate mt-0.5', conv.unread > 0 && 'text-foreground font-medium')}>
                    {conv.last_message}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      {selected ? (
        <div className={cn('flex-1 flex flex-col min-w-0', !selected && 'hidden md:flex')}>
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
            <button className="md:hidden p-1.5 rounded-lg hover:bg-accent" onClick={() => setSelected(null)}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowUserInfo(v => !v)}
              className="relative flex items-center gap-3 flex-1 min-w-0 text-left"
            >
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {initials(selectedConv?.user_name ?? null, selectedConv?.user_email ?? null)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">
                  {selectedConv?.user_name || selectedConv?.user_email || 'Usuário'}
                </p>
                {selectedConv?.user_email && (
                  <p className="text-xs text-muted-foreground truncate">{selectedConv.user_email}</p>
                )}
              </div>
              <Info className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </div>

          {/* User info panel */}
          {showUserInfo && selectedConv && (
            <div className="bg-muted/40 border-b border-border px-4 py-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-foreground font-medium">{selectedConv.user_name || <span className="text-muted-foreground italic">Sem nome</span>}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {selectedConv.user_email
                  ? <a href={`mailto:${selectedConv.user_email}`} className="text-primary underline underline-offset-2 break-all">{selectedConv.user_email}</a>
                  : <span className="text-muted-foreground italic">Sem e-mail</span>}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {selectedConv.user_phone
                  ? <a href={`tel:${selectedConv.user_phone}`} className="text-primary">{selectedConv.user_phone}</a>
                  : <span className="text-muted-foreground italic">Sem telefone</span>}
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
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
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex', isMe ? 'justify-end' : 'justify-start', prevSameSide ? 'mt-0.5' : 'mt-3')}
                    >
                      <div
                        className={cn(
                          'max-w-[78%] sm:max-w-[60%] px-3 py-2 text-sm shadow-sm',
                          isMe
                            ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                            : 'bg-card text-foreground rounded-2xl rounded-tl-sm border border-border'
                        )}
                      >
                        {!isMe && !prevSameSide && (
                          <p className="text-[10px] font-bold text-primary mb-1">
                            {selectedConv?.user_name || 'Usuário'}
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
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 px-3 py-2 bg-card border-t border-border">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowCloseDialog(true)}
              disabled={closingChat || messages.length === 0}
              title="Finalizar Chat"
              className="shrink-0 h-10 w-10 rounded-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
            <Textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Responder..."
              className="resize-none min-h-[42px] max-h-28 text-sm rounded-2xl bg-muted border-0 focus-visible:ring-1"
              rows={1}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="shrink-0 h-10 w-10 rounded-full"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O histórico completo desta conversa será enviado por e-mail para você e para o usuário. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {closingChat ? 'Encerrando...' : 'Finalizar e enviar e-mail'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
