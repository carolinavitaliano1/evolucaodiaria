export interface Clinic {
  id: string;
  name: string;
  type: 'propria' | 'terceirizada';
  address?: string;
  notes?: string;
  weekdays?: string[];
  scheduleTime?: string;
  paymentType?: 'fixo_mensal' | 'fixo_diario' | 'sessao';
  paymentAmount?: number;
  paysOnAbsence?: boolean; // Se a clínica paga o terapeuta quando paciente falta
  letterhead?: string;
  stamp?: string;
  createdAt: string;
}

export interface Patient {
  id: string;
  clinicId: string;
  name: string;
  birthdate: string;
  phone?: string;
  clinicalArea?: string;
  diagnosis?: string;
  professionals?: string;
  observations?: string;
  responsibleName?: string;
  responsibleEmail?: string;
  paymentType?: 'sessao' | 'fixo';
  paymentValue?: number;
  contractStartDate?: string;
  weekdays?: string[];
  scheduleTime?: string;
  createdAt: string;
}

export interface Evolution {
  id: string;
  patientId: string;
  clinicId: string;
  date: string;
  text: string;
  attendanceStatus: 'presente' | 'falta';
  signature?: string;
  stampId?: string;
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
