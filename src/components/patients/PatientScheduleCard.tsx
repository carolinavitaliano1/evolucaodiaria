import { Calendar, Clock, User, Wallet } from 'lucide-react';
import { usePatientScheduleSlots } from '@/hooks/usePatientScheduleSlots';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { countWeekdayOccurrencesInMonth } from '@/utils/dateHelpers';

interface Props {
  patientId: string;
  clinicId: string;
  organizationId?: string | null;
}

const WEEKDAY_ORDER = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const normalizeWeekday = (w: string): number => {
  if (!w) return 99;
  const s = w.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s.startsWith('seg')) return 0;
  if (s.startsWith('ter')) return 1;
  if (s.startsWith('qua')) return 2;
  if (s.startsWith('qui')) return 3;
  if (s.startsWith('sex')) return 4;
  if (s.startsWith('sab')) return 5;
  if (s.startsWith('dom')) return 6;
  return 99;
};

export function PatientScheduleCard({ patientId, clinicId, organizationId }: Props) {
  const { slots, loading } = usePatientScheduleSlots(patientId);
  const therapistCount = new Set(slots.map(s => s.memberId)).size;
  const sortedSlots = [...slots].sort((a, b) => {
    const da = normalizeWeekday(a.weekday);
    const db = normalizeWeekday(b.weekday);
    if (da !== db) return da - db;
    return a.startTime.localeCompare(b.startTime);
  });

  // Para pacotes "Mensal", calcula ocorrências totais (no mês atual) de TODOS
  // os slots vinculados ao mesmo plano de remuneração, para dividir o valor
  // proporcionalmente.
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  // Detecta pacote mensal por: (a) packageType vindo de clinic_packages OU
  // (b) nome do plano de remuneração contendo "mensal" (caso comum quando o
  //    plano é avulso, sem vínculo com clinic_packages).
  const isMensalPlan = (s: typeof slots[number]) => {
    if (s.remunerationPlanType !== 'pacote') return false;
    if (s.packageType === 'mensal') return true;
    const name = (s.remunerationPlanName || '').toLowerCase();
    return name.includes('mensal');
  };
  const occurrencesByPlan = new Map<string, number>();
  slots.forEach(s => {
    if (!isMensalPlan(s)) return;
    const key = s.remunerationPlanId || `${s.memberId}|${s.remunerationPlanName}`;
    const prev = occurrencesByPlan.get(key) || 0;
    occurrencesByPlan.set(key, prev + countWeekdayOccurrencesInMonth(s.weekday, month, year));
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
                <TableHead>Plano de remuneração</TableHead>
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
                    {s.remunerationPlanName ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <Wallet className="w-3.5 h-3.5" />
                          {s.remunerationPlanName}
                        </span>
                        {s.remunerationPlanValue != null && (
                          <span className="text-[11px] font-semibold text-success ml-5">
                            R$ {s.remunerationPlanValue.toFixed(2)}
                            {s.remunerationPlanType === 'por_sessao' && (
                              <span className="text-muted-foreground font-normal"> / sessão</span>
                            )}
                            {s.remunerationPlanType === 'fixo_mensal' && (
                              <span className="text-muted-foreground font-normal"> / mês</span>
                            )}
                            {s.remunerationPlanType === 'pacote' && (
                              <span className="text-muted-foreground font-normal"> (pacote)</span>
                            )}
                          </span>
                        )}
                        {/* Detalhamento dinâmico para pacote MENSAL — igual ao consultório */}
                        {isMensalPlan(s) && s.remunerationPlanValue != null && s.remunerationPlanValue > 0 && (() => {
                          const key = s.remunerationPlanId || `${s.memberId}|${s.remunerationPlanName}`;
                          const occ = occurrencesByPlan.get(key) || 0;
                          if (occ <= 0) return null;
                          const perSession = s.remunerationPlanValue! / occ;
                          return (
                            <span className="text-[11px] text-primary/80 ml-5">
                              Mês de {occ} {occ === 1 ? 'semana' : 'semanas'}: R$ {perSession.toFixed(2)}/sessão
                            </span>
                          );
                        })()}
                        {/* Detalhamento para pacote PERSONALIZADO (N sessões fixas) */}
                        {s.remunerationPlanType === 'pacote' && !isMensalPlan(s) && s.remunerationPlanValue != null && s.remunerationPlanValue > 0 && (() => {
                          // Usa session_limit do pacote vinculado, ou tenta extrair do nome do plano
                          let limit = s.packageSessionLimit || 0;
                          if (!limit) {
                            const m = (s.remunerationPlanName || '').match(/(\d+)\s*(sess|sessao|sessão|sessoes|sessões)/i);
                            if (m) limit = parseInt(m[1], 10);
                          }
                          if (limit <= 0) return null;
                          const perSession = s.remunerationPlanValue! / limit;
                          return (
                            <span className="text-[11px] text-primary/80 ml-5">
                              Pacote {limit} {limit === 1 ? 'sessão' : 'sessões'}: R$ {perSession.toFixed(2)}/sessão
                            </span>
                          );
                        })()}
                      </div>
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