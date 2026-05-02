import { describe, it, expect } from 'vitest';
import {
  computeFiscalTotals,
  shouldBillEvolution,
  getFiscalEvolutionAmount,
  type FiscalEvolution,
  type FiscalClinicConfig,
} from './fiscalTotals';

const evo = (
  attendanceStatus: FiscalEvolution['attendanceStatus'],
  confirmedAttendance?: boolean,
): FiscalEvolution => ({ attendanceStatus, confirmedAttendance });

describe('shouldBillEvolution', () => {
  it('always bills presente / reposicao / anteposicao / falta_remunerada / feriado_remunerado / falta_cobrada', () => {
    const statuses: FiscalEvolution['attendanceStatus'][] = [
      'presente', 'reposicao', 'anteposicao', 'falta_remunerada', 'feriado_remunerado', 'falta_cobrada',
    ];
    for (const s of statuses) {
      expect(shouldBillEvolution(evo(s), { absencePaymentType: 'never' })).toBe(true);
    }
  });

  it('never bills feriado_nao_remunerado', () => {
    expect(shouldBillEvolution(evo('feriado_nao_remunerado'))).toBe(false);
  });

  it('falta respects absencePaymentType=always', () => {
    expect(shouldBillEvolution(evo('falta'), { absencePaymentType: 'always' })).toBe(true);
  });

  it('falta respects absencePaymentType=never', () => {
    expect(shouldBillEvolution(evo('falta'), { absencePaymentType: 'never' })).toBe(false);
  });

  it('falta respects confirmed_only', () => {
    expect(shouldBillEvolution(evo('falta', true), { absencePaymentType: 'confirmed_only' })).toBe(true);
    expect(shouldBillEvolution(evo('falta', false), { absencePaymentType: 'confirmed_only' })).toBe(false);
  });

  it('legacy paysOnAbsence=false maps to never', () => {
    expect(shouldBillEvolution(evo('falta'), { paysOnAbsence: false })).toBe(false);
  });
});

describe('getFiscalEvolutionAmount', () => {
  it('returns full perSession when not parcial', () => {
    expect(getFiscalEvolutionAmount(evo('presente'), 50, { absenceChargeMode: 'integral' })).toBe(50);
    expect(getFiscalEvolutionAmount(evo('falta'), 50, { absenceChargeMode: 'integral' })).toBe(50);
  });

  it('returns partial absenceChargeAmount for charged absences when parcial', () => {
    const clinic: FiscalClinicConfig = { absenceChargeMode: 'parcial', absenceChargeAmount: 25 };
    expect(getFiscalEvolutionAmount(evo('falta'), 50, clinic)).toBe(25);
    expect(getFiscalEvolutionAmount(evo('falta_cobrada'), 50, clinic)).toBe(25);
    expect(getFiscalEvolutionAmount(evo('falta_remunerada'), 50, clinic)).toBe(25);
  });

  it('keeps full perSession for actual sessions even in parcial mode', () => {
    const clinic: FiscalClinicConfig = { absenceChargeMode: 'parcial', absenceChargeAmount: 25 };
    expect(getFiscalEvolutionAmount(evo('presente'), 50, clinic)).toBe(50);
    expect(getFiscalEvolutionAmount(evo('reposicao'), 50, clinic)).toBe(50);
  });
});

