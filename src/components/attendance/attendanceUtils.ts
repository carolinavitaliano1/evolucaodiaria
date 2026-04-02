import { AttendanceRow } from './AttendanceSheetPrint';
import { Evolution, Patient } from '@/types';
import { countWeekdayOccurrencesInMonth } from '@/utils/dateHelpers';

const WEEKDAY_MAP: Record<string, number> = {
  'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3,
  'Quinta': 4, 'Sexta': 5, 'Sábado': 6,
};
const REVERSE_WEEKDAY: Record<number, string> = {};
Object.entries(WEEKDAY_MAP).forEach(([k, v]) => { REVERSE_WEEKDAY[v] = k; });

/**
 * Generates all expected dates for a patient in a given month based on their weekdays.
 */
function getExpectedDates(weekdays: string[] | undefined, month: number, year: number): string[] {
  if (!weekdays || weekdays.length === 0) return [];
  const dates: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayName = REVERSE_WEEKDAY[date.getDay()];
    if (dayName && weekdays.includes(dayName)) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
  }
  return dates;
}

interface PatientInfo {
  id: string;
  name: string;
  clinicalArea?: string;
  professionals?: string;
  weekdays?: string[];
  scheduleTime?: string;
  scheduleByDay?: Record<string, { start: string; end: string }>;
}

/**
 * Builds attendance rows for a single patient in a given month.
 */
export function buildPatientAttendanceRows(
  patient: PatientInfo,
  evolutions: Evolution[],
  month: number,
  year: number
): AttendanceRow[] {
  const patientEvolutions = evolutions.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return e.patientId === patient.id && d.getMonth() === month && d.getFullYear() === year;
  });

  const expectedDates = getExpectedDates(patient.weekdays, month, year);
  const rows: AttendanceRow[] = [];

  // Add rows for actual evolutions
  for (const evo of patientEvolutions) {
    const scheduleByDay = patient.scheduleByDay;
    const dayOfWeek = new Date(evo.date + 'T00:00:00').getDay();
    const dayName = REVERSE_WEEKDAY[dayOfWeek];
    const time = scheduleByDay && dayName && scheduleByDay[dayName]
      ? scheduleByDay[dayName].start
      : patient.scheduleTime || '';

    rows.push({
      patientName: patient.name,
      specialty: patient.clinicalArea || '',
      professional: patient.professionals || '',
      date: evo.date,
      time,
      isFilled: true,
      attendanceStatus: evo.attendanceStatus,
    });
  }

  // Add blank rows for expected dates without evolutions
  const filledDates = new Set(patientEvolutions.map(e => e.date));
  for (const date of expectedDates) {
    if (!filledDates.has(date)) {
      const dayOfWeek = new Date(date + 'T00:00:00').getDay();
      const dayName = REVERSE_WEEKDAY[dayOfWeek];
      const scheduleByDay = patient.scheduleByDay;
      const time = scheduleByDay && dayName && scheduleByDay[dayName]
        ? scheduleByDay[dayName].start
        : patient.scheduleTime || '';

      rows.push({
        patientName: patient.name,
        specialty: patient.clinicalArea || '',
        professional: patient.professionals || '',
        date,
        time,
        isFilled: false,
      });
    }
  }

  // Sort by date
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

/**
 * Builds attendance rows for all patients in a clinic.
 */
export function buildClinicAttendanceRows(
  patients: PatientInfo[],
  evolutions: Evolution[],
  month: number,
  year: number,
  filterProfessional?: string
): AttendanceRow[] {
  const filteredPatients = filterProfessional
    ? patients.filter(p => p.professionals?.toLowerCase().includes(filterProfessional.toLowerCase()))
    : patients;

  const allRows: AttendanceRow[] = [];
  for (const patient of filteredPatients) {
    allRows.push(...buildPatientAttendanceRows(patient, evolutions, month, year));
  }

  // Sort by date, then by patient name
  allRows.sort((a, b) => a.date.localeCompare(b.date) || a.patientName.localeCompare(b.patientName));
  return allRows;
}
