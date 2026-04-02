import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer } from 'lucide-react';
import { printAttendanceSheet } from './AttendanceSheetPrint';
import { buildPatientAttendanceRows } from './attendanceUtils';
import { Evolution, Patient } from '@/types';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface PatientAttendanceButtonProps {
  patient: Patient;
  clinicName: string;
  evolutions: Evolution[];
}

export function PatientAttendanceButton({ patient, clinicName, evolutions }: PatientAttendanceButtonProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const handlePrint = () => {
    const rows = buildPatientAttendanceRows(
      {
        id: patient.id,
        name: patient.name,
        clinicalArea: patient.clinicalArea,
        professionals: patient.professionals,
        weekdays: patient.weekdays,
        scheduleTime: patient.scheduleTime,
        scheduleByDay: patient.scheduleByDay as any,
      },
      evolutions,
      month,
      year
    );
    printAttendanceSheet(clinicName, month, year, rows);
  };

  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => (
            <SelectItem key={i} value={String(i)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
        <SelectTrigger className="w-[80px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map(y => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs h-8">
        <Printer className="w-3.5 h-3.5" />
        Imprimir Frequência
      </Button>
    </div>
  );
}
