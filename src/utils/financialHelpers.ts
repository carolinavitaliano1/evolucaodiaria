/**
 * ============================================================================
 *  financialHelpers.ts — Fonte ÚNICA da verdade para cálculos financeiros.
 * ============================================================================
 *
 *  Toda tela, PDF, dashboard ou relatório que precise calcular faturamento,
 *  perdas, valor por sessão ou comissão de equipe DEVE usar exclusivamente
 *  estas funções. Não duplicar lógica financeira fora deste arquivo.
 *
 *  Padronização de status (sempre snake_case e nunca "falta_cobrada"):
 *    - presente            → conta como sessão e fatura
 *    - reposicao           → conta como sessão e fatura
 *    - falta_remunerada    → não conta como sessão, mas FATURA (e gera comissão)
 *    - feriado_remunerado  → não conta como sessão, mas FATURA (e gera comissão)
 *    - falta               → dedutível conforme `absencePaymentType` da clínica
 *    - feriado_nao_remunerado → ignorado em tudo
 *
 *  Regras essenciais:
 *    - Mensalista (paymentType='fixo') sem dias da semana definidos NÃO infla
 *      o valor por sessão; cai num modo seguro.
 *    - `absencePaymentType` ('always' | 'never' | 'confirmed_only') é
 *      respeitado em TODAS as telas (não só em ClinicFinancial).
 *    - Comissões de equipe incluem faltas remuneradas e feriados remunerados.
 * ============================================================================
 */

import { getDynamicSessionValue, calculateMensalRevenueWithDeductions } from './dateHelpers';
import { getGroupSessionValue, type GroupBillingMap, type GroupMemberPaymentMap } from './groupFinancial';

// ============================================================================
//  Tipos compartilhados
// ============================================================================

export type AttendanceStatus =
  | 'presente'
  | 'falta'
  | 'falta_remunerada'
  | 'reposicao'
  | 'feriado_remunerado'
  | 'feriado_nao_remunerado';

export type AbsencePaymentType = 'always' | 'never' | 'confirmed_only';

export interface PatientLike {
  id: string;
  paymentType?: 'sessao' | 'fixo' | string | null;
  paymentValue?: number | null;
  weekdays?: string[] | null;
  scheduleByDay?: Record<string, any> | null;
  packageId?: string | null;
}

export interface ClinicLike {
  id?: string;
  absencePaymentType?: AbsencePaymentType | string | null;
  paysOnAbsence?: boolean | null;
  /**
   * Modelo de remuneração que a clínica paga AO TERAPEUTA.
   * - 'fixo_mensal'  → salário mensal fixo (independe de sessões)
   * - 'fixo_diario'  → valor fixo por dia trabalhado
   * - 'sessao'       → valor por sessão (multiplica nº de sessões billable)
   * - 'variado'      → calcula por paciente (soma calculatePatientMonthlyRevenue)
   * Aceita também legados 'fixo' e 'mensal' como sinônimos de 'fixo_mensal'.
   */
  paymentType?: string | null;
  paymentAmount?: number | null;
}

/** True se o tipo de pagamento da clínica é "salário fixo mensal". */
export const isClinicFixedMonthly = (paymentType?: string | null): boolean =>
  paymentType === 'fixo_mensal' || paymentType === 'fixo' || paymentType === 'mensal';

/** True se o tipo de pagamento da clínica é "fixo por dia trabalhado". */
export const isClinicFixedDaily = (paymentType?: string | null): boolean =>
  paymentType === 'fixo_diario' || paymentType === 'fixo_dia';

export interface PackageLike {
  id: string;
  price: number;
  packageType?: 'mensal' | 'por_sessao' | 'personalizado' | string | null;
  sessionLimit?: number | null;
}

export interface EvolutionLike {
  id?: string;
  patientId: string;
  groupId?: string | null;
  date: string;
  attendanceStatus: string;
  confirmedAttendance?: boolean | null;
  userId?: string | null;
}

// ============================================================================
//  Constantes de status (única fonte da verdade)
// ============================================================================

/** Status que faturam (entram na receita do paciente). */
export const BILLABLE_STATUSES: ReadonlyArray<string> = [
  'presente',
  'reposicao',
  'falta_remunerada',
  'feriado_remunerado',
];

