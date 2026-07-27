export type SuperviseeStatus = 'ativo' | 'encerrado';
export type SuperviseeLinkType = 'externo' | 'equipe';
export type SupervisionPaymentType = 'sessao' | 'mensal';
export type SupervisionModality = 'individual' | 'grupo';
export type SupervisionFormat = 'online' | 'presencial';
export type SupervisionAttendance = 'presente' | 'falta' | 'falta_cobrada' | 'remarcada';

export interface Supervisee {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  education: string | null;
  council_registration: string | null;
  approach: string | null;
  link_type: string;
  member_id: string | null;
  start_date: string | null;
  end_date: string | null;
  hours_goal: number | null;
  payment_type: string;
  payment_value: number | null;
  payment_due_day: number | null;
  recurrence_weekdays: string[] | null;
  recurrence_time: string | null;
  recurrence_frequency: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export interface SupervisionSession {
  id: string;
  user_id: string;
  supervisee_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  modality: string;
  format: string;
  attendance_status: string;
  topics: string | null;
  content: string | null;
  referrals: string | null;
  ethics_notes: string | null;
  stamp_id: string | null;
  created_at: string;
}

export interface SupervisionGoal {
  id: string;
  user_id: string;
  supervisee_id: string;
  competency: string;
  goal: string | null;
  due_date: string | null;
  score: number | null;
  status: string;
  feedback: string | null;
  created_at: string;
}

export interface SupervisionPayment {
  id: string;
  user_id: string;
  supervisee_id: string;
  reference_month: number | null;
  reference_year: number | null;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  status: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export const ATTENDANCE_LABELS: Record<string, string> = {
  presente: 'Presente',
  falta: 'Falta',
  falta_cobrada: 'Falta cobrada',
  remarcada: 'Remarcada',
};

/** Status que contam horas e são faturáveis. */
export const BILLABLE_STATUSES = ['presente', 'falta_cobrada'];
export const HOUR_STATUSES = ['presente'];

export const COMPETENCIES = [
  'Avaliação clínica',
  'Manejo de caso',
  'Escrita de documentos',
  'Ética profissional',
  'Fundamentação teórica',
  'Relação terapêutica',
];

export const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];