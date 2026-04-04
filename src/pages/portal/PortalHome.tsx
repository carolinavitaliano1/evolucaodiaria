import { useNavigate } from 'react-router-dom';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { MessageSquare, FileText, Bell, DollarSign, BookOpen, FilePenLine, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PortalHome() {
  const { patient, messages, unreadCount } = usePortal();
  const navigate = useNavigate();

  const therapistMessages = messages.filter(m => m.sender_type === 'therapist');
  const lastTherapistMessage = therapistMessages[therapistMessages.length - 1];

  const messageTypeLabel = (type: string) => {
    if (type === 'tarefa') return '📋 Tarefa';
    if (type === 'feedback') return '✨ Feedback da sessão';
    return '💬 Mensagem';
  };

  const quickActions = [
    { to: '/portal/mensagens', icon: MessageSquare, label: 'Mensagens', desc: `${messages.length} ${messages.length === 1 ? 'mensagem' : 'mensagens'}`, badge: unreadCount },
    { to: '/portal/avisos', icon: Bell, label: 'Avisos', desc: 'Comunicados do terapeuta' },
    { to: '/portal/financeiro', icon: DollarSign, label: 'Financeiro', desc: 'Pagamentos e recibos' },
    { to: '/portal/fichas', icon: FileText, label: 'Minhas Fichas', desc: 'Fichas e questionários' },
    { to: '/portal/evolucoes', icon: BookOpen, label: 'Feedback', desc: 'Feedbacks da sessão' },
    { to: '/portal/contrato', icon: FilePenLine, label: 'Contrato', desc: 'Contrato terapêutico' },
  ];

  return (
    <PortalLayout>
      <div className="space-y-5">
        {/* Greeting */}
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Olá, {patient?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        {/* Unread messages alert */}
        {unreadCount > 0 && (
          <div
            className="bg-primary rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => navigate('/portal/mensagens')}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-foreground font-semibold text-sm">
                  {unreadCount} {unreadCount === 1 ? 'mensagem nova' : 'mensagens novas'}
                </p>
                <p className="text-primary-foreground/80 text-xs mt-0.5">Toque para ver</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>
          </div>
        )}

        {/* Quick actions grid */}
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(({ to, icon: Icon, label, desc, badge }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="bg-card rounded-2xl border border-border p-4 text-left hover:border-primary/30 transition-colors active:scale-[0.97] relative"
            >
              {badge && badge > 0 ? (
                <span className="absolute top-3 right-3 min-w-[20px] h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {badge > 9 ? '9+' : badge}
                </span>
              ) : null}
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <p className="font-semibold text-sm text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </button>
          ))}
        </div>

        {/* Last message preview */}
        {lastTherapistMessage && (
          <div
            className="bg-card rounded-2xl border border-border p-4 cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => navigate('/portal/mensagens')}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Última mensagem do terapeuta
              </p>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-primary font-medium mb-1">
              {messageTypeLabel(lastTherapistMessage.message_type)}
            </p>
            <p className="text-sm text-foreground line-clamp-3 leading-relaxed">
              {lastTherapistMessage.content}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {format(new Date(lastTherapistMessage.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        )}

        {messages.length === 0 && (
          <div className="bg-card rounded-2xl border border-border p-6 text-center">
            <div className="text-4xl mb-3">🌱</div>
            <p className="font-semibold text-foreground text-sm">Tudo pronto!</p>
            <p className="text-xs text-muted-foreground mt-1">
              Seu terapeuta enviará mensagens e tarefas por aqui em breve.
            </p>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
