import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, BookOpen } from 'lucide-react';
import { useEffect } from 'react';
import { useSubscription } from '@/hooks/useSubscription';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const { refresh } = useSubscription();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center animate-scale-in">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Assinatura Confirmada! 🎉</h1>
          <p className="text-muted-foreground">
            Seu plano foi ativado com sucesso. Aproveite todos os recursos do Evolução Diária!
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-center gap-2 text-primary">
            <BookOpen className="w-5 h-5" />
            <span className="font-semibold">Evolução Diária</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Seu período de teste gratuito de 15 dias começou. Você não será cobrado durante este período.
          </p>
        </div>

        <Button
          size="lg"
          onClick={() => navigate('/dashboard')}
          className="gradient-primary gap-2 w-full py-6 text-lg shadow-glow"
        >
          Ir para o Dashboard <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