describe('computeFiscalTotals — Total Faturado vs Total Descontado', () => {
  const integralClinic: FiscalClinicConfig = {
    absencePaymentType: 'always',
    absenceChargeMode: 'integral',
  };
  const parcialClinic: FiscalClinicConfig = {
    absencePaymentType: 'always',
    absenceChargeMode: 'parcial',
    absenceChargeAmount: 25,
  };
  const neverClinic: FiscalClinicConfig = {
    absencePaymentType: 'never',
    absenceChargeMode: 'integral',
  };

  it('only presente sessions: faturado = N*price, descontado = 0', () => {
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('presente'), evo('presente')],
      perSession: 50,
      clinic: integralClinic,
    });
    expect(r.totalFaturado).toBe(150);
    expect(r.totalDescontado).toBe(0);
  });

  it('parcial mode: charged absence bills 25 and discounts the missing 25', () => {
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('falta')],
      perSession: 50,
      clinic: parcialClinic,
    });
    expect(r.sessionsBilled).toBe(75); // 50 + 25
    expect(r.totalFaturado).toBe(75);
    expect(r.partialAbsenceDiscount).toBe(25);
    expect(r.totalDescontado).toBe(25);
    // INVARIANT: faturado + descontado = total esperado se tudo fosse cobrado integralmente
    expect(r.totalFaturado + r.totalDescontado).toBe(2 * 50);
  });

  it('parcial mode with multiple absences accumulates discounts correctly', () => {
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('presente'), evo('falta'), evo('falta_cobrada')],
      perSession: 50,
      clinic: parcialClinic,
    });
    expect(r.totalFaturado).toBe(50 + 50 + 25 + 25); // 150
    expect(r.totalDescontado).toBe(25 + 25); // 50
    expect(r.totalFaturado + r.totalDescontado).toBe(4 * 50);
  });

  it('never mode: absence is fully discounted, not billed', () => {
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('falta')],
      perSession: 50,
      clinic: neverClinic,
    });
    expect(r.totalFaturado).toBe(50);
    expect(r.totalDescontado).toBe(50);
    expect(r.totalFaturado + r.totalDescontado).toBe(2 * 50);
  });

  it('integral mode: confirmed absence bills full price, no discount', () => {
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('falta')],
      perSession: 50,
      clinic: integralClinic,
    });
    expect(r.totalFaturado).toBe(100);
    expect(r.totalDescontado).toBe(0);
  });

  it('feriado_nao_remunerado is excluded from BOTH faturado and descontado', () => {
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('feriado_nao_remunerado')],
      perSession: 50,
      clinic: integralClinic,
    });
    expect(r.totalFaturado).toBe(50);
    expect(r.totalDescontado).toBe(0);
    expect(r.nonBillableAbsenceCount).toBe(0);
  });

  it('feriado_remunerado is billed, not discounted', () => {
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('feriado_remunerado')],
      perSession: 50,
      clinic: integralClinic,
    });
    expect(r.totalFaturado).toBe(100);
    expect(r.totalDescontado).toBe(0);
  });

  it('confirmed_only: unconfirmed absence is fully discounted', () => {
    const clinic: FiscalClinicConfig = {
      absencePaymentType: 'confirmed_only',
      absenceChargeMode: 'integral',
    };
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('falta', false), evo('falta', true)],
      perSession: 50,
      clinic,
    });
    // billed: presente + falta confirmada = 100; descontado: falta nao confirmada = 50
    expect(r.totalFaturado).toBe(100);
    expect(r.totalDescontado).toBe(50);
  });

  it('confirmed_only + parcial: unconfirmed absence = full discount; confirmed absence = partial', () => {
    const clinic: FiscalClinicConfig = {
      absencePaymentType: 'confirmed_only',
      absenceChargeMode: 'parcial',
      absenceChargeAmount: 25,
    };
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('falta', false), evo('falta', true)],
      perSession: 50,
      clinic,
    });
    // billed: 50 (presente) + 25 (falta confirmada parcial) = 75
    // descontado: 50 (falta nao confirmada full) + 25 (diferenca da parcial) = 75
    expect(r.totalFaturado).toBe(75);
    expect(r.totalDescontado).toBe(75);
    expect(r.totalFaturado + r.totalDescontado).toBe(3 * 50);
  });

  it('services are added to faturado but never to descontado', () => {
    const r = computeFiscalTotals({
      evolutions: [evo('presente')],
      services: [{ price: 80 }, { price: 20 }],
      perSession: 50,
      clinic: integralClinic,
    });
    expect(r.servicesBilled).toBe(100);
    expect(r.totalFaturado).toBe(150);
    expect(r.totalDescontado).toBe(0);
  });

  it('exact reported scenario: 1 presente R$50 + 1 falta parcial R$25 → faturado 75, descontado 25', () => {
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('falta')],
      perSession: 50,
      clinic: parcialClinic,
    });
    expect(r.totalFaturado).toBe(75);
    expect(r.totalDescontado).toBe(25);
  });

  it('parcial mode with absenceChargeAmount=0 behaves like never (full discount)', () => {
    const clinic: FiscalClinicConfig = {
      absencePaymentType: 'always',
      absenceChargeMode: 'parcial',
      absenceChargeAmount: 0,
    };
    const r = computeFiscalTotals({
      evolutions: [evo('presente'), evo('falta')],
      perSession: 50,
      clinic,
    });
    expect(r.totalFaturado).toBe(50);
    expect(r.totalDescontado).toBe(50);
  });

  it('empty evolutions yields zeros', () => {
    const r = computeFiscalTotals({ evolutions: [], perSession: 50, clinic: integralClinic });
    expect(r.totalFaturado).toBe(0);
    expect(r.totalDescontado).toBe(0);
  });

  it('INVARIANT across all scenarios: faturado_sessions + descontado === sum(perSession) for non-holidays', () => {
    const cases: Array<{ evos: FiscalEvolution[]; clinic: FiscalClinicConfig }> = [
      { evos: [evo('presente'), evo('falta'), evo('reposicao')], clinic: integralClinic },
      { evos: [evo('presente'), evo('falta'), evo('reposicao')], clinic: parcialClinic },
      { evos: [evo('presente'), evo('falta'), evo('reposicao')], clinic: neverClinic },
      { evos: [evo('falta_cobrada'), evo('falta_remunerada')], clinic: parcialClinic },
    ];
    for (const c of cases) {
      const r = computeFiscalTotals({ evolutions: c.evos, perSession: 50, clinic: c.clinic });
      const nonHoliday = c.evos.filter(e => e.attendanceStatus !== 'feriado_nao_remunerado').length;
      expect(r.sessionsBilled + r.totalDescontado).toBe(nonHoliday * 50);
    }
  });
});