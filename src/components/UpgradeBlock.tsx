import { Lock, Sparkles, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface UpgradeBlockProps {
  feature: 'ia' | 'portal' | 'team' | 'mural' | 'bulk_ai' | 'generic';
  title?: string;
  description?: string;
  compact?: boolean;
}

const FEATURE_COPY: Record<UpgradeBlockProps['feature'], { title: string; description: string; benefits?: string[] }> = {
  ia: {
    title: 'Recurso disponível no plano Pro',
    description:
      'A Inteligência Artificial (Doc IA, Melhorar Evolução, Feedbacks IA e Relatórios IA) está disponível no plano Pro.',
    benefits: [
      'Geração de documentos clínicos com IA',
      'Melhorar texto de evoluções automaticamente',
      'Feedbacks personalizados para os pais',
      'Relatórios IA completos e estruturados',
    ],
  },
  portal: {
    title: 'Portal do Paciente é exclusivo do plano Pro',
    description:
      'Para enviar convites, ativar contas no Portal do Paciente e gerenciar fichas digitais, faça upgrade para o plano Pro.',
    benefits: [
      'Acesso seguro do paciente e familiares',
      'Envio de fichas, atividades e documentos',
      'Mural de atividades com fotos e conquistas',
      'Mensagens diretas e comprovantes financeiros',
    ],
  },
  team: {
    title: 'Gestão de Equipe é exclusiva do plano Pro',
    description:
      'Convide profissionais, controle conformidade e acompanhe o financeiro de equipe no plano Pro.',
  },
  mural: {
    title: 'Mural de Avisos é exclusivo do plano Pro',
    description:
      'O Mural centraliza comunicados, vídeos e tutoriais para você e sua equipe — disponível no plano Pro.',
    benefits: [
      'Avisos fixados, vídeos e tutoriais em um só lugar',
      'Notificações automáticas por e-mail',
      'Categorização visual por tipo e cor',
      'Compartilhamento rápido com a equipe',
    ],
  },
  bulk_ai: {
    title: 'Feedback IA em lote é exclusivo do plano Pro',
    description:
      'Gere feedbacks personalizados para todos os pacientes do dia em poucos cliques — disponível no plano Pro.',
    benefits: [
      'Geração simultânea de feedbacks do dia inteiro',
      'Texto adaptado ao contexto de cada evolução',
      'Envio direto ao Portal do Paciente',
      'Economiza horas de redação manual',
    ],
  },
  generic: {
    title: 'Recurso exclusivo do plano Pro',
    description: 'Faça upgrade para o plano Pro para desbloquear este recurso.',
  },
};

export function UpgradeBlock({ feature, title, description, compact = false }: UpgradeBlockProps) {
  const navigate = useNavigate();
  const copy = FEATURE_COPY[feature];

  return (
    <Card className={compact ? 'border-primary/30 bg-primary/5' : 'max-w-xl mx-auto border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10'}>
      <CardContent className={compact ? 'py-4 px-4' : 'py-10 px-6'}>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-foreground flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {title || copy.title}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {description || copy.description}
            </p>
          </div>
          {!compact && copy.benefits && copy.benefits.length > 0 && (
            <ul className="w-full max-w-sm space-y-2 text-left bg-card/60 border border-border rounded-xl p-4">
              {copy.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          <Button onClick={() => navigate('/pricing')} className="gap-2">
            Assinar plano Pro
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
