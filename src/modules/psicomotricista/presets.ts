// Presets clínicos do módulo Psicomotricista
// - BPM (Fonseca): 7 fatores psicomotores, escala 1 a 4
// - PDI: templates de objetivos por faixa etária
// - Milestones motores


export const BPM_FONSECA_FATORES = [
  'Tonicidade',
  'Equilibração',
  'Lateralização',
  'Noção do Corpo',
  'Estruturação Espaço-Temporal',
  'Praxia Global',
  'Praxia Fina',
] as const;

export const BPM_ESCALA: { valor: number; label: string; desc: string }[] = [
  { valor: 1, label: 'Apráxico', desc: 'Realização imperfeita, incompleta e descoordenada (perfil deficitário)' },
  { valor: 2, label: 'Dispráxico', desc: 'Realização com dificuldades de controle (perfil dispráxico)' },
  { valor: 3, label: 'Eupráxico', desc: 'Realização completa, adequada e controlada (perfil normal)' },
  { valor: 4, label: 'Hiperpráxico', desc: 'Realização perfeita, precisa, harmoniosa (perfil superior)' },
];

export interface PdiTemplate {
  faixa: string;
  idade_min: number;
  idade_max: number;
  objetivos: { area: string; meta: string; video_url?: string }[];
}

export const PDI_TEMPLATES_FAIXA_ETARIA: PdiTemplate[] = [
  {
    faixa: '3 a 5 anos — Pré-escolar',
    idade_min: 3,
    idade_max: 5,
    objetivos: [
      { area: 'equilibrio', meta: 'Manter equilíbrio estático em um pé por 5 segundos' },
      { area: 'coord_global', meta: 'Saltar com os dois pés juntos sobre obstáculo de 10 cm' },
      { area: 'coord_fina', meta: 'Realizar pinça digital para encaixar peças pequenas' },
      { area: 'esquema_corporal', meta: 'Identificar e nomear partes principais do corpo' },
      { area: 'lateralidade', meta: 'Estimular dominância manual em atividades dirigidas' },
    ],
  },
  {
    faixa: '6 a 8 anos — Escolar inicial',
    idade_min: 6,
    idade_max: 8,
    objetivos: [
      { area: 'equilibrio', meta: 'Caminhar sobre linha reta com objeto na cabeça por 3 metros' },
      { area: 'coord_global', meta: 'Pular corda 5 vezes consecutivas sem erro' },
      { area: 'coord_fina', meta: 'Recortar figuras com tesoura respeitando o contorno' },
      { area: 'org_espacial', meta: 'Reproduzir sequências espaciais em malha quadriculada' },
      { area: 'esquema_corporal', meta: 'Reconhecer direita e esquerda no próprio corpo' },
    ],
  },
  {
    faixa: '9 a 12 anos — Escolar avançado',
    idade_min: 9,
    idade_max: 12,
    objetivos: [
      { area: 'coord_global', meta: 'Executar circuito motor com 4 estações em até 60 segundos' },
      { area: 'coord_fina', meta: 'Reproduzir grafismos complexos com precisão e ritmo' },
      { area: 'org_espacial', meta: 'Discriminar e reproduzir estruturas rítmicas auditivas' },
      { area: 'lateralidade', meta: 'Consolidar dominância cruzada em atividades bimanuais' },
      { area: 'esquema_corporal', meta: 'Realizar imitação de gestos com olhos fechados' },
    ],
  },
  {
    faixa: 'Adolescentes e adultos',
    idade_min: 13,
    idade_max: 99,
    objetivos: [
      { area: 'equilibrio', meta: 'Treino proprioceptivo unipodal com superfícies instáveis' },
      { area: 'coord_global', meta: 'Sequências motoras com alternância de ritmos e direções' },
      { area: 'coord_fina', meta: 'Aperfeiçoamento de praxia fina em tarefas instrumentais' },
      { area: 'org_espacial', meta: 'Planejamento motor em tarefas de orientação espacial' },
    ],
  },
];

export interface MotorMilestone {
  key: string;
  idade: number; // idade-marco em meses (até 36) ou anos*12 acima de 3
  unidade: 'meses' | 'anos';
  habilidade: string;
  area: string;
}

export const MILESTONES_MOTORES: MotorMilestone[] = [
  { key: 'm6_sustento',   idade: 6,  unidade: 'meses', habilidade: 'Sustento cervical e rolar', area: 'coord_global' },
  { key: 'm9_sentar',     idade: 9,  unidade: 'meses', habilidade: 'Sentar sem apoio', area: 'equilibrio' },
  { key: 'm12_andar',     idade: 12, unidade: 'meses', habilidade: 'Engatinhar e primeiros passos', area: 'coord_global' },
  { key: 'm18_degraus',   idade: 18, unidade: 'meses', habilidade: 'Andar com firmeza, subir degraus com apoio', area: 'equilibrio' },
  { key: 'm24_correr',    idade: 24, unidade: 'meses', habilidade: 'Correr, chutar bola, empilhar 4 cubos', area: 'coord_global' },
  { key: 'a3_triciclo',   idade: 3,  unidade: 'anos',  habilidade: 'Pedalar triciclo, copiar círculo, vestir-se com ajuda', area: 'coord_fina' },
  { key: 'a4_unipodal',   idade: 4,  unidade: 'anos',  habilidade: 'Equilíbrio unipodal 3s, recortar com tesoura', area: 'equilibrio' },
  { key: 'a5_cadarco',    idade: 5,  unidade: 'anos',  habilidade: 'Pular corda, copiar quadrado, amarrar cadarço', area: 'coord_fina' },
  { key: 'a6_lateral',    idade: 6,  unidade: 'anos',  habilidade: 'Saltar em um pé, reconhecer direita/esquerda', area: 'lateralidade' },
  { key: 'a7_ritmo',      idade: 7,  unidade: 'anos',  habilidade: 'Reproduzir ritmos, escrita cursiva inicial', area: 'org_espacial' },
];
