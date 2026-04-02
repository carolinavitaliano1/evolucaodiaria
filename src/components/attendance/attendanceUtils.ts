import { Evolution, Patient } from '@/types';

const WEEKDAY_MAP: Record<string, number> = {
  'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3,
  'Quinta': 4, 'Sexta': 5, 'Sábado': 6,
};
const REVERSE_WEEKDAY: Record<number, string> = {};
Object.entries(WEEKDAY_MAP).forEach(([k, v]) => { REVERSE_WEEKDAY[v] = k; });

export interface SessionEntry {
  date: string;
  time: string;
  isFilled: boolean;
  attendanceStatus?: string;
}

export interface GroupedPatientRow {
  patientId: string;
  patientName: string;
  responsibleName: string;
  specialty: string;
  professional: string;
  sessions: SessionEntry[];
}

export interface PatientInfo {
  id: string;
  name: string;
  responsibleName?: string;
  clinicalArea?: string;
  professionals?: string;
  weekdays?: string[];
  scheduleTime?: string;
  scheduleByDay?: Record<string, { start: string; end: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  presente: 'Presente',
  falta: 'Falta',
  falta_remunerada: 'Falta Rem.',
  reposicao: 'Reposição',
  feriado_remunerado: 'Feriado Rem.',
  feriado_nao_remunerado: 'Feriado',
};

export function getStatusLabel(status?: string): string {
  if (!status) return 'Agendado';
  return STATUS_LABELS[status] || status;
}

const THERAPY_ABBREVIATIONS: Record<string, string> = {
  'psicopedagogia': 'Psico',
  'musicoterapia': 'Música',
  'psicomotricidade': 'Psicomot.',
  'fonoaudiologia': 'Fono',
  'terapia ocupacional': 'T.O.',
  'fisioterapia': 'Fisio',
  'psicologia': 'Psicol.',
  'neuropsicologia': 'Neuro',
  'arteterapia': 'Arte',
  'pedagogia': 'Pedag.',
  'nutrição': 'Nutri',
  'educação física': 'Ed. Fís.',
  'análise do comportamento aplicada': 'ABA',
  'aba': 'ABA',
  'integração sensorial': 'I.S.',
};

export function abbreviateTherapy(name?: string): string {
  if (!name) return '—';
  const lower = name.toLowerCase().trim();
  if (THERAPY_ABBREVIATIONS[lower]) return THERAPY_ABBREVIATIONS[lower];
  // Try partial match
  for (const [key, abbr] of Object.entries(THERAPY_ABBREVIATIONS)) {
    if (lower.includes(key)) return abbr;
  }
  // Fallback: truncate if too long
  return name.length > 10 ? name.substring(0, 8) + '.' : name;
}

function getExpectedDates(weekdays: string[] | undefined, month: number, year: number): string[] {
  if (!weekdays || weekdays.length === 0) return [];
  const dates: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayName = REVERSE_WEEKDAY[date.getDay()];
    if (dayName && weekdays.includes(dayName)) {
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${mm}-${dd}`);
    }
  }
  return dates;
}

function getTimeForDate(patient: PatientInfo, dateStr: string): string {
  const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
  const dayName = REVERSE_WEEKDAY[dayOfWeek];
  if (patient.scheduleByDay && dayName && patient.scheduleByDay[dayName]) {
    return patient.scheduleByDay[dayName].start;
  }
  return patient.scheduleTime || '';
}

export function buildGroupedAttendanceRows(
  patients: PatientInfo[],
  evolutions: Evolution[],
  month: number,
  year: number,
  filterProfessional?: string
): GroupedPatientRow[] {
  const filtered = filterProfessional
    ? patients.filter(p => p.professionals?.toLowerCase().includes(filterProfessional.toLowerCase()))
    : patients;

  const rows: GroupedPatientRow[] = [];

  for (const patient of filtered) {
    const patientEvos = evolutions.filter(e => {
      const d = new Date(e.date + 'T00:00:00');
      return e.patientId === patient.id && d.getMonth() === month && d.getFullYear() === year;
    });

    const expectedDates = getExpectedDates(patient.weekdays, month, year);
    const sessions: SessionEntry[] = [];

    // Add filled sessions from evolutions
    for (const evo of patientEvos) {
      sessions.push({
        date: evo.date,
        time: getTimeForDate(patient, evo.date),
        isFilled: true,
        attendanceStatus: evo.attendanceStatus,
      });
    }

    // Add expected dates without evolutions
    const filledDates = new Set(patientEvos.map(e => e.date));
    for (const date of expectedDates) {
      if (!filledDates.has(date)) {
        sessions.push({
          date,
          time: getTimeForDate(patient, date),
          isFilled: false,
        });
      }
    }

    sessions.sort((a, b) => a.date.localeCompare(b.date));

    if (sessions.length > 0) {
      rows.push({
        patientId: patient.id,
        patientName: patient.name,
        responsibleName: patient.responsibleName || '',
        specialty: patient.clinicalArea || '',
        professional: patient.professionals || '',
        sessions,
      });
    }
  }

  rows.sort((a, b) => a.patientName.localeCompare(b.patientName));
  return rows;
}
