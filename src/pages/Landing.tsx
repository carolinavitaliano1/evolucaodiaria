import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, type Variants } from 'framer-motion';
import {
  BookOpen, Users, Calendar, FileText, BarChart3, Shield, Sparkles,
  ArrowRight, CheckCircle2, Clock, Brain, AlertTriangle, Heart, Star, Quote,
  Wand2, Zap, FileCheck, ClipboardList, TrendingUp,
  Lock, RefreshCw, MessageCircle, UserPlus, Bell, Megaphone,
  GraduationCap, ListChecks, Activity, Receipt, X, Check,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
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

const CORE_FEATURES = [
  { icon: Users, title: 'Gestão de Pacientes', desc: 'Cadastro completo com diagnóstico, frequência, humor, responsáveis e histórico de sessões.' },
  { icon: FileText, title: 'Evoluções com Carimbo', desc: 'Registre cada sessão com texto, humor, anexos, modelos estruturados e seu carimbo profissional.' },
  { icon: Calendar, title: 'Agenda Integrada', desc: 'Sessões, tarefas, eventos e bloqueios em uma agenda visual com sincronização Google Calendar.' },
  { icon: BarChart3, title: 'Financeiro Automático', desc: 'Controle por sessão, pacote ou fixo mensal. Recibos, comprovantes e extratos em PDF.' },
  { icon: MessageCircle, title: 'WhatsApp Integrado', desc: 'Modelos de mensagem, envio rápido, lembretes e cobranças com variáveis personalizadas.' },
  { icon: Shield, title: 'Segurança LGPD', desc: 'Criptografia ponta a ponta, dados na nuvem e conformidade com a LGPD.' },
  { icon: GraduationCap, title: 'Grupos Terapêuticos', desc: 'Gerencie grupos com sessões, evoluções, financeiro e participantes em um único lugar.' },
  { icon: ListChecks, title: 'Lista de Espera & Matrículas', desc: 'Links públicos para inscrição em lista de espera e matrículas com revisão automática.' },
  { icon: Bell, title: 'Alertas Inteligentes', desc: 'Pendências de evolução, pagamentos vencidos, aniversários e revisões — tudo no dashboard.' },
];

const PRO_FEATURES = [
  {
    icon: Wand2,
    title: 'Doc IA — Documentos Inteligentes',
    desc: 'Gere relatórios, declarações e atestados clínicos com IA a partir do histórico do paciente. Editor rico, salve versões e exporte em PDF/Word com carimbo.',
    highlight: 'De horas para minutos',
  },
  {
    icon: Sparkles,
    title: 'Melhorar Evolução com IA',
    desc: 'Escreva suas notas e a IA refina o vocabulário técnico mantendo o sentido clínico. Funciona em texto livre e em modelos estruturados.',
    highlight: 'Economize 15 min por sessão',
  },
  {
    icon: Heart,
    title: 'Feedbacks IA para Responsáveis',
    desc: 'Crie feedbacks individuais ou em lote com IA, anexe fotos e envie diretamente para o Portal do Paciente.',
    highlight: 'Família engajada',
  },
  {
    icon: TrendingUp,
    title: 'Relatórios IA',
    desc: 'Relatórios completos com modo guiado ou comando livre, totalmente editáveis e exportáveis em PDF profissional.',
    highlight: 'Documentação impecável',
  },
  {
    icon: UserPlus,
    title: 'Portal do Paciente',
    desc: 'Convites por e-mail, fichas digitais, mensagens, atividades, mural, contratos digitais e financeiro — tudo acessível ao paciente/responsável.',
    highlight: 'Engajamento total',
  },
];

const PORTAL_BENEFITS = [
  { icon: FileText, title: 'Fichas Digitais', desc: 'Anamnese e questionários personalizados respondidos pelo paciente.' },
  { icon: MessageCircle, title: 'Mensagens Diretas', desc: 'Comunicação segura entre terapeuta e responsável, com lembretes de sessões.' },
  { icon: Activity, title: 'Atividades & Planos de Ação', desc: 'Envie tarefas terapêuticas e acompanhe o cumprimento.' },
  { icon: Megaphone, title: 'Mural & Avisos', desc: 'Comunicados e avisos importantes centralizados no portal.' },
  { icon: Receipt, title: 'Financeiro Transparente', desc: 'Comprovantes, vencimentos e pacotes acessíveis ao responsável financeiro.' },
  { icon: Sparkles, title: 'Feedbacks Curados', desc: 'Apenas feedbacks aprovados pelo terapeuta chegam ao paciente.' },
];

const AUTOMATION_BENEFITS = [
  { icon: FileCheck, stat: '70%', label: 'menos tempo escrevendo evoluções', desc: 'Modelos + IA eliminam retrabalho' },
  { icon: TrendingUp, stat: '100%', label: 'controle financeiro automático', desc: 'Presenças, faltas e valores calculados' },
  { icon: RefreshCw, stat: '0', label: 'planilhas para gerenciar', desc: 'Tudo centralizado e seguro na nuvem' },
  { icon: Lock, stat: '24/7', label: 'acesso seguro de qualquer lugar', desc: 'Celular, tablet ou computador' },
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
    text: 'O Portal do Paciente mudou minha relação com as famílias. Eles acompanham tudo, mandam fotos e respondem fichas online. Conexão total.',
    rating: 5,
  },
  {
    name: 'Dra. Fernanda Lima',
    role: 'Fisioterapeuta — Recife, PE',
    text: 'Os modelos de evolução com IA mudaram minha rotina. Preencho os campos, a IA refina o texto e em 30 segundos a evolução está pronta e profissional.',
    rating: 5,
  },
];

