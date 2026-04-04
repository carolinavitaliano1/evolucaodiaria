import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Target, Plus, MoreVertical, Play, Pencil, Trash2, Link as LinkIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionPlan {
  id: string;
  title: string;
  objectives: string | null;
  activities: string | null;
  external_links: any;
  status: string;
  created_at: string;
}

interface SessionPlansListProps {
  plans: SessionPlan[];
  onNewPlan: () => void;
  onEditPlan: (plan: SessionPlan) => void;
  onDeletePlan: (planId: string) => void;
  onStartSession: (plan: SessionPlan) => void;
}

export function SessionPlansList({
  plans,
  onNewPlan,
  onEditPlan,
  onDeletePlan,
  onStartSession,
}: SessionPlansListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Planejamentos</h2>
          <Badge variant="secondary" className="text-xs">
            {plans.length} {plans.length === 1 ? 'plano' : 'planos'}
          </Badge>
        </div>
        <Button size="sm" className="gap-1.5" onClick={onNewPlan}>
          <Plus className="w-3.5 h-3.5" /> Novo Plano
        </Button>
      </div>

      {/* Empty state */}
      {plans.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum plano de sessão criado ainda.</p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={onNewPlan}>
            <Plus className="w-3.5 h-3.5" /> Criar primeiro plano
          </Button>
        </div>
      )}

      {/* Plans list */}
      <div className="space-y-2">
        {plans.map((plan) => {
          const date = parseISO(plan.created_at);
          const linksCount = Array.isArray(plan.external_links) ? plan.external_links.length : 0;

          return (
            <Card key={plan.id} className="border-border hover:shadow-sm transition-shadow group">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Target className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{plan.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Criado em {format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {plan.objectives && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.objectives}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {linksCount > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <LinkIcon className="w-2.5 h-2.5" /> {linksCount} {linksCount === 1 ? 'link' : 'links'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => onStartSession(plan)}
                      className="gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Iniciar Sessão
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditPlan(plan)}>
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(plan.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  onDeletePlan(deleteId);
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
