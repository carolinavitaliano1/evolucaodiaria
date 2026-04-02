import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, ClipboardList } from 'lucide-react';
import { printAttendanceSheet } from './AttendanceSheetPrint';
import { buildClinicAttendanceRows } from './attendanceUtils';
import { Evolution, Patient } from '@/types';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface ClinicAttendanceSheetProps {
  clinicName: string;
  patients: Patient[];
  evolutions: Evolution[];
}

export function ClinicAttendanceSheet({ clinicName, patients, evolutions }: ClinicAttendanceSheetProps) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [filterProfessional, setFilterProfessional] = useState('all');

  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  // Extract unique professionals
  const professionals = useMemo(() => {
    const set = new Set<string>();
    patients.forEach(p => {
      if (p.professionals) set.add(p.professionals);
    });
    return Array.from(set).sort();
  }, [patients]);

  const handlePrint = () => {
    const patientInfos = patients.filter(p => !p.isArchived).map(p => ({
      id: p.id,
      name: p.name,
      clinicalArea: p.clinicalArea,
      professionals: p.professionals,
      weekdays: p.weekdays,
      scheduleTime: p.scheduleTime,
      scheduleByDay: p.scheduleByDay as any,
    }));

    const rows = buildClinicAttendanceRows(
      patientInfos,
      evolutions,
      month,
      year,
      filterProfessional !== 'all' ? filterProfessional : undefined
    );
    printAttendanceSheet(clinicName, month, year, rows);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="w-5 h-5 text-primary" />
          Frequências e Assinaturas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Gere a lista de frequência mensal para impressão. Sessões já registradas aparecem com status, e sessões futuras previstas pelo contrato aparecem em branco para colher assinaturas.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês</label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Ano</label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-[85px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {professionals.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Profissional</label>
              <Select value={filterProfessional} onValueChange={setFilterProfessional}>
                <SelectTrigger className="w-[180px] h-9 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionals.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={handlePrint} className="gap-1.5 h-9">
            <Printer className="w-4 h-4" />
            Gerar Lista Geral
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
