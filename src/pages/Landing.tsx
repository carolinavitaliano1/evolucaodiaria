import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, Calendar, FileText, BarChart3, Shield, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  { icon: Users, title: 'Gestão de Pacientes', desc: 'Cadastro completo com diagnóstico, observações e histórico.' },
  { icon: FileText, title: 'Evoluções Detalhadas', desc: 'Registre sessões com humor, anexos e carimbos profissionais.' },
  { icon: Calendar, title: 'Agenda Inteligente', desc: 'Gerencie sessões, eventos e tarefas em um só lugar.' },
  { icon: BarChart3, title: 'Controle Financeiro', desc: 'Acompanhe valores por sessão, pacote e clínica.' },
  { icon: Shield, title: 'Dados Seguros', desc: 'Informações criptografadas e protegidas na nuvem.' },
  { icon: Sparkles, title: 'Relatórios em PDF', desc: 'Exporte evoluções e relatórios profissionais.' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-subtle opacity-60" />
        <div className="relative max-w-6xl mx-auto px-4 py-6">
          <nav className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl gradient-primary shadow-glow">
                <BookOpen className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">Evolução Diária</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate('/auth')}>
                Entrar
              </Button>
              <Button onClick={() => navigate('/auth')} className="gradient-primary gap-2">
                Começar Grátis <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </nav>

          <div className="text-center max-w-3xl mx-auto pb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              15 dias grátis para experimentar
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Simplifique a gestão dos seus{' '}
              <span className="text-primary">atendimentos clínicos</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              A plataforma completa para profissionais de saúde gerenciarem clínicas, pacientes, evoluções e finanças em um só lugar.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/auth')} className="gradient-primary gap-2 text-lg px-8 py-6 shadow-glow">
                Começar Teste Grátis <ArrowRight className="w-5 h-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/pricing')} className="text-lg px-8 py-6">
                Ver Planos
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Tudo que você precisa</h2>
            <p className="text-muted-foreground text-lg">Ferramentas profissionais para o seu dia a dia clínico</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass-card rounded-2xl p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 shadow-glow">
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 px-4 gradient-subtle">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Planos acessíveis</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Comece com <strong className="text-primary">15 dias grátis</strong> e escolha o plano ideal
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Mensal', price: 'R$ 29', period: '/mês' },
              { name: 'Bimestral', price: 'R$ 49', period: '/2 meses', popular: true },
              { name: 'Trimestral', price: 'R$ 59', period: '/3 meses' },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`glass-card rounded-2xl p-6 ${plan.popular ? 'border-2 border-primary shadow-glow scale-105' : ''}`}
              >
                {plan.popular && (
                  <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium mb-3">
                    Mais Popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                <div className="my-4">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> Acesso completo</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> 15 dias grátis</li>
                </ul>
                <Button
                  variant={plan.popular ? 'default' : 'outline'}
                  className={`w-full ${plan.popular ? 'gradient-primary' : ''}`}
                  onClick={() => navigate('/auth')}
                >
                  Começar
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Pronto para começar?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Experimente gratuitamente por 15 dias. Sem compromisso.
          </p>
          <Button size="lg" onClick={() => navigate('/auth')} className="gradient-primary gap-2 text-lg px-8 py-6 shadow-glow">
            Criar Minha Conta <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Evolução Diária</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Evolução Diária. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