const FAQ_ITEMS = [
  { q: 'O teste grátis é realmente sem compromisso?', a: 'Sim! Você tem 30 dias para testar todas as funcionalidades, sem precisar cadastrar cartão de crédito. Se não gostar, é só não assinar — o acesso é interrompido automaticamente.' },
  { q: 'Qual a diferença entre o plano Básico e o Pro?', a: 'O Básico (R$ 29,90/mês) inclui pacientes, agenda, evoluções, financeiro, WhatsApp e anexos. O Pro (R$ 59,90/mês) acrescenta toda a Inteligência Artificial (Doc IA, Melhorar Evolução, Feedbacks IA, Relatórios IA) e o Portal do Paciente.' },
  { q: 'Meus dados ficam seguros?', a: 'Totalmente. Utilizamos criptografia, servidores seguros na nuvem e seguimos a LGPD. Apenas você (e sua equipe, se autorizada) tem acesso aos dados dos pacientes.' },
  { q: 'Posso usar em mais de uma clínica?', a: 'Sim! Você pode cadastrar quantas clínicas, consultórios ou contratantes quiser e gerenciar pacientes, agenda e financeiro de cada um separadamente.' },
  { q: 'Funciona no celular?', a: 'Sim. O sistema é totalmente responsivo e funciona perfeitamente no navegador do seu celular ou tablet, sem precisar instalar nada.' },
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim, sem multas ou burocracia. Basta cancelar na área de assinatura e você mantém acesso até o fim do período pago.' },
  { q: 'Quais profissionais podem usar?', a: 'Psicólogos, fonoaudiólogos, terapeutas ocupacionais, fisioterapeutas, psicopedagogos, psicomotricistas, musicoterapeutas e qualquer profissional de saúde que atenda em clínicas.' },
  { q: 'Como funciona o Portal do Paciente?', a: 'Disponível no plano Pro: você convida o paciente ou responsável por e-mail, e ele acessa fichas, mensagens, atividades, mural, contratos e financeiro de forma segura e personalizada.' },
];

