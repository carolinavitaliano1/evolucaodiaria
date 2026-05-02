import { describe, it, expect } from 'vitest';
import {
  calculatePatientMonthlyRevenue,
  partialAbsenceAdjustment,
  type EvolutionLike,
} from './financialHelpers';

const mkEvo = (
  attendanceStatus: string,
  date = '2026-05-05',
  extra: Partial<EvolutionLike> = {},
): EvolutionLike => ({
  id: Math.random().toString(36).slice(2),
  patientId: 'p1',
  date,
  attendanceStatus: attendanceStatus as any,
  ...extra,
});

const patient = {
  id: 'p1',
  name: 'Paciente',
  paymentValue: 50,
  paymentType: 'sessao' as const,
  weekdays: ['Terça'],
};

const parcialClinic = {
  id: 'c1',
  absencePaymentType: 'always' as const,
  absenceChargeMode: 'parcial' as const,
  absenceChargeAmount: 25,
};

const integralClinic = {
  id: 'c1',
  absencePaymentType: 'always' as const,
  absenceChargeMode: 'integral' as const,
};

describe('partialAbsenceAdjustment — invariante de cobrança parcial', () => {
  it('uma falta cobrada parcial: sessão R$50, falta R$25', () => {
    const result = partialAbsenceAdjustment(
      [mkEvo('presente'), mkEvo('falta')],
      50,
      parcialClinic,
    );
    expect(result.sessionsTotal).toBe(50);
    expect(result.absencesTotal).toBe(25);
    expect(result.total).toBe(75);
    expect(result.chargedAbsences).toBe(1);
  });

  it('integral: falta cobrada vale o mesmo que sessão', () => {
    const result = partialAbsenceAdjustment(
      [mkEvo('presente'), mkEvo('falta')],
      50,
      integralClinic,
    );
    expect(result.total).toBe(100);
  });
});

describe('calculatePatientMonthlyRevenue — modo parcial em TODAS as clínicas', () => {
  it('1 presente + 1 falta cobrada parcial → total=75 (50+25), loss=25 (diferença)', () => {
    const breakdown = calculatePatientMonthlyRevenue({
      patient,
      clinic: parcialClinic,
      evolutions: [mkEvo('presente'), mkEvo('falta')],
      month: 5,
      year: 2026,
      packages: [],
      groupBillingMap: {},
      memberPaymentMap: {},
    });
    expect(breakdown.individualRevenue).toBe(50);
    expect(breakdown.chargedAbsenceRevenue).toBe(25);
    expect(breakdown.total).toBe(75);
    // Invariante: total + loss = se tudo fosse cobrado integralmente
    expect(breakdown.loss).toBe(25);
    expect(breakdown.total + breakdown.loss).toBe(2 * 50);
  });

  it('múltiplas faltas parciais acumulam loss corretamente', () => {
    const breakdown = calculatePatientMonthlyRevenue({
      patient,
      clinic: parcialClinic,
      evolutions: [
        mkEvo('presente'),
        mkEvo('presente'),
        mkEvo('falta'),
        mkEvo('falta'),
      ],
      month: 5,
      year: 2026,
      packages: [],
      groupBillingMap: {},
      memberPaymentMap: {},
    });
    expect(breakdown.total).toBe(50 + 50 + 25 + 25); // 150
    expect(breakdown.loss).toBe(25 + 25); // 50
    expect(breakdown.total + breakdown.loss).toBe(4 * 50);
  });

  it('falta NÃO cobrada (clínica never) → vai 100% para loss, sem afetar receita', () => {
    const neverClinic = { id: 'c1', absencePaymentType: 'never' as const, absenceChargeMode: 'integral' as const };
    const breakdown = calculatePatientMonthlyRevenue({
      patient,
      clinic: neverClinic,
      evolutions: [mkEvo('presente'), mkEvo('falta')],
      month: 5,
      year: 2026,
      packages: [],
      groupBillingMap: {},
      memberPaymentMap: {},
    });
    expect(breakdown.total).toBe(50);
    expect(breakdown.loss).toBe(50);
    expect(breakdown.total + breakdown.loss).toBe(2 * 50);
  });

  it('integral (cenário antigo): falta cobrada não gera loss', () => {
    const breakdown = calculatePatientMonthlyRevenue({
      patient,
      clinic: integralClinic,
      evolutions: [mkEvo('presente'), mkEvo('falta')],
      month: 5,
      year: 2026,
      packages: [],
      groupBillingMap: {},
      memberPaymentMap: {},
    });
    expect(breakdown.total).toBe(100);
    expect(breakdown.loss).toBe(0);
  });

  it('parcial com absenceChargeAmount=0 = falta cobrada vale 0 mas conta como loss integral', () => {
    const zeroParcial = { ...parcialClinic, absenceChargeAmount: 0 };
    const breakdown = calculatePatientMonthlyRevenue({
      patient,
      clinic: zeroParcial,
      evolutions: [mkEvo('presente'), mkEvo('falta')],
      month: 5,
      year: 2026,
      packages: [],
      groupBillingMap: {},
      memberPaymentMap: {},
    });
    expect(breakdown.total).toBe(50);
    expect(breakdown.loss).toBe(50);
  });
});