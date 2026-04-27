import { useEffect, useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Clock } from 'lucide-react';
import { usePatientScheduleSlots, PatientScheduleSlot } from '@/hooks/usePatientScheduleSlots';
import { supabase } from '@/integrations/supabase/client';

const WEEKDAY_BY_INDEX = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function getWeekdayKey(dateISO: string): string {
  // Use local-noon trick to avoid timezone shift
  const d = new Date(`${dateISO}T12:00:00`);
  return WEEKDAY_BY_INDEX[d.getDay()];
}

export function findSlotsForEvolution(
  slots: PatientScheduleSlot[],
  dateISO: string,
  userId?: string | null,
  memberId?: string | null,
): PatientScheduleSlot[] {
  if (!dateISO) return [];
  const wd = getWeekdayKey(dateISO);
  return slots.filter(s => {
    if (s.weekday !== wd) return false;
    // Filter by member if known. If we only know user_id, we can't compare directly,
    // so callers should pass memberId when available.
    if (memberId && s.memberId !== memberId) return false;
    return true;
  });
}

interface Props {
  patientId: string;
  date: string;                      // yyyy-MM-dd
  memberId?: string | null;          // org_member.id of the therapist (preferred)
  scheduleSlotId?: string;
  sessionTime?: string;              // HH:MM
  onChange: (next: { scheduleSlotId?: string; sessionTime?: string }) => void;
  /** Optional: pre-loaded slots to avoid an extra request (used in lists). */
  presetSlots?: PatientScheduleSlot[];
  className?: string;
  required?: boolean;
  /** Quando informado, ignora esta evolução ao calcular quais slots já foram evoluídos (uso na edição). */
  excludeEvolutionId?: string;
}

/**
 * Lets the user attach a specific scheduled time to an evolution.
 * Useful when a patient is seen multiple times on the same day so each
 * evolution can be tied to a specific session (e.g. 10:00 vs 12:40).
 */
export function SessionSlotSelector({
  patientId, date, memberId, scheduleSlotId, sessionTime, onChange,
  presetSlots, className, required, excludeEvolutionId,
}: Props) {
  const hookData = usePatientScheduleSlots(presetSlots ? undefined : patientId);
  const slots = presetSlots ?? hookData.slots;
  const loading = presetSlots ? false : hookData.loading;

  const matching = useMemo(
    () => findSlotsForEvolution(slots, date, undefined, memberId),
    [slots, date, memberId],
  );

  // Carrega evoluções do paciente naquele dia para indicar quais sessões já
  // foram evoluídas e quais ainda estão pendentes.
  const [evolvedSlotIds, setEvolvedSlotIds] = useState<Set<string>>(new Set());
  const [evolvedTimes, setEvolvedTimes] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    async function loadEvolved() {
      if (!patientId || !date) {
        setEvolvedSlotIds(new Set()); setEvolvedTimes(new Set());
        return;
      }
      const { data } = await supabase
        .from('evolutions')
        .select('id, schedule_slot_id, session_time')
        .eq('patient_id', patientId)
        .eq('date', date);
      if (cancelled) return;
      const ids = new Set<string>();
      const times = new Set<string>();
      (data || []).forEach((e: any) => {
        if (excludeEvolutionId && e.id === excludeEvolutionId) return;
        if (e.schedule_slot_id) ids.add(e.schedule_slot_id);
        if (e.session_time) times.add(String(e.session_time).slice(0, 5));
      });
      setEvolvedSlotIds(ids);
      setEvolvedTimes(times);
    }
    loadEvolved();
  }, [patientId, date, excludeEvolutionId]);

  const isSlotEvolved = (s: PatientScheduleSlot) =>
    evolvedSlotIds.has(s.id) || evolvedTimes.has((s.startTime || '').slice(0, 5));

  const pendingCount = matching.filter(s => !isSlotEvolved(s)).length;
  const showCustomTime = matching.length === 0;

  return (
    <div className={className}>
      <Label className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-primary" />
        Horário da sessão {required && <span className="text-destructive">*</span>}
      </Label>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando horários...</p>
      ) : showCustomTime ? (
        <div className="space-y-1">
          <Input
            type="time"
            value={sessionTime || ''}
            onChange={(e) => onChange({ scheduleSlotId: undefined, sessionTime: e.target.value || undefined })}
            className="h-9"
          />
          <p className="text-[11px] text-muted-foreground">
            Nenhum horário fixo cadastrado para este dia. Informe o horário da sessão (opcional).
          </p>
        </div>
      ) : (
        <Select
          value={scheduleSlotId || ''}
          onValueChange={(slotId) => {
            const slot = matching.find(s => s.id === slotId);
            if (!slot) {
              onChange({ scheduleSlotId: undefined, sessionTime: undefined });
              return;
            }
            onChange({ scheduleSlotId: slot.id, sessionTime: slot.startTime });
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={
              pendingCount === 0
                ? 'Todas as sessões deste dia já foram evoluídas'
                : (matching.length > 1 ? 'Selecione qual sessão você está evoluindo' : 'Selecione a sessão')
            } />
          </SelectTrigger>
          <SelectContent>
            {matching.map(s => {
              const evolved = isSlotEvolved(s);
              return (
                <SelectItem key={s.id} value={s.id}>
                  {evolved ? '✅' : '🕐'} {s.startTime}{s.endTime ? `–${s.endTime}` : ''}
                  {s.therapistName ? ` · ${s.therapistName}` : ''}
                  {evolved ? ' (já evoluída)' : ' · pendente'}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}

      {!showCustomTime && (
        <p className="text-[11px] text-muted-foreground mt-1">
          {pendingCount > 0
            ? <>📌 <strong>{pendingCount}</strong> sessão(ões) pendente(s) de evolução neste dia.</>
            : <>✅ Todas as sessões agendadas para hoje já foram evoluídas.</>}
        </p>
      )}

      {matching.length > 1 && !scheduleSlotId && pendingCount > 0 && (
        <p className="text-[11px] text-warning mt-1">
          ⚠️ Este paciente tem mais de um atendimento neste dia. Escolha qual sessão você está evoluindo.
        </p>
      )}
    </div>
  );
}
          </SelectContent>
        </Select>
      )}

      {matching.length > 1 && !scheduleSlotId && (
        <p className="text-[11px] text-warning mt-1">
          ⚠️ Este paciente tem mais de um atendimento neste dia. Escolha qual sessão você está evoluindo.
        </p>
      )}
    </div>
  );
}