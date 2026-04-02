import { useState, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ClipboardList, FileDown, FileText, Upload, X } from 'lucide-react';
import { downloadAttendancePDF, downloadAttendanceDOCX, ExportOptions } from './AttendanceSheetPrint';
import { buildGroupedAttendanceRows, getStatusLabel, GroupedPatientRow, PatientInfo } from './attendanceUtils';
import { Evolution, Patient } from '@/types';
import { format } from 'date-fns';
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

  // Export config
  const [selectedTherapist, setSelectedTherapist] = useState('');
  const [stampImage, setStampImage] = useState<string | null>(null);
  const [showSignatureCol, setShowSignatureCol] = useState(false);
  const [showObsCol, setShowObsCol] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const maxSessions = useMemo(() =>
    groupedRows.reduce((max, row) => Math.max(max, row.sessions.length), 0),
    [groupedRows]);

  const exportOptions: ExportOptions = {
    showSignatureCol,
    showObsCol,
    therapistName: selectedTherapist === 'none' ? '' : selectedTherapist,
    stampImageBase64: stampImage,
  };

  const handleDownloadPDF = () => {
    downloadAttendancePDF(clinicName, month, year, groupedRows, exportOptions);
  };

  const handleDownloadDOCX = async () => {
    await downloadAttendanceDOCX(clinicName, month, year, groupedRows, exportOptions);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setStampImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="w-5 h-5 text-primary" />
            Frequências e Assinaturas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Gere a lista de frequência mensal agrupada por paciente. Configure as opções abaixo antes de exportar.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês</label>
              <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ano</label>
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger className="w-[85px] h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {professionals.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Filtrar por Profissional</label>
                <Select value={filterProfessional} onValueChange={setFilterProfessional}>
                  <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {professionals.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Config Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Configurações de Exportação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Therapist for footer */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Profissional Responsável (Rodapé)</label>
              <Select value={selectedTherapist} onValueChange={setSelectedTherapist}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {professionals.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Stamp upload */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Carimbo / Assinatura (imagem)</label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleStampUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {stampImage ? 'Trocar imagem' : 'Enviar imagem'}
                </Button>
                {stampImage && (
                  <div className="flex items-center gap-2">
                    <img src={stampImage} alt="Carimbo" className="h-10 w-auto rounded border border-border" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setStampImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column toggles */}
          <div className="flex flex-wrap gap-6 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Switch id="show-sig" checked={showSignatureCol} onCheckedChange={setShowSignatureCol} />
              <Label htmlFor="show-sig" className="text-xs cursor-pointer">Exibir coluna de Assinatura do Responsável</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="show-obs" checked={showObsCol} onCheckedChange={setShowObsCol} />
              <Label htmlFor="show-obs" className="text-xs cursor-pointer">Exibir coluna de Observações</Label>
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 pt-2">
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
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold text-foreground whitespace-nowrap">Paciente / Resp.</th>
                    <th className="border border-border px-2 py-1.5 text-center text-xs font-semibold text-foreground whitespace-nowrap">Terapeuta</th>
                    {Array.from({ length: maxSessions }, (_, i) => (
                      <th key={i} className="border border-border px-1 py-1.5 text-center text-xs font-semibold text-foreground whitespace-nowrap">
                        S{i + 1}
                      </th>
                    ))}
                    {showSignatureCol && (
                      <th className="border border-border px-2 py-1.5 text-center text-xs font-semibold text-foreground w-[120px]">Assinatura</th>
                    )}
                    {showObsCol && (
                      <th className="border border-border px-2 py-1.5 text-center text-xs font-semibold text-foreground w-[70px]">Obs.</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map(row => (
                    <tr key={row.patientId}>
                      <td className="border border-border px-2 py-1.5 align-top">
                        <div className="font-medium text-foreground text-xs leading-tight">{row.patientName}</div>
                        {row.responsibleName && (
                          <div className="text-[10px] text-muted-foreground">Resp.: {row.responsibleName}</div>
                        )}
                      </td>
                      <td className="border border-border px-2 py-1.5 text-xs text-center text-muted-foreground align-top whitespace-nowrap">
                        {row.professional || '—'}
                      </td>
                      {Array.from({ length: maxSessions }, (_, i) => {
                        const s = row.sessions[i];
                        if (!s) return <td key={i} className="border border-border px-1 py-1.5" />;
                        const dateStr = format(new Date(s.date + 'T00:00:00'), 'dd/MM');
                        const label = s.isFilled ? getStatusLabel(s.attendanceStatus) : 'Agend.';
                        const isPresent = s.attendanceStatus === 'presente' || s.attendanceStatus === 'reposicao';
                        const isAbsent = s.attendanceStatus === 'falta';
                        return (
                          <td key={i} className="border border-border px-1 py-1.5 text-center align-top">
                            <div className={cn(
                              'text-[10px] leading-tight rounded px-0.5 py-0.5',
                              isPresent && 'text-green-700 dark:text-green-400',
                              isAbsent && 'text-red-700 dark:text-red-400',
                              !s.isFilled && 'text-muted-foreground',
                              s.isFilled && !isPresent && !isAbsent && 'text-yellow-700 dark:text-yellow-400'
                            )}>
                              <div className="font-medium">{dateStr}</div>
                              <div>{label}</div>
                            </div>
                          </td>
                        );
                      })}
                      {showSignatureCol && <td className="border border-border px-2 py-1.5" />}
                      {showObsCol && <td className="border border-border px-2 py-1.5" />}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Footer preview */}
            <div className="px-4 py-6 space-y-3 border-t border-border">
              <p className="text-sm text-foreground">
                Responsável: {selectedTherapist || '____________________________________________________'}
              </p>
              {stampImage ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Carimbo:</span>
                  <img src={stampImage} alt="Carimbo" className="h-16 w-auto" />
                </div>
              ) : (
                <p className="text-sm text-foreground">Assinatura / Carimbo: ____________________________________________________</p>
              )}
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