/** Status que contam como "sessão realizada" (produtividade). */
export const SESSION_STATUSES: ReadonlyArray<string> = ['presente', 'reposicao'];

export const isBillableStatus = (s: string): boolean => BILLABLE_STATUSES.includes(s);
export const isSessionStatus = (s: string): boolean => SESSION_STATUSES.includes(s);

// ============================================================================
//  Resolução do "absencePaymentType" da clínica (com fallback legado)
// ============================================================================

export function resolveAbsencePaymentType(clinic?: ClinicLike | null): AbsencePaymentType {
  if (!clinic) return 'always';
  if (clinic.absencePaymentType === 'never' || clinic.absencePaymentType === 'always' || clinic.absencePaymentType === 'confirmed_only') {
    return clinic.absencePaymentType;
  }
  return clinic.paysOnAbsence === false ? 'never' : 'always';
}

/**
 * Decide se uma evolução de status `falta` deve ser cobrada do paciente,
 * conforme a configuração da clínica.
 */
export function shouldChargeAbsence(
  evolution: Pick<EvolutionLike, 'attendanceStatus' | 'confirmedAttendance'>,
  clinic?: ClinicLike | null,
): boolean {
  if (evolution.attendanceStatus !== 'falta') return false;
  const type = resolveAbsencePaymentType(clinic);
  if (type === 'always') return true;
  if (type === 'never') return false;
  return !!evolution.confirmedAttendance; // confirmed_only
}

// ============================================================================
//  Valor por sessão (individual). Trata pacotes e mensalistas com segurança.
// ============================================================================

/**
 * Retorna a lista de dias da semana configurados para o paciente
 * (combinando weekdays e scheduleByDay).
 */
export function getPatientWeekdays(patient: PatientLike | null | undefined): string[] {
  if (!patient) return [];
  if (patient.weekdays?.length) return patient.weekdays;
  if (patient.scheduleByDay && typeof patient.scheduleByDay === 'object') {
    return Object.keys(patient.scheduleByDay);
  }
  return [];
}

/**
 * Calcula o valor "por sessão" considerando o tipo de pacote.
 * NÃO trata mensalistas dinâmicos — para isso use `getMensalDynamic`.
 */
export function getPackageEffectiveSessionValue(
  patient: PatientLike,
  pkg?: PackageLike | null,
): number {
  const base = patient.paymentValue ?? 0;
  if (!base) return 0;
  if (pkg?.packageType === 'personalizado' && (pkg.sessionLimit ?? 0) > 0) {
    return base / (pkg.sessionLimit as number);
  }
  return base;
}

export interface MensalDynamic {
  /** Valor por sessão para o mês corrente (mensal ÷ ocorrências). */
  perSession: number;
  /** Quantidade de ocorrências do(s) dia(s) da semana no mês. */
  occurrences: number;
  /** True se foi possível calcular dinamicamente; false → fallback seguro. */
  isDynamic: boolean;
}

/**
 * Calcula o valor dinâmico por sessão para mensalistas.
 *
 * 🔒 TRAVA DE SEGURANÇA: se o paciente não tem dias da semana definidos,
 * NÃO retorna `monthlyValue` como per-session (isso multiplicava a
 * mensalidade por sessão registrada, inflando o faturamento absurdamente).
 * Em vez disso, marca `isDynamic=false` para o chamador decidir.
 */
export function getMensalDynamic(
  patient: PatientLike,
  month: number,
  year: number,
): MensalDynamic {
  const monthly = patient.paymentValue ?? 0;
  const weekdays = getPatientWeekdays(patient);
  const dyn = getDynamicSessionValue(monthly, weekdays, month, year);

  if (!weekdays.length || dyn.occurrences === 0) {
    return { perSession: 0, occurrences: 0, isDynamic: false };
  }

  return {
    perSession: dyn.perSession,
    occurrences: dyn.occurrences,
    isDynamic: true,
  };
}

/**
 * Valor "por sessão" universal para um paciente, independente do tipo:
 * - Pacote personalizado: preço ÷ sessionLimit
 * - Mensalista: usa cálculo dinâmico (perSession do mês corrente)
 * - Por sessão: o próprio paymentValue
 *
 * Para mensalistas sem dias definidos retorna 0 (trava de segurança).
 */
