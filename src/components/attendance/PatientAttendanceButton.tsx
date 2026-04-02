import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, FileDown, FileText } from 'lucide-react';
import { downloadAttendancePDF, downloadAttendanceDOCX, ExportOptions } from './AttendanceSheetPrint';
import { buildGroupedAttendanceRows, PatientInfo, abbreviateTherapy, getStatusLabel } from './attendanceUtils';
import { Evolution, Patient } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

interface PatientAttendanceButtonProps {
  patient: Patient;
  clinicName: string;
  evolutions: Evolution[];
}

export function PatientAttendanceButton({ patient, clinicName, evolutions }: PatientAttendanceButtonProps) {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

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

  const patientInfo: PatientInfo = useMemo(() => ({
    id: patient.id,
    name: patient.name,
    responsibleName: patient.responsibleName,
    clinicalArea: patient.clinicalArea,
    professionals: patient.professionals,
    weekdays: patient.weekdays,
    scheduleTime: patient.scheduleTime,
    scheduleByDay: patient.scheduleByDay as any,
  }), [patient]);

  const groupedRows = useMemo(() =>
    buildGroupedAttendanceRows([patientInfo], evolutions, month, year),
    [patientInfo, evolutions, month, year]);

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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="w-4 h-4 text-primary" />
            Frequência do Paciente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Month/Year selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês</label>
              <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="w-[90px] h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Export config */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Profissional Responsável (Rodapé)</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted/30 text-sm text-foreground">
                {profileName || <span className="text-muted-foreground italic">Nome não cadastrado no perfil</span>}
              </div>
            </div>
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
              <Switch id="pat-show-sig" checked={showSignatureCol} onCheckedChange={setShowSignatureCol} />
              <Label htmlFor="pat-show-sig" className="text-xs cursor-pointer">Coluna de Assinatura</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="pat-show-obs" checked={showObsCol} onCheckedChange={setShowObsCol} />
              <Label htmlFor="pat-show-obs" className="text-xs cursor-pointer">Coluna de Observações</Label>
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleDownloadPDF} className="gap-1.5 h-9" size="sm">
              <FileDown className="w-4 h-4" />
              Baixar PDF
            </Button>
            <Button onClick={handleDownloadDOCX} variant="outline" className="gap-1.5 h-9" size="sm">
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
                        {abbreviateTherapy(row.specialty)}
                      </td>
                      {Array.from({ length: maxSessions }, (_, i) => {
                        const s = row.sessions[i];
                        if (!s) return <td key={i} className="border border-border px-1 py-1" />;
                        const dateLabel = format(new Date(s.date + 'T00:00:00'), 'dd/MM');
                        const statusLabel = s.isFilled ? getStatusLabel(s.attendanceStatus) : 'Agend.';
                        const statusColor = s.isFilled
                          ? s.attendanceStatus === 'presente' ? 'text-emerald-600' : 'text-amber-600'
                          : 'text-muted-foreground';
                        return (
                          <td key={i} className="border border-border px-1 py-1 text-center align-top">
                            <div className="text-[10px] text-muted-foreground">{dateLabel}</div>
                            <div className={cn('text-[9px] font-medium', statusColor)}>{statusLabel}</div>
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
          </CardContent>
        </Card>
      )}

      {groupedRows.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhuma sessão encontrada para {MONTHS[month]} de {year}.
        </p>
      )}
    </div>
  );
}
