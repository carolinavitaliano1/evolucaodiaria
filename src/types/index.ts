// Horário de entrada e saída
export interface ScheduleTimeRange {
  start: string; // Ex: '08:00'
  end: string;   // Ex: '12:00'
}

// Horário por dia da semana
export interface ScheduleByDay {
  [day: string]: ScheduleTimeRange; // Ex: { 'Segunda': { start: '08:00', end: '12:00' } }
}

export interface Clinic {
  id: string;
  name: string;
  type: 'propria' | 'terceirizada';
  address?: string;
  notes?: string;
  weekdays?: string[];
  scheduleTime?: string;
  scheduleByDay?: ScheduleByDay;
  paymentType?: 'fixo_mensal' | 'fixo_diario' | 'sessao';
  paymentAmount?: number;
  paysOnAbsence?: boolean;
  absencePaymentType?: 'always' | 'never' | 'confirmed_only';
  letterhead?: string;
  stamp?: string;
  email?: string;
  cnpj?: string;
  phone?: string;
  servicesDescription?: string;
  discountPercentage?: number;
  isArchived?: boolean;
  createdAt: string;
}

export interface Patient {
  id: string;
  clinicId: string;
  name: string;
  birthdate: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  clinicalArea?: string;
  diagnosis?: string;
  professionals?: string;
  observations?: string;
  responsibleName?: string;
  responsibleEmail?: string;
  responsibleWhatsapp?: string;
  paymentType?: 'sessao' | 'fixo';
  paymentValue?: number;
  contractStartDate?: string;
  weekdays?: string[];
  scheduleTime?: string;
  scheduleByDay?: ScheduleByDay;
  packageId?: string;
  isArchived?: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface ClinicPackage {
  id: string;
  userId: string;
  clinicId: string;
  name: string;
  description?: string;
  price: number;
  isActive: boolean;
  createdAt: string;
}

export interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number';
  required?: boolean;
  options?: string[]; // for select type
  placeholder?: string;
}

export interface EvolutionTemplate {
  id: string;
  clinicId: string;
  name: string;
  description?: string;
  fields: TemplateField[];
  isActive: boolean;
  createdAt: string;
}

export interface Evolution {
  id: string;
  patientId: string;
  clinicId: string;
  date: string;
  text: string;
  attendanceStatus: 'presente' | 'falta' | 'falta_remunerada' | 'reposicao' | 'feriado_remunerado' | 'feriado_nao_remunerado';
  confirmedAttendance?: boolean;
  mood?: 'otima' | 'boa' | 'neutra' | 'ruim' | 'muito_ruim';
  signature?: string;
  stampId?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: Attachment[];
  createdAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  professionalId: string | null;
}

export interface StampItem {
  id: string;
  userId: string;
  name: string;
  clinicalArea: string;
  stampImage: string | null;
  signatureImage: string | null;
  isDefault: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  clinicId: string;
  date: string;
  time: string;
  notes?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  notes?: string;
  patientId?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  patientId: string;
  date: string;
  amount: number;
  createdAt: string;
}

export interface Attachment {
  id: string;
  parentId: string;
  parentType: 'evolution' | 'patient' | 'clinic' | 'task';
  name: string;
  data: string;
  type: string;
  createdAt: string;
}

export interface ClinicNote {
  id: string;
  clinicId: string;
  category: 'urgent' | 'protocol' | 'general';
  text: string;
  createdAt: string;
}
