// Presets clínicos do módulo Psicopedagogia
// - Protocolo de rastreio de dificuldades de aprendizagem
// - Testes padronizados (WISC, Bender, Frostig) com métricas estruturadas
// - Templates de PDI por série escolar / faixa etária
// - Tópicos de anamnese escolar e familiar
// - Modelo de carta de encaminhamento

// ============================================================
// 1. Protocolo de rastreio
// ============================================================
export interface RastreioItem {
  area: 'leitura' | 'escrita' | 'matematica' | 'atencao' | 'memoria' | 'linguagem' | 'comportamento';
  pergunta: string;
}

export const PROTOCOLO_RASTREIO: RastreioItem[] = [
  { area: 'leitura', pergunta: 'Apresenta troca, omissão ou inversão de letras ao ler?' },
  { area: 'leitura', pergunta: 'Lê de forma silabada, lenta ou sem fluência esperada para a série?' },
  { area: 'leitura', pergunta: 'Apresenta dificuldade de compreensão do que lê?' },
  { area: 'escrita', pergunta: 'Comete erros ortográficos persistentes (troca surda/sonora, omissão de sílabas)?' },
  { area: 'escrita', pergunta: 'Apresenta letra ilegível, pressão excessiva ou cansaço ao escrever?' },
  { area: 'escrita', pergunta: 'Tem dificuldade em organizar ideias ao produzir texto?' },
  { area: 'matematica', pergunta: 'Apresenta dificuldades em compreender quantidade e seriação numérica?' },
  { area: 'matematica', pergunta: 'Tem dificuldade em armar e resolver operações básicas?' },
  { area: 'matematica', pergunta: 'Apresenta dificuldade na resolução de problemas matemáticos?' },
  { area: 'atencao', pergunta: 'Distrai-se facilmente, perde objetos ou esquece tarefas?' },
  { area: 'atencao', pergunta: 'Apresenta inquietude motora ou impulsividade em sala de aula?' },
  { area: 'memoria', pergunta: 'Esquece com facilidade conteúdos recém-aprendidos?' },
  { area: 'memoria', pergunta: 'Tem dificuldade de evocar palavras conhecidas (busca lexical)?' },
  { area: 'linguagem', pergunta: 'Apresenta vocabulário restrito ou trocas fonéticas?' },
  { area: 'linguagem', pergunta: 'Tem dificuldade em narrar fatos com sequência lógica?' },
  { area: 'comportamento', pergunta: 'Demonstra resistência, ansiedade ou recusa frente a tarefas escolares?' },
  { area: 'comportamento', pergunta: 'Apresenta queixas somáticas (dor de cabeça, barriga) em dias de escola?' },
];

// ============================================================
// 2. Testes padronizados — métricas estruturadas
// ============================================================
export interface TestProfile {
  instrumento: string;
  descricao: string;
  metricas: string[];
}

export const TEST_PROFILES: Record<string, TestProfile> = {
  'WISC-V': {
    instrumento: 'WISC-V',
    descricao: 'Escala Wechsler de Inteligência para Crianças — 5 índices primários',
    metricas: [
      'Compreensão Verbal (ICV)',
      'Visuoespacial (IVE)',
      'Raciocínio Fluido (IRF)',
      'Memória de Trabalho (IMT)',
      'Velocidade de Processamento (IVP)',
      'QI Total',
    ],
  },
  'WISC-IV': {
    instrumento: 'WISC-IV',
    descricao: 'Escala Wechsler de Inteligência para Crianças — 4 índices',
    metricas: [
      'Compreensão Verbal (ICV)',
      'Organização Perceptual (IOP)',
      'Memória Operacional (IMO)',
      'Velocidade de Processamento (IVP)',
      'QI Total',
    ],
  },
  'Bender': {
    instrumento: 'Bender',
    descricao: 'Teste Gestáltico Visomotor — avaliação perceptual e maturidade visomotora',
    metricas: [
      'Distorção da Forma',
      'Rotação',
      'Integração',
      'Perseveração',
      'Maturidade Visomotora (idade equivalente)',
    ],
  },
  'Frostig': {
    instrumento: 'Frostig (DTVP)',
    descricao: 'Teste de Desenvolvimento da Percepção Visual',
    metricas: [
      'Coordenação Olho-Mão',
      'Posição no Espaço',
      'Cópia',
      'Figura-Fundo',
      'Relações Espaciais',
      'Quociente Perceptivo Geral',
    ],
  },
  'TDE-II': {
    instrumento: 'TDE-II',
    descricao: 'Teste de Desempenho Escolar — 2ª edição',
    metricas: ['Leitura', 'Escrita', 'Aritmética', 'Pontuação Total'],
  },
};

// ============================================================
// 3. Templates de PDI por série / faixa
// ============================================================
export interface PdiTemplate {
  faixa: string;
  objetivos: { area: string; meta: string; material_adaptado?: string }[];
}

