import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Clock } from 'lucide-react';
import { usePatientScheduleSlots, PatientScheduleSlot } from '@/hooks/usePatientScheduleSlots';

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
}

/**
 * Lets the user attach a specific scheduled time to an evolution.
 * Useful when a patient is seen multiple times on the same day so each
 * evolution can be tied to a specific session (e.g. 10:00 vs 12:40).
 */
export function SessionSlotSelector({
  patientId, date, memberId, scheduleSlotId, sessionTime, onChange,
  presetSlots, className, required,
}: Props) {
  const hookData = usePatientScheduleSlots(presetSlots ? undefined : patientId);
  const slots = presetSlots ?? hookData.slots;
  const loading = presetSlots ? false : hookData.loading;

  const matching = useMemo(
    () => findSlotsForEvolution(slots, date, undefined, memberId),
    [slots, date, memberId],
  );

  // If a slot is selected but the date no longer matches, clear it.
  // Otherwise show free-time input when nothing matches.
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
            <SelectValue placeholder={matching.length > 1 ? 'Selecione qual sessão você está evoluindo' : 'Selecione o horário'} />
          </SelectTrigger>
          <SelectContent>
            {matching.map(s => (
              <SelectItem key={s.id} value={s.id}>
                🕐 {s.startTime}{s.endTime ? `–${s.endTime}` : ''}
                {s.therapistName ? ` · ${s.therapistName}` : ''}
              </SelectItem>
            ))}
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