export function getIndividualPerSessionValue(
  patient: PatientLike,
  month: number,
  year: number,
  pkg?: PackageLike | null,
): number {
  // 🔁 Fallback: paciente sem valor próprio mas com pacote vinculado → usa preço do pacote.
  const baseValue = patient.paymentValue && patient.paymentValue > 0
    ? patient.paymentValue
    : (pkg?.price ?? 0);
  if (!baseValue) return 0;

  if (pkg?.packageType === 'personalizado' && (pkg.sessionLimit ?? 0) > 0) {
    return baseValue / (pkg.sessionLimit as number);
  }

  // Mensalistas (paciente com paymentType 'fixo' OU pacote 'mensal' vinculado)
  const isMensal = patient.paymentType === 'fixo' || pkg?.packageType === 'mensal';
  if (isMensal) {
    const dyn = getMensalDynamicWithBase(patient, baseValue, month, year);
    return dyn.isDynamic ? dyn.perSession : 0;
  }

  return baseValue;
}

/** Variante de getMensalDynamic que aceita um valor mensal explícito (ex.: do pacote). */
function getMensalDynamicWithBase(
  patient: PatientLike,
  monthly: number,
  month: number,
  year: number,
): MensalDynamic {
  const weekdays = getPatientWeekdays(patient);
  const dyn = getDynamicSessionValue(monthly, weekdays, month, year);
  if (!weekdays.length || dyn.occurrences === 0) {
    return { perSession: 0, occurrences: 0, isDynamic: false };
  }
  return { perSession: dyn.perSession, occurrences: dyn.occurrences, isDynamic: true };
}

// ============================================================================
//  Faturamento por paciente (a "fonte da verdade" de receita)
// ============================================================================

export interface PatientRevenueContext {
  patient: PatientLike;
  clinic?: ClinicLike | null;
  evolutions: EvolutionLike[]; // Já filtradas pelo paciente E pelo mês/ano
  month: number;               // 0-indexed
  year: number;
  packages?: PackageLike[];
  groupBillingMap?: GroupBillingMap;
  memberPaymentMap?: GroupMemberPaymentMap;
}

export interface PatientRevenueBreakdown {
  /** Receita gerada por sessões individuais billable. */
  individualRevenue: number;
  /** Receita gerada por sessões em grupo. */
  groupRevenue: number;
  /** Receita gerada por faltas cobráveis (regra absencePaymentType). */
  chargedAbsenceRevenue: number;
  /** Receita total = soma dos três acima. */
  total: number;
  /** Perda = faltas NÃO cobradas × valor por sessão. */
  loss: number;
  /** Detalhes para debugging / extratos. */
  details: {
    billableIndividual: number;
    billableGroup: number;
    chargedAbsences: number;
    uncoveredAbsences: number;
    perSessionValue: number;
  };
}

/**
 * Núcleo: calcula receita e perda de UM paciente em UM mês.
 *
 * Esta é a função usada por todas as telas (Financial, ClinicFinancial,
 * Reports, Clinics, PatientDetail, PaymentReminders, PDFs).
 */
