import { useState, useEffect, useRef } from 'react';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function messageDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "d 'de' MMMM", { locale: ptBR });
}

function typeLabel(type: string) {
  if (type === 'tarefa') return '📋 Tarefa para casa';
  if (type === 'feedback') return '💬 Feedback da sessão';
  return null;
}

export default function PortalMessages() {
  const { messages, sendMessage, markMessagesAsRead, loadMessages } = usePortal();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markMessagesAsRead();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      await sendMessage(trimmed, 'message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const grouped: { date: string; msgs: typeof messages }[] = [];
  for (const msg of messages) {
    const day = msg.created_at.split('T')[0];
    const last = grouped[grouped.length - 1];
    if (last && last.date === day) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: day, msgs: [msg] });
    }
  }

  return (
    <PortalLayout>
      <div className="flex flex-col h-[calc(100vh-10rem)]">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-lg font-bold text-foreground">Mensagens</h1>
          <p className="text-xs text-muted-foreground">Conversa com seu terapeuta</p>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <span className="text-4xl">💬</span>
              <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
            </div>
          )}

          {grouped.map(({ date, msgs }) => (
            <div key={date} className="space-y-2">
              {/* Date separator */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground font-medium px-2">
                  {messageDateLabel(date + 'T00:00:00')}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {msgs.map(msg => {
                const isFromTherapist = msg.sender_type === 'therapist';
                const label = typeLabel(msg.message_type);
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      isFromTherapist ? 'justify-start' : 'justify-end'
                    )}
                  >
                    <div className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5',
                      isFromTherapist
                        ? 'bg-muted rounded-tl-sm'
                        : 'bg-primary text-primary-foreground rounded-tr-sm'
                    )}>
                      {label && isFromTherapist && (
                        <p className="text-[10px] font-semibold text-primary mb-1 uppercase tracking-wide">
                          {label}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className={cn(
                        'text-[10px] mt-1',
                        isFromTherapist ? 'text-muted-foreground' : 'text-primary-foreground/70'
                      )}>
                        {format(new Date(msg.created_at), 'HH:mm')}
                        {!isFromTherapist && msg.read_by_therapist && (
                          <span className="ml-1">✓✓</span>
                        )}
                        {!isFromTherapist && !msg.read_by_therapist && (
                          <span className="ml-1">✓</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 items-end pt-2 border-t border-border">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva uma mensagem..."
            className="resize-none min-h-[44px] max-h-28 flex-1 rounded-2xl text-sm"
            rows={1}
          />
          <Button
            size="icon"
            className="h-11 w-11 rounded-2xl flex-shrink-0"
            onClick={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </PortalLayout>
  );
}
