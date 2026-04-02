import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, FileDown, FileText } from 'lucide-react';
import { downloadAttendancePDF, downloadAttendanceDOCX } from './AttendanceSheetPrint';
import { buildGroupedAttendanceRows, getStatusLabel, GroupedPatientRow, PatientInfo } from './attendanceUtils';
import { Evolution, Patient } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

  const professionals = useMemo(() => {
    const set = new Set<string>();
    patients.forEach(p => { if (p.professionals) set.add(p.professionals); });
    return Array.from(set).sort();
  }, [patients]);

  const patientInfos: PatientInfo[] = useMemo(() =>
    patients.filter(p => !p.isArchived).map(p => ({
      id: p.id,
      name: p.name,
      responsibleName: p.responsibleName,
      clinicalArea: p.clinicalArea,
      professionals: p.professionals,
      weekdays: p.weekdays,
      scheduleTime: p.scheduleTime,
      scheduleByDay: p.scheduleByDay as any,
    })), [patients]);

  const groupedRows = useMemo(() =>
    buildGroupedAttendanceRows(
      patientInfos, evolutions, month, year,
      filterProfessional !== 'all' ? filterProfessional : undefined
    ), [patientInfos, evolutions, month, year, filterProfessional]);

  const handleDownloadPDF = () => {
    downloadAttendancePDF(clinicName, month, year, groupedRows);
  };

  const handleDownloadDOCX = async () => {
    await downloadAttendanceDOCX(clinicName, month, year, groupedRows);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="w-5 h-5 text-primary" />
            Frequências e Assinaturas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Gere a lista de frequência mensal agrupada por paciente. Baixe em PDF ou Word para impressão e coleta de assinaturas.
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
            <Button onClick={handleDownloadPDF} className="gap-1.5 h-9">
              <FileDown className="w-4 h-4" />
              Baixar PDF
            </Button>
            <Button onClick={handleDownloadDOCX} variant="outline" className="gap-1.5 h-9">
              <FileText className="w-4 h-4" />
              Baixar Word
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview table */}
      {groupedRows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-3 py-2 text-left text-xs font-semibold text-foreground">Paciente / Responsável</th>
                    <th className="border border-border px-3 py-2 text-center text-xs font-semibold text-foreground">Terapeuta</th>
                    <th className="border border-border px-3 py-2 text-left text-xs font-semibold text-foreground">Datas e Status</th>
                    <th className="border border-border px-3 py-2 text-center text-xs font-semibold text-foreground w-[140px]">Assinatura</th>
                    <th className="border border-border px-3 py-2 text-center text-xs font-semibold text-foreground w-[90px]">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map(row => (
                    <tr key={row.patientId} className="min-h-[80px]">
                      <td className="border border-border px-3 py-3 text-sm align-top">
                        <div className="font-medium text-foreground">{row.patientName}</div>
                        {row.responsibleName && (
                          <div className="text-xs text-muted-foreground mt-0.5">Resp.: {row.responsibleName}</div>
                        )}
                      </td>
                      <td className="border border-border px-3 py-3 text-xs text-center text-muted-foreground align-top">
                        {row.professional || '—'}
                      </td>
                      <td className="border border-border px-3 py-3 text-xs align-top">
                        <div className="flex flex-wrap gap-1">
                          {row.sessions.map((s, i) => {
                            const dateStr = format(new Date(s.date + 'T00:00:00'), 'dd/MM');
                            const label = s.isFilled ? getStatusLabel(s.attendanceStatus) : 'Agendado';
                            const isPresent = s.attendanceStatus === 'presente' || s.attendanceStatus === 'reposicao';
                            const isAbsent = s.attendanceStatus === 'falta';
                            return (
                              <span
                                key={i}
                                className={cn(
                                  'inline-block px-1.5 py-0.5 rounded text-[10px] border',
                                  isPresent && 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400',
                                  isAbsent && 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400',
                                  !s.isFilled && 'bg-muted border-border text-muted-foreground',
                                  s.isFilled && !isPresent && !isAbsent && 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400'
                                )}
                              >
                                {dateStr} ({label})
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="border border-border px-3 py-3" />
                      <td className="border border-border px-3 py-3" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {groupedRows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum paciente com sessões previstas ou registradas neste período.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
