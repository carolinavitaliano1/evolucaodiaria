import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ClipboardList, FileDown, FileText } from 'lucide-react';
import { downloadAttendancePDF, downloadAttendanceDOCX, ExportOptions } from './AttendanceSheetPrint';
import { buildGroupedAttendanceRows, getStatusLabel, PatientInfo } from './attendanceUtils';
import { Evolution, Patient } from '@/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface StampOption {
  id: string;
  name: string;
  clinical_area: string;
  stamp_image: string | null;
  signature_image: string | null;
  is_default: boolean | null;
}

interface ClinicAttendanceSheetProps {
  clinicName: string;
  patients: Patient[];
  evolutions: Evolution[];
}

export function ClinicAttendanceSheet({ clinicName, patients, evolutions }: ClinicAttendanceSheetProps) {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [filterProfessional, setFilterProfessional] = useState('all');

  // Export config
  const [profileName, setProfileName] = useState('');
  const [stamps, setStamps] = useState<StampOption[]>([]);
  const [selectedStampId, setSelectedStampId] = useState('none');
  const [showSignatureCol, setShowSignatureCol] = useState(false);
  const [showObsCol, setShowObsCol] = useState(false);

  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  // Load profile and stamps
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.name) setProfileName(data.name); });
    supabase.from('stamps').select('id, name, clinical_area, stamp_image, signature_image, is_default').eq('user_id', user.id)
      .then(({ data }) => { if (data) setStamps(data as StampOption[]); });
  }, [user]);

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

  const selectedStamp = selectedStampId !== 'none' ? stamps.find(s => s.id === selectedStampId) : null;

  const exportOptions: ExportOptions = {
    showSignatureCol,
    showObsCol,
    therapistName: profileName,
    therapistTitle: selectedStamp?.clinical_area || '',
    stampImageBase64: selectedStamp?.stamp_image || null,
  };

  const handleDownloadPDF = () => {
    downloadAttendancePDF(clinicName, month, year, groupedRows, exportOptions);
  };

  const handleDownloadDOCX = async () => {
    await downloadAttendanceDOCX(clinicName, month, year, groupedRows, exportOptions);
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
            {/* Therapist name from profile */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Profissional Responsável (Rodapé)</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted/30 text-sm text-foreground">
                {profileName || <span className="text-muted-foreground italic">Nome não cadastrado no perfil</span>}
              </div>
            </div>

            {/* Stamp selector from profile stamps */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Carimbo para o Documento</label>
              <Select value={selectedStampId} onValueChange={setSelectedStampId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione um carimbo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem carimbo</SelectItem>
                  {stamps.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.clinical_area} {s.is_default ? '⭐' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStamp?.stamp_image && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={selectedStamp.stamp_image} alt="Carimbo" className="h-12 w-auto rounded border border-border" />
                  <span className="text-[10px] text-muted-foreground">Preview do carimbo</span>
                </div>
              )}
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
                    <th className="border border-border px-2 py-1.5 text-left text-xs font-semibold text-foreground whitespace-nowrap">Paciente</th>
                    <th className="border border-border px-2 py-1.5 text-center text-xs font-semibold text-foreground whitespace-nowrap">Terapia</th>
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
                      </td>
                      <td className="border border-border px-2 py-1.5 text-xs text-center text-muted-foreground align-top whitespace-nowrap">
                        {row.specialty || '—'}
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
            {/* Footer preview - centered vertical signature block */}
            <div className="px-4 py-8 border-t border-border flex flex-col items-center">
              {selectedStamp?.stamp_image ? (
                <img src={selectedStamp.stamp_image} alt="Carimbo" className="h-16 w-auto mb-2" />
              ) : (
                <div className="h-16 mb-2" />
              )}
              <div className="border-t border-foreground w-72 mt-2" />
              <p className="text-center mt-1 text-sm text-foreground">
                {profileName || '________________________'}
                {selectedStamp?.clinical_area ? ` - ${selectedStamp.clinical_area}` : ''}
              </p>
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
