/**
 * Pure helpers to compute fiscal totals (Faturado / Descontado) for a patient
 * over a given period. Mirrors the logic used in PatientDetail.buildFiscalReceiptOpts
 * so it can be unit-tested without mounting the page.
 */

export type AttendanceStatus =
  | 'presente'
  | 'reposicao'
  | 'anteposicao'
  | 'falta'
  | 'falta_cobrada'
  | 'falta_remunerada'
  | 'feriado_remunerado'
  | 'feriado_nao_remunerado';

export interface FiscalEvolution {
  attendanceStatus: AttendanceStatus;
  confirmedAttendance?: boolean | null;
  /** Valor cheio da sessão nesta data. Quando informado, prevalece sobre perSession. */
  amount?: number | null;
}

export interface FiscalClinicConfig {
  absencePaymentType?: 'always' | 'never' | 'confirmed_only' | null;
  paysOnAbsence?: boolean | null;
  absenceChargeMode?: 'integral' | 'parcial' | null;
  absenceChargeAmount?: number | null;
}

export interface FiscalServiceItem {
  price?: number | null;
}

export interface FiscalTotalsInput {
  evolutions: FiscalEvolution[];
  services?: FiscalServiceItem[];
  perSession: number;
  clinic?: FiscalClinicConfig | null;
}

export interface FiscalTotalsResult {
  totalFaturado: number;
  totalDescontado: number;
  sessionsBilled: number;
  servicesBilled: number;
  billableCount: number;
  nonBillableAbsenceCount: number;
  partialAbsenceDiscount: number;
}

export function shouldBillEvolution(
  e: FiscalEvolution,
  clinic?: FiscalClinicConfig | null,
): boolean {
  if (
    ['presente', 'reposicao', 'anteposicao', 'falta_remunerada', 'feriado_remunerado', 'falta_cobrada'].includes(
      e.attendanceStatus,
    )
  )
    return true;
  if (e.attendanceStatus !== 'falta') return false;
  const absenceType =
    clinic?.absencePaymentType || (clinic?.paysOnAbsence === false ? 'never' : 'always');
  if (absenceType === 'never') return false;
  if (absenceType === 'confirmed_only') return !!e.confirmedAttendance;
  return true;
}

export function getFiscalEvolutionAmount(
  e: FiscalEvolution,
  perSession: number,
  clinic?: FiscalClinicConfig | null,
): number {
  const sessionBase = Number(e.amount ?? perSession ?? 0);
  const isParcial = clinic?.absenceChargeMode === 'parcial';
  const partialValue = isParcial ? Number(clinic?.absenceChargeAmount ?? 0) : 0;
  const isChargedAbsence =
    e.attendanceStatus === 'falta' ||
    e.attendanceStatus === 'falta_cobrada' ||
    e.attendanceStatus === 'falta_remunerada';
  if (isParcial && isChargedAbsence) return partialValue;
  return sessionBase;
}

export function computeFiscalTotals(input: FiscalTotalsInput): FiscalTotalsResult {
  const { evolutions, services = [], perSession, clinic } = input;

  const billable = evolutions.filter(e => shouldBillEvolution(e, clinic));
  const sessionsBilled = billable.reduce(
    (sum, e) => sum + getFiscalEvolutionAmount(e, perSession, clinic),
    0,
  );
  const servicesBilled = services.reduce((sum, s) => sum + (s.price || 0), 0);

  // Holidays without pay are NOT counted as discount.
  const nonBillableAbsences = evolutions.filter(
    e => !shouldBillEvolution(e, clinic) && e.attendanceStatus !== 'feriado_nao_remunerado',
  );

  const isParcial = clinic?.absenceChargeMode === 'parcial';
  const partialAbsenceDiscount = billable.reduce((sum, e) => {
    const isChargedAbsence =
      e.attendanceStatus === 'falta' ||
      e.attendanceStatus === 'falta_cobrada' ||
      e.attendanceStatus === 'falta_remunerada';
    if (!isParcial || !isChargedAbsence) return sum;
    return sum + Math.max(0, perSession - getFiscalEvolutionAmount(e, perSession, clinic));
  }, 0);

  const totalDescontado =
    nonBillableAbsences.reduce((sum, e) => sum + Number(e.amount ?? perSession ?? 0), 0) + partialAbsenceDiscount;

  return {
    totalFaturado: sessionsBilled + servicesBilled,
    totalDescontado,
    sessionsBilled,
    servicesBilled,
    billableCount: billable.length,
    nonBillableAbsenceCount: nonBillableAbsences.length,
    partialAbsenceDiscount,
  };
}