export function calculatePatientMonthlyRevenue(ctx: PatientRevenueContext): PatientRevenueBreakdown {
  const { patient, clinic, evolutions, month, year, packages = [], groupBillingMap = {}, memberPaymentMap = {} } = ctx;

  // 🔒 REGRA: se a clínica paga salário fixo (mensal ou diário) ao terapeuta,
  // a receita NÃO vem do paciente — o terapeuta recebe da clínica.
  // Logo, a receita por paciente é 0 nesses modelos.
  if (clinic && (isClinicFixedMonthly(clinic.paymentType) || isClinicFixedDaily(clinic.paymentType))) {
    return {
      individualRevenue: 0,
      groupRevenue: 0,
      chargedAbsenceRevenue: 0,
      total: 0,
      loss: 0,
      details: {
        billableIndividual: 0,
        billableGroup: 0,
        chargedAbsences: 0,
        uncoveredAbsences: 0,
        perSessionValue: 0,
      },
    };
  }

  const pkg = patient.packageId ? packages.find(p => p.id === patient.packageId) ?? null : null;

  // Helper: valor de uma sessão de grupo para este paciente
  const groupValue = (groupId?: string | null) =>
    getGroupSessionValue({
      groupId: groupId ?? undefined,
      patientId: patient.id,
      groupBillingMap,
      memberPaymentMap,
      packages: packages.map(p => ({ id: p.id, price: p.price, sessionLimit: p.sessionLimit })),
    });

  const perSession = getIndividualPerSessionValue(patient, month, year, pkg);
  // Valor "base" do paciente: usa paymentValue OU, se vazio, o preço do pacote.
  const baseValue = (patient.paymentValue && patient.paymentValue > 0)
    ? patient.paymentValue
    : (pkg?.price ?? 0);
  const isMensal = patient.paymentType === 'fixo' || pkg?.packageType === 'mensal';

  // Separar evoluções
  const billable = evolutions.filter(e => isBillableStatus(e.attendanceStatus));
  const absences = evolutions.filter(e => e.attendanceStatus === 'falta');

  const billableGroup = billable.filter(e => e.groupId);
  const billableIndividual = billable.filter(e => !e.groupId);

  const groupRevenue = billableGroup.reduce((sum, e) => sum + groupValue(e.groupId), 0);

  // Para mensalistas: receita individual respeita o limite mensal
  // (não soma 5 sessões × perSession se a configuração foi 4 ocorrências).
  // Como `perSession = monthly/occurrences`, o resultado bate quando
  // sessions ≤ occurrences. Caso registre mais sessões que ocorrências,
  // limitamos ao monthlyValue para evitar inflar.
  let individualRevenue = 0;
  if (billableIndividual.length > 0 && baseValue) {
    if (isMensal) {
      const dyn = getMensalDynamicWithBase(patient, baseValue, month, year);
      if (dyn.isDynamic) {
        const raw = billableIndividual.length * dyn.perSession;
        // Trava: nunca ultrapassa o valor mensal contratado
        individualRevenue = Math.min(raw, baseValue);
      } else {
        // Mensalista sem dias: usa o valor mensal "cheio" UMA vez (não por sessão)
        individualRevenue = baseValue;
      }
    } else {
      individualRevenue = billableIndividual.length * (perSession || baseValue);
    }
  }

  // Faltas cobráveis (respeitando absencePaymentType da clínica)
  const chargedAbsences = absences.filter(e => shouldChargeAbsence(e, clinic));
  const uncoveredAbsences = absences.length - chargedAbsences.length;

  const chargedAbsenceRevenue = chargedAbsences.reduce((sum, e) => {
    if (e.groupId) return sum + groupValue(e.groupId);
    return sum + (perSession || baseValue || 0);
  }, 0);

  // Perda: faltas que NÃO foram cobradas
  const loss = uncoveredAbsences * (perSession || baseValue || 0);

  const total = individualRevenue + groupRevenue + chargedAbsenceRevenue;

  return {
    individualRevenue,
    groupRevenue,
    chargedAbsenceRevenue,
    total,
    loss,
    details: {
      billableIndividual: billableIndividual.length,
      billableGroup: billableGroup.length,
      chargedAbsences: chargedAbsences.length,
      uncoveredAbsences,
      perSessionValue: perSession,
    },
  };
}

// ============================================================================
//  Comissão da equipe (remuneração por profissional)
// ============================================================================

export interface MemberRemunerationContext {
  remunerationType?: string | null;
  remunerationValue?: number | null;
  evolutions: EvolutionLike[]; // Evoluções DESTE membro no período
}

/**
 * Calcula a comissão de um profissional.
 *
 * IMPORTANTE: faltas remuneradas (`falta_remunerada`) e feriados remunerados
 * (`feriado_remunerado`) CONTAM para a comissão por sessão e para os "dias
 * trabalhados" no modelo diário, pois o profissional foi efetivamente
 * remunerado por aquele atendimento.
 */
