import { School, Brain, Ear, Activity, Salad, Puzzle, type LucideIcon } from 'lucide-react';

export type ModuleId = 'psicopedagogo' | 'psicologo' | 'fono' | 'psicomotricista' | 'nutricionista' | 'to';

export interface SpecialtyModule {
  id: ModuleId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  color: string; // tailwind text color class
  price: number; // BRL/mês
  stripePriceId?: string;
  description: string;
  status: 'available' | 'coming_soon';
  features: { title: string; items: string[] }[];
}

export const SPECIALTY_MODULES: SpecialtyModule[] = [
  {
    id: 'psicopedagogo',
    label: 'Psicopedagogia',
    shortLabel: 'Psicoped.',
    icon: School,
    color: 'text-violet-500',
    price: 39,
    stripePriceId: 'price_1TaGpSDl2hex55TCSanLMgLB',
    description: 'Avaliação e intervenção em aprendizagem',
    status: 'available',
    features: [
      {
        title: 'Avaliação & Diagnóstico',
        items: [
          'Pontuação 0–10 em 6 domínios (leitura, escrita, matemática, atenção, memória, linguagem)',
          'Gráfico radar do perfil cognitivo',
          'Registro de testes aplicados (WISC-V, Bender, Frostig, TDE)',
          'Avaliação inicial, reavaliação e alta',
        ],
      },
      {
        title: 'Plano de Desenvolvimento Individual',
        items: [
          'PDI com metas por área e prazo',
          'Checklist de objetivos atingidos',
          'Vínculo com avaliação base',
        ],
      },
      {
        title: 'Sessões & Relatórios',
        items: [
          'Registro de sessão com desempenho, humor e tarefas para casa',
          'Relatórios para escola, família, encaminhamento e alta',
          'Geração por IA com revisão',
        ],
      },
    ],
  },
  {
    id: 'psicologo',
    label: 'Psicologia',
    shortLabel: 'Psico.',
    icon: Brain,
    color: 'text-indigo-500',
    price: 39,
    description: 'Saúde mental, avaliação e psicoterapia',
    status: 'coming_soon',
    features: [
      { title: 'Avaliação Psicológica', items: ['Escalas padronizadas (CBCL, SDQ, SNAP-IV)', 'Genograma familiar', 'Hipótese diagnóstica CID-11 / DSM-5'] },
      { title: 'Prontuário & Sessões', items: ['Evolução por sessão', 'Templates de abordagem (TCC, ABA)', 'Registro de humor e comportamento'] },
      { title: 'Laudos & Ética', items: ['Modelo de Laudo Psicológico (CFP)', 'TCLE', 'Orientações com IA'] },
    ],
  },
  {
    id: 'fono',
    label: 'Fonoaudiologia',
    shortLabel: 'Fono.',
    icon: Ear,
    color: 'text-orange-500',
    price: 39,
    description: 'Linguagem, fala, voz e deglutição',
    status: 'coming_soon',
    features: [
      { title: 'Triagem & Avaliação', items: ['ABFW (vocabulário, fluência, pragmática)', 'Linguagem receptiva e expressiva', 'Motricidade orofacial', 'Voz (GRBAS, VHI)'] },
      { title: 'Plano Terapêutico', items: ['Objetivos por eixo (fala, linguagem, voz)', 'Banco de exercícios', 'Tarefas para casa'] },
      { title: 'Laudos & Comunicação', items: ['Modelo de laudo fonoaudiológico', 'Relatórios para escola e médico', 'Orientações com IA'] },
    ],
  },
  {
    id: 'psicomotricista',
    label: 'Psicomotricidade',
    shortLabel: 'Psicom.',
    icon: Activity,
    color: 'text-amber-600',
    price: 39,
    description: 'Desenvolvimento motor e corporal',
    status: 'coming_soon',
    features: [
      { title: 'Avaliação Psicomotora', items: ['Bateria Psicomotora (BPM – Fonseca)', 'Esquema corporal, lateralidade, equilíbrio', 'Coordenação motora grossa e fina'] },
      { title: 'Plano de Intervenção', items: ['Objetivos motores por faixa etária', 'Sessões com circuitos e jogos', 'Progresso por habilidade'] },
      { title: 'Relatórios', items: ['Gráfico radar de perfil', 'Relatório para escola e neuropediatra', 'Alerta de atraso motor'] },
    ],
  },
  {
    id: 'nutricionista',
    label: 'Nutrição',
    shortLabel: 'Nutri.',
    icon: Salad,
    color: 'text-green-600',
    price: 39,
    description: 'Avaliação nutricional e planos alimentares',
    status: 'coming_soon',
    features: [
      { title: 'Avaliação Nutricional', items: ['Antropometria (peso, altura, IMC)', 'Anamnese alimentar', 'Recordatório 24h', 'Curvas de crescimento'] },
      { title: 'Planejamento Alimentar', items: ['Cálculo de necessidades energéticas (DRI)', 'Plano personalizado', 'Lista de substituições'] },
      { title: 'Monitoramento', items: ['Gráfico de evolução de peso', 'Aceitação alimentar', 'Relatório para médico'] },
    ],
  },
  {
    id: 'to',
    label: 'Terapia Ocupacional',
    shortLabel: 'T.O.',
    icon: Puzzle,
    color: 'text-pink-500',
    price: 39,
    description: 'Funcionalidade, AVD e integração sensorial',
    status: 'coming_soon',
    features: [
      { title: 'Avaliação Funcional', items: ['COPM (Medida Canadense)', 'Perfil Sensorial de Dunn', 'WeeFIM / PEDI', 'Integração Sensorial (SI)'] },
      { title: 'Plano Terapêutico', items: ['Objetivos centrados no cliente', 'AVD adaptadas', 'Tecnologia assistiva'] },
      { title: 'Ambiente & Família', items: ['Checklist de adaptação escolar', 'Relatório para escola inclusiva', 'Orientações para cuidadores'] },
    ],
  },
];

export function getModule(id: ModuleId): SpecialtyModule | undefined {
  return SPECIALTY_MODULES.find((m) => m.id === id);
}