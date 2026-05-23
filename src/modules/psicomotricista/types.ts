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
  equilibrio: number | null;
  coord_global: number | null;
  coord_fina: number | null;
  esquema_corporal: number | null;
  lateralidade: number | null;
  org_espacial: number | null;
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
  video_url?: string;
  idade_alvo?: string;
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
  'BPM (Fonseca)', 'EDM (Rosa Neto)', 'TGMD-2', 'Movement ABC-2',
  'Beery VMI', 'Bender', 'Bruininks-Oseretsky', 'Perfil Sensorial'
];

export const INSTRUMENTOS_PADRAO = [
  'BPM (Fonseca)', 'EDM', 'TGMD-2', 'Movement ABC-2',
  'Beery VMI', 'Bender', 'Avaliação Psicomotora', 'Outros',
];

export const CATEGORIAS_TIPO = [
  'Avaliação Psicomotora',
  'Integração Sensorial',
  'Motora Global',
  'Motora Fina',
  'Outros',
];

export const METRICAS_PADRAO_SUGERIDAS = [
  'Equilíbrio', 'Coord. Global', 'Coord. Fina', 'Esquema Corporal',
  'Lateralidade', 'Org. Espacial', 'Org. Temporal', 'Tônus',
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

export const DOMINIOS: { key: keyof Pick<Avaliacao, 'equilibrio'|'coord_global'|'coord_fina'|'esquema_corporal'|'lateralidade'|'org_espacial'>; label: string }[] = [
  { key: 'equilibrio', label: 'Equilíbrio' },
  { key: 'coord_global', label: 'Coord. Global' },
  { key: 'coord_fina', label: 'Coord. Fina' },
  { key: 'esquema_corporal', label: 'Esquema Corporal' },
  { key: 'lateralidade', label: 'Lateralidade' },
  { key: 'org_espacial', label: 'Org. Espacial' },
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