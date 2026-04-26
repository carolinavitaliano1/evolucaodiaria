import { Calendar, Clock, User, Package } from 'lucide-react';
import { usePatientScheduleSlots } from '@/hooks/usePatientScheduleSlots';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface Props {
  patientId: string;
  clinicId: string;
  organizationId?: string | null;
}

const WEEKDAY_ORDER = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export function PatientScheduleCard({ patientId, clinicId, organizationId }: Props) {
  const { slots, loading } = usePatientScheduleSlots(patientId);
  const therapistCount = new Set(slots.map(s => s.memberId)).size;
  const sortedSlots = [...slots].sort((a, b) => {
    const da = WEEKDAY_ORDER.indexOf(a.weekday);
    const db = WEEKDAY_ORDER.indexOf(b.weekday);
    if (da !== db) return da - db;
    return a.startTime.localeCompare(b.startTime);
  });

  return (
    <div className="bg-card rounded-2xl p-5 border border-border">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Agenda do Paciente
        </h3>
        {slots.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{slots.length}</strong> horário(s) com{' '}
            <strong className="text-foreground">{therapistCount}</strong> profissional(is)
          </p>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Visualização somente leitura. Para alterar, acesse a aba <strong>Equipe</strong> da clínica.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando agenda...</p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum horário cadastrado ainda. A agenda é gerenciada pela aba <strong>Equipe</strong> da clínica.
        </p>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Dia</TableHead>
                <TableHead className="w-[140px]">Horário</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Pacote</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSlots.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-sm">{s.weekday}</TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      {s.startTime} – {s.endTime}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      {s.therapistName || s.therapistEmail || 'Profissional'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.packageName ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        {s.packageName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}