export const PDI_TEMPLATES_SERIE: PdiTemplate[] = [
  {
    faixa: 'Educação Infantil (4-5 anos)',
    objetivos: [
      { area: 'linguagem', meta: 'Ampliar vocabulário com narrativas e jogos verbais', material_adaptado: 'Livros ilustrados, fantoches, jogos de associação' },
      { area: 'memoria', meta: 'Reproduzir sequências curtas de 3-4 elementos', material_adaptado: 'Memória dos animais, jogos de pareamento' },
      { area: 'atencao', meta: 'Manter foco em atividade dirigida por 10 minutos', material_adaptado: 'Quebra-cabeças, atividades sensoriais' },
    ],
  },
  {
    faixa: 'Fundamental I — 1º e 2º ano',
    objetivos: [
      { area: 'leitura', meta: 'Consolidar consciência fonológica e decodificação', material_adaptado: 'Cartelas silábicas, alfabeto móvel, leitura compartilhada' },
      { area: 'escrita', meta: 'Escrever palavras com consciência ortográfica de sílabas simples', material_adaptado: 'Lousa pautada ampliada, ditado com apoio visual' },
      { area: 'matematica', meta: 'Construir noção de quantidade e operações até 20', material_adaptado: 'Material dourado, jogos de tabuleiro, ábaco' },
    ],
  },
  {
    faixa: 'Fundamental I — 3º ao 5º ano',
    objetivos: [
      { area: 'leitura', meta: 'Desenvolver fluência leitora e compreensão de textos curtos', material_adaptado: 'Textos com letras ampliadas, leitura em duplas' },
      { area: 'escrita', meta: 'Produzir textos com estrutura narrativa básica', material_adaptado: 'Roteiros gráficos, banco de palavras temático' },
      { area: 'matematica', meta: 'Dominar fato fundamentais e resolver problemas de uma operação', material_adaptado: 'Calculadora pedagógica, tabuada de Pitágoras' },
    ],
  },
  {
    faixa: 'Fundamental II (6º ao 9º ano)',
    objetivos: [
      { area: 'leitura', meta: 'Compreender textos expositivos e argumentativos', material_adaptado: 'Mapas mentais, marcação por cores, resumos guiados' },
      { area: 'escrita', meta: 'Estruturar parágrafos com coesão e coerência', material_adaptado: 'Modelos prontos, conectivos visuais, rubrica de avaliação' },
      { area: 'atencao', meta: 'Aplicar estratégias de autorregulação em estudo', material_adaptado: 'Técnica Pomodoro, agenda visual, checklists' },
    ],
  },
  {
    faixa: 'Ensino Médio / Adulto',
    objetivos: [
      { area: 'leitura', meta: 'Aprimorar leitura crítica e identificação de teses', material_adaptado: 'Fichamentos guiados, esquemas argumentativos' },
      { area: 'memoria', meta: 'Aplicar técnicas de estudo (mnemônicos, recuperação ativa)', material_adaptado: 'Flashcards, revisão espaçada' },
      { area: 'matematica', meta: 'Dominar resolução de problemas multi-etapa', material_adaptado: 'Tutoria de pares, software gráfico' },
    ],
  },
];

// ============================================================
// 4. Anamnese estruturada
// ============================================================
export const ANAMNESE_ESCOLAR: { titulo: string; itens: string[] }[] = [
  {
    titulo: 'Histórico escolar',
    itens: [
      'Idade de ingresso na escola e instituições frequentadas.',
      'Adaptação inicial e relações com pares e professores.',
      'Repetências, transferências ou interrupções.',
    ],
  },
  {
    titulo: 'Desempenho atual',
    itens: [
      'Disciplinas com maior e menor desempenho.',
      'Tipo de queixa relatada pela escola (leitura, escrita, atenção, etc.).',
      'Resultado em avaliações internas e externas.',
    ],
  },
  {
    titulo: 'Apoios recebidos',
    itens: [
      'Recebe reforço escolar, AEE ou tutoria? Frequência.',
      'Já realizou avaliações ou tratamentos anteriores?',
      'Recursos pedagógicos adaptados em uso.',
    ],
  },
];

export const ANAMNESE_FAMILIAR: { titulo: string; itens: string[] }[] = [
  {
    titulo: 'Composição familiar',
    itens: [
      'Configuração da família e responsáveis principais.',
      'Relação entre os membros e clima familiar.',
      'Eventos significativos recentes (mudanças, perdas, separações).',
    ],
  },
  {
    titulo: 'Desenvolvimento',
    itens: [
      'Marcos motores e de linguagem na primeira infância.',
      'Histórico de gravidez, parto e primeiros anos.',
      'Condições de saúde, uso de medicação e diagnósticos prévios.',
    ],
  },
  {
    titulo: 'Rotina e estudos em casa',
    itens: [
      'Local, horário e supervisão dos estudos.',
      'Tempo de tela diário e atividades extracurriculares.',
      'Sono, alimentação e hábitos de autocuidado.',
    ],
  },
];

// ============================================================
// 5. Carta de encaminhamento — modelo
// ============================================================
export function modeloCartaEncaminhamento(opts: {
  patient_name: string;
  data?: string;
  especialidade?: string;
}): string {
  const data = opts.data || new Date().toLocaleDateString('pt-BR');
  const esp = opts.especialidade || '[neuropediatra / fonoaudiólogo / terapeuta ocupacional]';
  return [
    `[Cidade], ${data}`,
    ``,
    `À/Ao Sr.(a) Profissional ${esp},`,
    ``,
    `Venho, por meio desta, encaminhar o(a) paciente ${opts.patient_name}, acompanhado(a) em processo psicopedagógico nesta clínica, para avaliação e/ou intervenção complementar em sua área de atuação.`,
    ``,
    `Durante o processo avaliativo foram identificadas as seguintes características relevantes que motivam o presente encaminhamento:`,
    ``,
    `- [descrever sinais observados]`,
    `- [descrever resultados de avaliação aplicada]`,
    `- [descrever impactos no contexto escolar e familiar]`,
    ``,
    `Estamos à disposição para troca interdisciplinar e compartilhamento de informações que possam contribuir com o processo terapêutico do(a) paciente, sempre com a autorização da família.`,
    ``,
    `Atenciosamente,`,
    ``,
    `_________________________________________`,
    `Psicopedagogo(a) responsável`,
  ].join('\n');
}

// ============================================================
// 6. Regressão — limiar de alerta entre duas avaliações
// ============================================================
export const REGRESSAO_LIMIAR = 1.5; // queda em pontos numa mesma escala (ex.: 0-10) que dispara alerta