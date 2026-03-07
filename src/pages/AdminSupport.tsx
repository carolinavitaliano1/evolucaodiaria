import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, HeadphonesIcon, Users, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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
  last_message: string;
  last_at: string;
  unread: number;
}

export default function AdminSupport() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Check admin
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('is_support_admin')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setIsAdmin(!!(data as any)?.is_support_admin);
      });
  }, [user]);

  // Load all conversations (admin only)
  const loadConversations = async () => {
    const { data: msgs } = await supabase
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (!msgs) return;

    // Group by user_id
    const map = new Map<string, SupportMessage[]>();
    for (const m of msgs as SupportMessage[]) {
      if (!map.has(m.user_id)) map.set(m.user_id, []);
      map.get(m.user_id)!.push(m);
    }

    // Fetch profiles
    const userIds = Array.from(map.keys());
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, email')
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
        last_message: latest.message,
        last_at: latest.created_at,
        unread: userMsgs.filter(m => !m.is_admin_reply).length,
      };
    });

    convs.sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
    setConversations(convs);
  };

  useEffect(() => {
    if (isAdmin) loadConversations();
  }, [isAdmin]);

  // Load selected conversation messages
  useEffect(() => {
    if (!selected) return;
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
      .channel('support-admin')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
        const msg = payload.new as SupportMessage;
        if (msg.user_id === selected) {
          setMessages(prev => [...prev, msg]);
        }
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, selected]);

  const handleSend = async () => {
    if (!user || !selected || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.from('support_messages').insert({
      user_id: selected,
      message: text.trim(),
      is_admin_reply: true,
      admin_id: user.id,
    });
    if (error) {
      toast.error('Erro ao enviar resposta');
    } else {
      setText('');
    }
    setSending(false);
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

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] p-4 md:p-6 gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <HeadphonesIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Painel de Suporte</h1>
          <p className="text-xs text-muted-foreground">{conversations.length} conversas</p>
        </div>
      </div>

      <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex min-h-0">
        {/* Sidebar list */}
        <div className={cn(
          "w-full md:w-72 border-r border-border flex flex-col",
          selected && "hidden md:flex"
        )}>
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Conversas
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
              </div>
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.user_id}
                  onClick={() => setSelected(conv.user_id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 text-left hover:bg-accent transition-colors border-b border-border/50',
                    selected === conv.user_id && 'bg-primary/5'
                  )}
                >
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                      {(conv.user_name || conv.user_email || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {conv.user_name || conv.user_email || 'Usuário'}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(conv.last_at), "dd/MM", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        {selected ? (
          <div className={cn("flex-1 flex flex-col min-w-0", !selected && "hidden md:flex")}>
            {/* Chat header */}
            <div className="p-3 border-b border-border flex items-center gap-2">
              <button
                className="md:hidden p-1 rounded-lg hover:bg-accent"
                onClick={() => setSelected(null)}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                  {(selectedConv?.user_name || selectedConv?.user_email || 'U').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {selectedConv?.user_name || 'Usuário'}
                </p>
                {selectedConv?.user_email && (
                  <p className="text-xs text-muted-foreground truncate">{selectedConv.user_email}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.is_admin_reply ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                      msg.is_admin_reply
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted text-foreground rounded-tl-sm'
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className={cn(
                      'text-[10px] mt-1',
                      msg.is_admin_reply ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}>
                      {format(new Date(msg.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 flex gap-2 items-end">
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Responder... (Enter para enviar)"
                className="resize-none min-h-[44px] max-h-28 text-sm"
                rows={1}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={sending || !text.trim()}
                className="shrink-0 h-10 w-10"
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
            <HeadphonesIcon className="w-12 h-12 opacity-20" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        )}
      </div>
    </div>
  );
}