export function calculateMemberRemuneration(ctx: MemberRemunerationContext): number {
  const { remunerationType, remunerationValue, evolutions } = ctx;
  if (!remunerationValue || !remunerationType || remunerationType === 'definir_depois') return 0;

  if (remunerationType === 'fixo_mensal') {
    return remunerationValue;
  }

  // Status que geram comissão (sessão efetivamente remunerada)
  const paidSessionEvos = evolutions.filter(e => isBillableStatus(e.attendanceStatus));

  if (remunerationType === 'fixo_dia') {
    const days = new Set(paidSessionEvos.map(e => e.date));
    return days.size * remunerationValue;
  }

  if (remunerationType === 'por_sessao') {
    return paidSessionEvos.length * remunerationValue;
  }

  return 0;
}

// ============================================================================
//  Múltiplos planos de remuneração por terapeuta (member_remuneration_plans)
// ============================================================================

export type RemunerationPlanType = 'por_sessao' | 'fixo_mensal' | 'fixo_dia' | 'pacote';

export interface RemunerationPlan {
  id: string;
  member_id?: string;
  name: string;
  remuneration_type: RemunerationPlanType | string;
  remuneration_value: number;
  is_default?: boolean;
  /** Quando o plano é do tipo 'pacote', vincula a um clinic_packages para
   *  derivar o valor por sessão (preço / sessões previstas). */
  package_id?: string | null;
}

export interface PlanBreakdownEntry {
  planId: string;
  planName: string;
  type: RemunerationPlanType | string;
  value: number;
  sessionsCount: number;
  patientsCount: number;
  subtotal: number;
}

export interface MemberRemunerationByPlansContext {
  /** Planos cadastrados para este membro. */
  plans: RemunerationPlan[];
  /** Mapa patient_id → plan_id escolhido no vínculo (assignment). */
  assignmentPlanMap: Record<string, string | null | undefined>;
  /** Evoluções DESTE membro no período (mês). */
  evolutions: EvolutionLike[];
  /** Fallback (legacy): tipo/valor diretos do `organization_members`, usados se não houver planos. */
  legacyType?: string | null;
  legacyValue?: number | null;
}

export interface MemberRemunerationBreakdown {
  total: number;
  breakdown: PlanBreakdownEntry[];
  /** True quando caiu no caminho legacy (membro sem planos cadastrados). */
  usedLegacy: boolean;
}

/**
 * Calcula a remuneração de um membro respeitando MÚLTIPLOS planos:
 * cada paciente atendido pode usar um plano diferente. Retorna o total e
 * um detalhamento por plano (para exibição no dashboard/relatório).
 *
 * Regras por tipo:
 *   • por_sessao  → nº de evoluções billable (do paciente nesse plano) × valor
 *   • fixo_dia    → nº de DIAS únicos com sessões billable (do plano) × valor
 *   • fixo_mensal → valor cobrado UMA vez por plano se houve ao menos uma sessão
 *                   billable no mês (independe de quantos pacientes/sessões).
 */
