import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageCircle, HeadphonesIcon, CheckCheck } from 'lucide-react';
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

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Ontem ' + format(d, 'HH:mm');
  return format(d, "dd/MM 'às' HH:mm", { locale: ptBR });
}

export default function Support() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as SupportMessage[]);
    setLoading(false);
  };

  useEffect(() => { loadMessages(); }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`support-user-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'support_messages',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === (payload.new as SupportMessage).id);
          return exists ? prev : [...prev, payload.new as SupportMessage];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSend = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    const optimistic: SupportMessage = {
      id: `tmp-${Date.now()}`,
      user_id: user.id,
      message: text.trim(),
      is_admin_reply: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setText('');
    const { error } = await supabase.from('support_messages').insert({
      user_id: user.id,
      message: optimistic.message,
      is_admin_reply: false,
    });
    if (error) {
      toast.error('Erro ao enviar mensagem');
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const grouped: { date: string; msgs: SupportMessage[] }[] = [];
  for (const msg of messages) {
    const day = format(new Date(msg.created_at), 'yyyy-MM-dd');
    const last = grouped[grouped.length - 1];
    if (last && last.date === day) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: day, msgs: [msg] });
    }
  }

  function dayLabel(dateStr: string) {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    return format(d, "dd 'de' MMMM", { locale: ptBR });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)]">
      {/* WhatsApp-style header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <HeadphonesIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground leading-tight">Suporte Evolução Diária</h1>
          <p className="text-xs text-success font-medium">online</p>
        </div>
      </div>

      {/* Chat messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
        style={{ background: 'hsl(var(--muted) / 0.3)' }}
      >
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
              {/* Day separator */}
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 rounded-full bg-background border border-border text-xs text-muted-foreground">
                  {dayLabel(date)}
                </span>
              </div>

              {msgs.map((msg, idx) => {
                const isMe = !msg.is_admin_reply;
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
                        <p className="text-[10px] font-bold text-primary mb-1">Suporte</p>
                      )}
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.message}</p>
                      <div className={cn('flex items-center justify-end gap-1 mt-1')}>
                        <span className={cn('text-[10px]', isMe ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                          {formatMsgTime(msg.created_at)}
                        </span>
                        {isMe && (
                          <CheckCheck className="w-3 h-3 text-primary-foreground/60" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex items-end gap-2 px-3 py-2 bg-card border-t border-border">
        <Textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem"
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
  );
}