const PLAN_COMPARISON: { label: string; basic: boolean; pro: boolean }[] = [
  { label: 'Clínicas, pacientes e agenda ilimitados', basic: true, pro: true },
  { label: 'Evoluções, modelos e carimbo', basic: true, pro: true },
  { label: 'Controle financeiro completo', basic: true, pro: true },
  { label: 'WhatsApp, anexos e notas', basic: true, pro: true },
  { label: 'Grupos terapêuticos', basic: true, pro: true },
  { label: 'Lista de espera e matrículas', basic: true, pro: true },
  { label: 'Doc IA — documentos com IA', basic: false, pro: true },
  { label: 'Melhorar Evolução com IA', basic: false, pro: true },
  { label: 'Feedbacks IA para responsáveis', basic: false, pro: true },
  { label: 'Relatórios IA', basic: false, pro: true },
  { label: 'Portal do Paciente', basic: false, pro: true },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg gradient-primary shadow-glow">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">Evolução Diária</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>Entrar</Button>
            <Button size="sm" onClick={() => navigate('/auth')} className="gradient-primary gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
              <span className="hidden sm:inline">Testar 30 Dias Grátis</span>
              <span className="sm:hidden">Testar Grátis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-subtle opacity-60" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
          <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20">
              <Heart className="w-4 h-4" /> Feito por quem entende sua rotina clínica
            </span>
          </motion.div>

          <motion.h1 initial="hidden" animate="visible" custom={1} variants={fadeUp}
            className="text-3xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Você escolheu cuidar de pessoas.
            <br />
            <span className="text-primary">A burocracia fica com a gente.</span>
          </motion.h1>

          <motion.p initial="hidden" animate="visible" custom={2} variants={fadeUp}
            className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Evoluções com IA em 30 segundos, agenda integrada, financeiro automático e Portal do Paciente — tudo pensado para o profissional de saúde que atende em clínicas.
          </motion.p>

          <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}
            className="flex flex-col items-center gap-3 mb-10">
            <Button size="lg" onClick={() => navigate('/auth')}
              className="gradient-primary gap-2 text-base px-6 py-5 shadow-glow w-full max-w-sm sm:max-w-none sm:w-auto sm:text-lg sm:px-8 sm:py-6">
              <span className="sm:hidden">Criar Conta Grátis — 30 dias</span>
              <span className="hidden sm:inline">Criar Conta Grátis — 30 dias sem cobrar</span>
              <ArrowRight className="w-5 h-5 shrink-0" />
            </Button>
            <p className="text-sm text-muted-foreground">Sem cartão. Cancele quando quiser.</p>
          </motion.div>

          <motion.div initial="hidden" animate="visible" custom={4} variants={fadeUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="flex -space-x-1">
                {['🧑‍⚕️','👩‍⚕️','🧑‍⚕️'].map((e,i) => <span key={i} className="text-base">{e}</span>)}
              </div>
              +500 profissionais ativos
            </span>
            <span className="flex items-center gap-1.5">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-warning text-warning" />)}
              4,9 de satisfação
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> Dados 100% seguros na nuvem
            </span>
          </motion.div>
        </div>
      </header>

      {/* Pain Points */}
      <section className="py-20 px-4 mt-12">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Você se identifica?</h2>
            <p className="text-muted-foreground text-lg">Esses problemas afetam mais de 80% dos profissionais de saúde</p>
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

      {/* Core Features */}
      <section className="py-20 px-4 gradient-subtle">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-14">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Disponível em todos os planos</Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Tudo que você precisa, integrado</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Da gestão básica do consultório a recursos avançados — uma plataforma completa para sua rotina clínica.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CORE_FEATURES.map((f, i) => (
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

      {/* Pro Features (IA + Portal) */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-12">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
              <Sparkles className="w-4 h-4" /> Exclusivo do plano Pro
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-3">
              IA e <span className="text-primary">Portal do Paciente</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Recursos avançados para quem quer escalar o consultório e engajar famílias com tecnologia de ponta.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRO_FEATURES.map((f, i) => (
              <motion.div key={f.title} initial="hidden" whileInView="visible"
                viewport={{ once: true, margin: '-60px' }} custom={i + 1} variants={fadeUp}
                className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="absolute top-4 right-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide max-w-[110px] text-center leading-tight">
                    {f.highlight}
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 shadow-glow shrink-0">
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2 pr-28">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal Spotlight */}
      <section className="py-20 px-4 gradient-subtle">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-12">
            <Badge className="mb-4 bg-primary text-primary-foreground">Portal do Paciente</Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Famílias engajadas, comunicação centralizada
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Um espaço dedicado para o paciente e responsáveis acompanharem tudo — com sigilo entre múltiplos responsáveis (pai, mãe, escola).
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {PORTAL_BENEFITS.map((b, i) => (
              <motion.div key={b.title} initial="hidden" whileInView="visible"
                viewport={{ once: true, margin: '-60px' }} custom={i + 1} variants={fadeUp}
                className="glass-card rounded-2xl p-5 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <b.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Automation Stats */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Automação que transforma sua rotina
            </h2>
            <p className="text-muted-foreground text-lg">Números que fazem diferença no seu dia a dia</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {AUTOMATION_BENEFITS.map((b, i) => (
              <motion.div key={b.label} initial="hidden" whileInView="visible"
                viewport={{ once: true, margin: '-60px' }} custom={i + 1} variants={fadeUp}
                className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <b.icon className="w-7 h-7 text-primary" />
                </div>
                <p className="text-3xl md:text-4xl font-bold text-primary mb-1">{b.stat}</p>
                <p className="text-sm font-semibold text-foreground mb-1">{b.label}</p>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 gradient-subtle">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Como funciona na prática?</h2>
            <p className="text-muted-foreground text-lg">Em 3 passos simples você transforma sua rotina</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Cadastre suas clínicas e pacientes', desc: 'Adicione suas informações uma vez. O sistema organiza tudo automaticamente por clínica, paciente e período.' },
              { step: '2', title: 'Registre evoluções e gerencie a rotina', desc: 'Use modelos estruturados, agenda integrada, WhatsApp e financeiro automático. No Pro, ainda conta com IA e Portal.' },
              { step: '3', title: 'Gere relatórios e engaje as famílias', desc: 'Exporte PDFs profissionais e — no Pro — envie evoluções, feedbacks e atividades pelo Portal do Paciente.' },
            ].map((s, i) => (
              <motion.div key={s.step} initial="hidden" whileInView="visible"
                viewport={{ once: true, margin: '-60px' }} custom={i + 1} variants={fadeUp}
                className="text-center">
                <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <span className="text-2xl font-bold text-primary-foreground">{s.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Quem usa, recomenda</h2>
            <p className="text-muted-foreground text-lg">Profissionais reais contando sobre o impacto no dia a dia</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Pricing — Basic vs Pro */}
      <section className="py-20 px-4 gradient-subtle">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
            custom={0} variants={fadeUp} className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Planos simples e diretos</h2>
            <p className="text-muted-foreground text-lg mb-3">
              Escolha o plano ideal e comece com 30 dias grátis — sem cartão de crédito.
            </p>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="w-4 h-4" />
              30 dias grátis em todos os planos
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Básico */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
              custom={1} variants={fadeUp}
              className="glass-card rounded-2xl p-8 flex flex-col border border-border">
              <h3 className="text-xl font-bold text-foreground">Básico</h3>
              <p className="text-sm text-muted-foreground mt-1">O essencial para sua prática clínica</p>
              <div className="my-5">
                <span className="text-4xl font-bold text-foreground">R$ 29,90</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2.5 mb-6 flex-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Clínicas, pacientes e agenda ilimitados</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Evoluções com texto livre e modelos</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Controle financeiro completo</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> WhatsApp, anexos e notas</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Grupos terapêuticos, lista de espera</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> 30 dias grátis</li>
              </ul>
              <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
                Começar Grátis
              </Button>
            </motion.div>

            {/* Pro */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
              custom={2} variants={fadeUp}
              className="relative glass-card rounded-2xl p-8 flex flex-col border-2 border-primary shadow-glow ring-1 ring-primary/20">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                Recomendado
              </Badge>
              <h3 className="text-xl font-bold text-foreground">Pro</h3>
              <p className="text-sm text-muted-foreground mt-1">Tudo que você precisa para escalar</p>
              <div className="my-5">
                <span className="text-4xl font-bold text-foreground">R$ 59,90</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2.5 mb-6 flex-1">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> <span>Tudo do Básico</span></li>
                <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" /> <span>IA completa: Doc IA, Melhorar Evolução, Feedbacks IA, Relatórios IA</span></li>
                <li className="flex items-start gap-2"><UserPlus className="w-4 h-4 text-primary mt-0.5 shrink-0" /> <span>Portal do Paciente (convites, fichas, mensagens)</span></li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> 30 dias grátis</li>
              </ul>
              <Button className="w-full gradient-primary" onClick={() => navigate('/auth')}>
                Começar Grátis
              </Button>
            </motion.div>
          </div>

          {/* Comparison table */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            custom={3} variants={fadeUp}>
            <h3 className="text-lg font-semibold text-foreground text-center mb-4">Comparativo de recursos</h3>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 font-semibold text-foreground">Recurso</th>
                      <th className="text-center px-4 py-3 font-semibold text-foreground w-32">Básico</th>
                      <th className="text-center px-4 py-3 font-semibold text-primary w-32">Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLAN_COMPARISON.map((row, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2.5 text-foreground">{row.label}</td>
                        <td className="px-4 py-2.5 text-center">
                          {row.basic ? (
                            <Check className="w-4 h-4 text-primary mx-auto" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Check className="w-4 h-4 text-primary mx-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Emotional CTA */}
      <section className="py-20 px-4">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          custom={0} variants={fadeUp} className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 p-8 md:p-12 text-center">
            <div className="text-5xl mb-6">💭</div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 leading-relaxed">
              "Eu não estudei anos para ficar preenchendo planilha."
            </h2>
            <p className="text-muted-foreground text-lg mb-2 max-w-2xl mx-auto leading-relaxed">
              Se você já pensou isso, saiba que não está sozinho. Profissionais de saúde gastam <span className="text-foreground font-semibold">até 10 horas por semana</span> com burocracia que poderia ser automatizada.
            </p>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
              Com o Evolução Diária, você recupera esse tempo — e ainda entrega documentação <span className="text-foreground font-semibold">mais profissional</span> do que antes.
            </p>
            <Button size="lg" onClick={() => navigate('/auth')}
              className="gradient-primary gap-2 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 shadow-glow w-full sm:w-auto max-w-sm">
              Quero Recuperar Meu Tempo <ArrowRight className="w-5 h-5 shrink-0" />
            </Button>
          </div>
        </motion.div>
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

      {/* Final CTA */}
      <section className="py-20 px-4">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}
          custom={0} variants={fadeUp} className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Seus pacientes merecem um profissional organizado.
            <br />
            <span className="text-primary">Você merece uma ferramenta que ajude nisso.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Comece agora. São 30 dias completamente grátis, sem compromisso, sem cartão.
          </p>
          <Button size="lg" onClick={() => navigate('/auth')}
            className="gradient-primary gap-2 text-base sm:text-lg px-8 sm:px-10 py-5 sm:py-6 shadow-glow w-full sm:w-auto max-w-sm">
            Criar Minha Conta Grátis <ArrowRight className="w-5 h-5 shrink-0" />
          </Button>
          <p className="text-xs text-muted-foreground mt-4">✓ Sem cartão &nbsp;·&nbsp; ✓ 30 dias grátis &nbsp;·&nbsp; ✓ Cancele quando quiser</p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Evolução Diária</span>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <a href="/privacidade" className="hover:text-foreground transition-colors underline underline-offset-2">Política de Privacidade</a>
            <a href="/termos" className="hover:text-foreground transition-colors underline underline-offset-2">Termos de Uso</a>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Evolução Diária. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