export function calculateMemberRemunerationByPlans(
  ctx: MemberRemunerationByPlansContext,
): MemberRemunerationBreakdown {
  const { plans, assignmentPlanMap, evolutions, legacyType, legacyValue } = ctx;

  // Fallback legacy: nenhum plano cadastrado → usa função antiga.
  if (!plans || plans.length === 0) {
    const total = calculateMemberRemuneration({
      remunerationType: legacyType,
      remunerationValue: legacyValue ?? null,
      evolutions,
    });
    return { total, breakdown: [], usedLegacy: true };
  }

  const defaultPlan = plans.find(p => p.is_default) || plans[0];

  // Agrupa evoluções por planId
  const evosByPlan: Record<string, EvolutionLike[]> = {};
  const patientsByPlan: Record<string, Set<string>> = {};

  for (const evo of evolutions) {
    if (!isBillableStatus(evo.attendanceStatus)) continue;
    const chosen = assignmentPlanMap[evo.patientId] || defaultPlan?.id;
    if (!chosen) continue;
    // valida que o plano existe (caso o assignment aponte para um plano deletado)
    const planExists = plans.some(p => p.id === chosen);
    const planId = planExists ? chosen : defaultPlan?.id;
    if (!planId) continue;
    if (!evosByPlan[planId]) evosByPlan[planId] = [];
    evosByPlan[planId].push(evo);
    if (!patientsByPlan[planId]) patientsByPlan[planId] = new Set();
    patientsByPlan[planId].add(evo.patientId);
  }

  const breakdown: PlanBreakdownEntry[] = [];
  let total = 0;

  for (const plan of plans) {
    const evos = evosByPlan[plan.id] || [];
    const sessionsCount = evos.length;
    const patientsCount = patientsByPlan[plan.id]?.size || 0;
    const value = Number(plan.remuneration_value) || 0;
    let subtotal = 0;

    if (sessionsCount === 0 && plan.remuneration_type !== 'fixo_mensal') {
      // sem sessões nesse plano e não é mensalista → não aparece no breakdown
      continue;
    }

    if (plan.remuneration_type === 'fixo_mensal') {
      // Cobra valor fixo se houve qualquer atividade OU se é o plano default
      // de algum paciente vinculado (mesmo sem sessões no mês).
      const hasActivityOrAssigned =
        sessionsCount > 0 ||
        Object.values(assignmentPlanMap).includes(plan.id) ||
        (plan.is_default && Object.values(assignmentPlanMap).some(v => !v));
      subtotal = hasActivityOrAssigned ? value : 0;
      if (subtotal === 0) continue;
    } else if (plan.remuneration_type === 'fixo_dia') {
      const days = new Set(evos.map(e => e.date));
      subtotal = days.size * value;
    } else if (plan.remuneration_type === 'por_sessao') {
      subtotal = sessionsCount * value;
    } else if (plan.remuneration_type === 'pacote') {
      // Pacote: cobra valor fixo por paciente que teve ao menos 1 sessão billable no mês
      subtotal = patientsCount * value;
    }

    breakdown.push({
      planId: plan.id,
      planName: plan.name,
      type: plan.remuneration_type,
      value,
      sessionsCount,
      patientsCount,
      subtotal,
    });
    total += subtotal;
  }

  return { total, breakdown, usedLegacy: false };
}

// ============================================================================
//  Faturamento da CLÍNICA (respeita modelo de pagamento da clínica ao terapeuta)
// ============================================================================

export interface ClinicRevenueContext {
  clinic: ClinicLike;
  patients: PatientLike[];                  // pacientes desta clínica
  evolutions: EvolutionLike[];              // evoluções do mês (já filtradas pelo mês/ano)
  month: number;                            // 0-indexed
  year: number;
  packages?: PackageLike[];
  groupBillingMap?: GroupBillingMap;
  memberPaymentMap?: GroupMemberPaymentMap;
}

export interface ClinicRevenueBreakdown {
  /** Faturamento total da clínica no mês. */
  total: number;
  /** Modelo aplicado para o cálculo (para exibição na UI). */
  model: 'fixo_mensal' | 'fixo_diario' | 'variado';
  /** Dias únicos trabalhados (relevante para fixo_diario). */
  workDays: number;
  /** Sessões billable contadas (informativo, não afeta total em modelos fixos). */
  sessionsCount: number;
  /** Detalhe por paciente — vazio em modelos fixos (faturamento é global). */
  perPatient: Array<{ patientId: string; revenue: number }>;
}

/**
 * Calcula o faturamento mensal de UMA clínica conforme seu modelo de pagamento.
 *
 * 🔒 REGRA DE OURO: clínicas com `paymentType = 'fixo_mensal'` SEMPRE retornam
 * `paymentAmount` (salário fixo), independentemente do número de sessões.
 * Clínicas `fixo_diario` retornam `dias_trabalhados × paymentAmount`.
 * Demais modelos somam `calculatePatientMonthlyRevenue` por paciente.
 */
