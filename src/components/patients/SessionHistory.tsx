import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Filter,
  FileText,
  CalendarPlus,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Session {
  id: string;
  title: string | null;
  created_at: string;
  duration_seconds: number | null;
  mood_score: number | null;
  status: string;
  notes_text?: string | null;
  action_plans?: string | null;
  next_session_notes?: string | null;
  general_comments?: string | null;
  positive_feelings?: string[];
  negative_feelings?: string[];
  suicidal_thoughts?: boolean;
}

interface SessionHistoryProps {
  sessions: Session[];
  onView: (session: Session) => void;
  onEdit: (session: Session) => void;
  onDelete: (sessionId: string) => void;
  onNewSession: () => void;
  onGenerateReport: () => void;
}

const moodEmojis = ['😭', '😢', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'];

function getMoodColor(score: number): string {
  if (score <= 3) return 'bg-red-100 dark:bg-red-900/30';
  if (score <= 5) return 'bg-amber-100 dark:bg-amber-900/30';
  if (score <= 7) return 'bg-green-100 dark:bg-green-900/30';
  return 'bg-emerald-100 dark:bg-emerald-900/30';
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

export function SessionHistory({
  sessions,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onNewSession,
  onGenerateReport,
}: SessionHistoryProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Group sessions by month/year
  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; sessions: Session[] }>();
    sessions.forEach((s) => {
      const date = parseISO(s.created_at);
      const key = format(date, 'yyyy-MM');
      const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
      const capitalLabel = label.charAt(0).toUpperCase() + label.slice(1);
      if (!map.has(key)) {
        map.set(key, { label: capitalLabel, sessions: [] });
      }
      map.get(key)!.sessions.push(s);
    });
    return Array.from(map.entries());
  }, [sessions]);

  const totalSessions = sessions.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Minhas sessões</h2>
          <Badge variant="secondary" className="text-xs">
            {totalSessions} {totalSessions === 1 ? 'sessão' : 'sessões'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtrar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onGenerateReport}
          >
            <FileText className="w-3.5 h-3.5" />
            Relatório
          </Button>
          <Button size="sm" className="gap-1.5" onClick={onNewSession}>
            <CalendarPlus className="w-3.5 h-3.5" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {totalSessions === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma sessão registrada ainda.</p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={onNewSession}>
            <CalendarPlus className="w-3.5 h-3.5" />
            Iniciar primeira sessão
          </Button>
        </div>
      )}

      {/* Accordion by month */}
      {grouped.length > 0 && (
        <Accordion type="multiple" defaultValue={grouped.map(([key]) => key)} className="space-y-2">
          {grouped.map(([key, { label, sessions: monthSessions }]) => (
            <AccordionItem
              key={key}
              value={key}
              className="border rounded-lg bg-card overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-medium text-sm text-foreground">{label}</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {monthSessions.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2">
                <div className="space-y-1.5">
                  {monthSessions.map((session) => {
                    const date = parseISO(session.created_at);
                    const displayTitle =
                      session.title ||
                      `Sessão ${format(date, 'dd/MM/yyyy HH:mm')}`;

                    return (
                      <div
                        key={session.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors group"
                      >
                        {/* Mood icon */}
                        <div
                          className={cn(
                            'w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg',
                            session.mood_score
                              ? getMoodColor(session.mood_score)
                              : 'bg-muted'
                          )}
                        >
                          {session.mood_score
                            ? moodEmojis[session.mood_score - 1]
                            : '—'}
                        </div>

                        {/* Title & date */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {displayTitle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(date, "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                        </div>

                        {/* Duration */}
                        <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                          <Clock className="w-3 h-3" />
                          Duração: {formatDuration(session.duration_seconds)}
                        </div>

                        {/* Kebab menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onView(session)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Visualizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(session)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDuplicate(session)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicar sessão
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteId(session.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sessão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta sessão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  onDelete(deleteId);
                  setDeleteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
