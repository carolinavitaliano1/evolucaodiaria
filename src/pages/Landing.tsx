import { useNavigate } from 'react-router-dom';
import demoDashboard from '@/assets/demo-dashboard.jpg';
import demoEvolutions from '@/assets/demo-evolutions.jpg';
import demoCalendar from '@/assets/demo-calendar.jpg';
import demoReports from '@/assets/demo-reports.jpg';
import { Button } from '@/components/ui/button';
import { motion, type Variants } from 'framer-motion';
import {
  BookOpen, Users, Calendar, FileText, BarChart3, Shield, Sparkles,
  ArrowRight, CheckCircle2, Clock, Brain, AlertTriangle, Heart, Star, Quote,
  ChevronDown, Monitor,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const PAIN_POINTS = [
  {
    icon: Clock,
    title: 'Horas perdidas com papelada',
    desc: 'Fichas em papel, planilhas bagunçadas, evoluções escritas à mão que ninguém consegue ler depois.',
  },
  {
    icon: AlertTriangle,
    title: 'Medo de perder informações',
    desc: 'Dados de pacientes espalhados em cadernos, WhatsApp e pastas no computador — sem backup seguro.',
  },
  {
    icon: Brain,
    title: 'Sobrecarga mental constante',
    desc: 'Lembrar horários, cobranças, evoluções pendentes e relatórios ao mesmo tempo. Seu cérebro não é agenda.',
  },
];

const FEATURES = [
  { icon: Users, title: 'Gestão de Pacientes', desc: 'Cadastro completo com diagnóstico, frequência, humor e histórico de sessões — tudo em um só lugar.' },
  { icon: FileText, title: 'Evoluções com Carimbo', desc: 'Registre cada sessão com texto, humor, anexos e seu carimbo profissional. Exporte em PDF quando precisar.' },
  { icon: Calendar, title: 'Agenda Integrada', desc: 'Sessões, tarefas e eventos em uma agenda visual. Nunca mais esqueça um atendimento.' },
  { icon: BarChart3, title: 'Financeiro Automático', desc: 'Controle por sessão, pacote ou fixo mensal. Saiba exatamente quanto cada clínica rende.' },
  { icon: Shield, title: 'Segurança de Verdade', desc: 'Seus dados ficam criptografados na nuvem. Só você acessa. Sem planilhas vulneráveis.' },
  { icon: Sparkles, title: 'Relatórios com IA', desc: 'Crie relatórios clínicos com inteligência artificial — guiados por paciente ou com comando livre. Edite, salve e exporte em PDF.' },
];

const TESTIMONIALS = [
  {
    name: 'Dra. Camila Ribeiro',
    role: 'Psicóloga — São Paulo, SP',
    text: 'Antes eu perdia quase 1 hora por dia organizando fichas e evoluções. Com o Evolução Diária, faço tudo em minutos entre as sessões. Meus finais de semana voltaram a ser meus.',
    rating: 5,
  },
  {
    name: 'Dr. Marcos Oliveira',
    role: 'Fonoaudiólogo — Belo Horizonte, MG',
    text: 'Atendo em 3 clínicas diferentes e vivia confundindo agendas. Agora tenho tudo centralizado, com controle financeiro separado por clínica. Me salvou de verdade.',
    rating: 5,
  },
  {
    name: 'Dra. Ana Beatriz Santos',
    role: 'Terapeuta Ocupacional — Curitiba, PR',
    text: 'O que mais gosto é poder gerar relatórios em PDF com carimbo na hora. Quando o convênio pede documentação, está tudo pronto. Zero estresse.',
    rating: 5,
  },
];

const FAQ_ITEMS = [
  { q: 'O teste grátis é realmente sem compromisso?', a: 'Sim! Você tem 15 dias para testar todas as funcionalidades. Se não gostar, é só cancelar antes do fim do período de teste.' },
  { q: 'Meus dados ficam seguros?', a: 'Totalmente. Utilizamos criptografia de ponta a ponta e servidores seguros na nuvem. Apenas você tem acesso aos seus dados — nem mesmo nossa equipe consegue visualizá-los.' },
  { q: 'Posso usar em mais de uma clínica?', a: 'Sim! Você pode cadastrar quantas clínicas quiser e gerenciar pacientes, agenda e financeiro de cada uma separadamente.' },
  { q: 'Funciona no celular?', a: 'Sim. O sistema é totalmente responsivo e funciona perfeitamente no navegador do seu celular ou tablet, sem precisar instalar nada.' },
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim, sem multas ou burocracia. Basta cancelar na área de assinatura e você mantém acesso até o fim do período pago.' },
  { q: 'Quais profissionais podem usar?', a: 'Psicólogos, fonoaudiólogos, terapeutas ocupacionais, fisioterapeutas, psicopedagogos e qualquer profissional de saúde que atenda em clínicas.' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg gradient-primary shadow-glow">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">Evolução Diária</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Entrar</Button>
            <Button size="sm" onClick={() => navigate('/auth')} className="gradient-primary gap-1.5">
              Começar Grátis <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero — Empathy-first */}
      <header className="relative">
        <div className="absolute inset-0 gradient-subtle opacity-50" />
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-20 text-center">
          <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Heart className="w-4 h-4" /> Feito por quem entende sua rotina
            </span>
          </motion.div>
          <motion.h1 initial="hidden" animate="visible" custom={1} variants={fadeUp}
            className="text-3xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Você escolheu cuidar de pessoas.
            <br />
            <span className="text-primary">Deixa a burocracia com a gente.</span>
          </motion.h1>
          <motion.p initial="hidden" animate="visible" custom={2} variants={fadeUp}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Evoluções, agenda, financeiro e relatórios — tudo organizado para que você foque no que realmente importa: seus pacientes.
          </motion.p>
          <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/auth')}
              className="gradient-primary gap-2 text-lg px-8 py-6 shadow-glow">
              Experimentar 15 Dias Grátis <ArrowRight className="w-5 h-5" />
            </Button>
            <p className="text-sm text-muted-foreground">15 dias grátis. Cancele quando quiser.</p>
          </motion.div>
        </div>
      </header>

      {/* Pain Points */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Você se identifica?</h2>
            <p className="text-muted-foreground text-lg">Esses problemas são mais comuns do que você imagina</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {PAIN_POINTS.map((p, i) => (
              <motion.div key={p.title} initial="hidden" whileInView="visible"
                viewport={{ once: true, margin: '-60px' }} custom={i + 1} variants={fadeUp}
                className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
                  <p.icon className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{p.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Transition — Solution */}
      <section className="py-16 px-4 gradient-subtle">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          custom={0} variants={fadeUp} className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success text-sm font-medium mb-6">
            <CheckCircle2 className="w-4 h-4" /> A solução existe
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Um sistema pensado para a sua realidade
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            O Evolução Diária não é um sistema genérico adaptado. Foi construído do zero para profissionais que atendem em clínicas — psicólogos, fonoaudiólogos, terapeutas ocupacionais e outros. Cada funcionalidade existe porque alguém como você pediu.
          </p>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">O que você ganha</h2>
            <p className="text-muted-foreground text-lg">Ferramentas práticas que economizam horas por semana</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible"
                viewport={{ once: true, margin: '-60px' }} custom={i} variants={fadeUp}
                className="glass-card rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 shadow-glow">
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 gradient-subtle">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Quem usa, recomenda</h2>
            <p className="text-muted-foreground text-lg">Veja o que profissionais como você dizem</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} initial="hidden" whileInView="visible"
                viewport={{ once: true, margin: '-60px' }} custom={i + 1} variants={fadeUp}
                className="glass-card rounded-2xl p-6 flex flex-col">
                <Quote className="w-8 h-8 text-primary/20 mb-3" />
                <p className="text-foreground text-sm leading-relaxed flex-1 mb-4">"{t.text}"</p>
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{t.name}</p>
                  <p className="text-muted-foreground text-xs">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo / Screenshots */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Monitor className="w-4 h-4" /> Veja o sistema por dentro
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Interface limpa e intuitiva</h2>
            <p className="text-muted-foreground text-lg">Projetada para você focar no paciente, não no sistema</p>
          </motion.div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: 'Dashboard Completo', desc: 'Visão geral dos seus atendimentos, tarefas e agenda do dia em uma única tela.', img: demoDashboard },
              { title: 'Evoluções com Carimbo', desc: 'Registre sessões com texto, humor do paciente e seu carimbo profissional digital.', img: demoEvolutions },
              { title: 'Agenda Visual', desc: 'Calendário integrado com eventos, sessões e lembretes automáticos.', img: demoCalendar },
              { title: 'Relatórios com IA', desc: 'Crie relatórios clínicos com inteligência artificial, edite com editor rico e exporte em PDF.', img: demoReports },
            ].map((item, i) => (
              <motion.div key={item.title} initial="hidden" whileInView="visible"
                viewport={{ once: true, margin: '-60px' }} custom={i + 1} variants={fadeUp}
                className="glass-card rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div className="aspect-video overflow-hidden bg-muted">
                  <img src={item.img} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 gradient-subtle">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Perguntas Frequentes</h2>
            <p className="text-muted-foreground text-lg">Tire suas dúvidas antes de começar</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            custom={1} variants={fadeUp}>
            <Accordion type="single" collapsible className="space-y-3">
              {FAQ_ITEMS.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="glass-card rounded-xl border px-5">
                  <AccordionTrigger className="text-left text-foreground font-medium hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Investimento que se paga sozinho</h2>
            <p className="text-muted-foreground text-lg mb-10">
              Quanto vale o tempo que você perde toda semana com burocracia?
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Mensal', price: 'R$ 29', period: '/mês', sub: 'Menos de R$1 por dia' },
              { name: 'Bimestral', price: 'R$ 49', period: '/2 meses', popular: true, sub: 'Economia de R$ 9' },
              { name: 'Trimestral', price: 'R$ 59', period: '/3 meses', sub: 'Economia de R$ 28' },
            ].map((plan, i) => (
              <motion.div key={plan.name} initial="hidden" whileInView="visible"
                viewport={{ once: true, margin: '-60px' }} custom={i + 1} variants={fadeUp}
                className={`glass-card rounded-2xl p-6 flex flex-col ${plan.popular ? 'border-2 border-primary shadow-glow ring-1 ring-primary/20' : ''}`}>
                {plan.popular && (
                  <span className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium mb-3 self-center">
                    Mais Popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                <div className="my-4">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-xs text-primary font-medium mb-4">{plan.sub}</p>
                <ul className="text-sm text-muted-foreground space-y-2 mb-6 flex-1">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Acesso completo a tudo</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> 15 dias grátis</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> Cancele quando quiser</li>
                </ul>
                <Button variant={plan.popular ? 'default' : 'outline'}
                  className={`w-full ${plan.popular ? 'gradient-primary' : ''}`}
                  onClick={() => navigate('/auth')}>
                  Começar Teste Grátis
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 gradient-subtle">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          custom={0} variants={fadeUp} className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Seus pacientes merecem um profissional organizado.
            <br />
            <span className="text-primary">Você merece uma ferramenta que ajude nisso.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Comece agora. São 15 dias grátis, sem compromisso.
          </p>
          <Button size="lg" onClick={() => navigate('/auth')}
            className="gradient-primary gap-2 text-lg px-10 py-6 shadow-glow">
            Criar Minha Conta Grátis <ArrowRight className="w-5 h-5" />
          </Button>
        </motion.div>
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
