export type AvaliacaoTipo = 'inicial' | 'reavaliacao' | 'alta';
export type PdiStatus = 'ativo' | 'concluido' | 'pausado';
export type RelatorioTipo = 'escola' | 'familia' | 'encaminhamento' | 'alta';
export type Desempenho = 'otimo' | 'bom' | 'regular' | 'dificuldade';
export type Humor = 'animado' | 'tranquilo' | 'agitado' | 'ansioso' | 'resistente';

export interface Avaliacao {
  id: string;
  patient_id: string;
  therapist_id: string;
  data_avaliacao: string;
  tipo: AvaliacaoTipo;
  status: 'pendente' | 'concluida';
  leitura: number | null;
  escrita: number | null;
  matematica: number | null;
  atencao: number | null;
  memoria: number | null;
  linguagem: number | null;
  testes_aplicados: string[] | null;
  observacoes: string | null;
  arquivo_url: string | null;
  arquivo_nome?: string | null;
  titulo?: string | null;
  instrumento?: string | null;
  metricas?: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export interface PdiObjetivo {
  area: string;
  meta: string;
  prazo?: string;
  atingida: boolean;
}

export interface PDI {
  id: string;
  patient_id: string;
  therapist_id: string;
  avaliacao_id: string | null;
  titulo: string;
  periodo_inicio: string;
  periodo_fim: string | null;
  status: PdiStatus;
  objetivos: PdiObjetivo[];
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PsicoEvolucao {
  id: string;
  patient_id: string;
  therapist_id: string;
  pdi_id: string | null;
  data_sessao: string;
  duracao_min: number | null;
  atividades: string[] | null;
  desempenho: Desempenho | null;
  humor: Humor | null;
  descricao: string;
  tarefas_casa: string | null;
  created_at: string;
}

export interface Relatorio {
  id: string;
  patient_id: string;
  therapist_id: string;
  tipo: RelatorioTipo;
  titulo: string | null;
  conteudo: string;
  pdf_url: string | null;
  enviado_em: string | null;
  created_at: string;
}

export const TESTES_SUGERIDOS = [
  'WISC-V', 'WAIS-IV', 'Bender', 'Frostig', 'TDE-II', 'Provinha Brasil',
  'BPA-2', 'Trail Making Test', 'CONFIAS', 'Boehm', 'Raven', 'TONI-4'
];

export const INSTRUMENTOS_PADRAO = [
  'WISC-IV', 'WISC-V', 'IDADI', 'Raven', 'CARS-2',
  'Avaliação Psicopedagógica', 'TDE-II', 'Bender', 'Outros',
];

export const CATEGORIAS_TIPO = [
  'Avaliação Cognitiva',
  'Avaliação Neuropsicológica',
  'Avaliação Pedagógica',
  'Avaliação Psicopedagógica',
  'Outros',
];

export const METRICAS_PADRAO_SUGERIDAS = [
  'Memória', 'Atenção', 'Linguagem', 'Raciocínio', 'Coordenação', 'Percepção',
];

export interface AvaliacaoTipoCustom {
  id: string;
  therapist_id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  metricas_padrao: string[];
  created_at: string;
  updated_at: string;
}

export const DOMINIOS: { key: keyof Pick<Avaliacao, 'leitura'|'escrita'|'matematica'|'atencao'|'memoria'|'linguagem'>; label: string }[] = [
  { key: 'leitura', label: 'Leitura' },
  { key: 'escrita', label: 'Escrita' },
  { key: 'matematica', label: 'Matemática' },
  { key: 'atencao', label: 'Atenção' },
  { key: 'memoria', label: 'Memória' },
  { key: 'linguagem', label: 'Linguagem' },
];

export interface Registro {
  id: string;
  patient_id: string;
  therapist_id: string;
  tipo: string;
  codigo: string | null;
  data_registro: string;
  descricao: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  created_at: string;
  updated_at: string;
}

export const REGISTRO_TIPOS_PADRAO = ['PEI', 'Atividade', 'Documento', 'Ocorrência', 'Relatório', 'Anotação'];

export type ReuniaoStatus = 'agendada' | 'realizada' | 'cancelada';
export type ReuniaoModalidade = 'presencial' | 'online';

export interface Reuniao {
  id: string;
  patient_id: string;
  therapist_id: string;
  titulo: string;
  data_hora: string;
  duracao_min: number | null;
  modalidade: ReuniaoModalidade;
  local_ou_link: string | null;
  participantes: string[] | null;
  pauta: string | null;
  status: ReuniaoStatus;
  notas: string | null;
  created_at: string;
  updated_at: string;
}