export function calculateClinicMonthlyRevenue(ctx: ClinicRevenueContext): ClinicRevenueBreakdown {
  const { clinic, patients, evolutions, month, year, packages = [], groupBillingMap = {}, memberPaymentMap = {} } = ctx;

  const baseValue = clinic.paymentAmount ?? 0;

  // Sessões billable (presente/reposição) desta clínica no mês — para informação
  const billableEvos = evolutions.filter(e => isSessionStatus(e.attendanceStatus));
  const workDays = new Set(billableEvos.map(e => e.date)).size;

  // Modelo: salário fixo mensal
  if (isClinicFixedMonthly(clinic.paymentType)) {
    return {
      total: baseValue,
      model: 'fixo_mensal',
      workDays,
      sessionsCount: billableEvos.length,
      perPatient: [],
    };
  }

  // Modelo: fixo por dia trabalhado
  if (isClinicFixedDaily(clinic.paymentType)) {
    return {
      total: workDays * baseValue,
      model: 'fixo_diario',
      workDays,
      sessionsCount: billableEvos.length,
      perPatient: [],
    };
  }

  // Modelo: variado (por paciente / sessão)
  const perPatient: Array<{ patientId: string; revenue: number }> = [];
  let total = 0;
  for (const patient of patients) {
    const patientEvos = evolutions.filter(e => e.patientId === patient.id);
    const breakdown = calculatePatientMonthlyRevenue({
      patient, clinic, evolutions: patientEvos, month, year,
      packages, groupBillingMap, memberPaymentMap,
    });
    total += breakdown.total;
    perPatient.push({ patientId: patient.id, revenue: breakdown.total });
  }

  return {
    total,
    model: 'variado',
    workDays,
    sessionsCount: billableEvos.length,
    perPatient,
  };
}

// ============================================================================
//  Rateio proporcional do salário fixo (informativo, por paciente)
// ============================================================================

export interface ProportionalShareContext {
  patient: PatientLike;
  clinic?: ClinicLike | null;
  /** Todos os pacientes da clínica (não arquivados). */
  allClinicPatients: PatientLike[];
  /** Todas as evoluções da clínica no mês selecionado (todos os pacientes). */
  allClinicEvolutions: EvolutionLike[];
  month: number;
  year: number;
}

export interface ProportionalShareResult {
  /** Valor proporcional do salário que este paciente "representa". */
  share: number;
  /** Salário total da clínica no mês (mensal ou diário × dias trabalhados). */
  clinicSalary: number;
  /** Sessões billable deste paciente no mês. */
  patientSessions: number;
  /** Total de sessões billable da clínica no mês. */
  totalSessions: number;
  /** True somente se a clínica é fixo_mensal/fixo_diario. */
  isProportional: boolean;
}

/**
 * Calcula o "rateio proporcional" do salário fixo da clínica para um paciente.
 *
 * Uso: APENAS informativo. NÃO somar ao faturamento real — o salário já é
 * contabilizado uma única vez no nível da clínica via
 * `calculateClinicMonthlyRevenue`.
 *
 * Fórmula: share = (sessões_paciente / total_sessões_clínica) × salário_fixo
 */
export function calculatePatientProportionalShare(
  ctx: ProportionalShareContext,
): ProportionalShareResult {
  const { patient, clinic, allClinicPatients, allClinicEvolutions } = ctx;
  const empty: ProportionalShareResult = {
    share: 0,
    clinicSalary: 0,
    patientSessions: 0,
    totalSessions: 0,
    isProportional: false,
  };

  if (!clinic) return empty;
  const isMonthly = isClinicFixedMonthly(clinic.paymentType);
  const isDaily = isClinicFixedDaily(clinic.paymentType);
  if (!isMonthly && !isDaily) return empty;

  const baseValue = clinic.paymentAmount ?? 0;

  // Sessões billable da clínica (todos os pacientes da clínica)
  const clinicPatientIds = new Set(allClinicPatients.map(p => p.id));
  const billableEvos = allClinicEvolutions.filter(
    e => clinicPatientIds.has(e.patientId) && isBillableStatus(e.attendanceStatus),
  );

  const clinicSalary = isMonthly
    ? baseValue
    : new Set(billableEvos.map(e => e.date)).size * baseValue;

  const totalSessions = billableEvos.length;
  const patientSessions = billableEvos.filter(e => e.patientId === patient.id).length;

  if (totalSessions === 0 || clinicSalary === 0) {
    return { ...empty, clinicSalary, patientSessions, totalSessions, isProportional: true };
  }

  const share = (patientSessions / totalSessions) * clinicSalary;

  return { share, clinicSalary, patientSessions, totalSessions, isProportional: true };
}

// ============================================================================
//  Re-exports de helpers já existentes (para conveniência dos consumidores)
// ============================================================================

export { getDynamicSessionValue, calculateMensalRevenueWithDeductions };
