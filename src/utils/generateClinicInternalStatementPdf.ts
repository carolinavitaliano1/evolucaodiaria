import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getDynamicSessionValue, calculateMensalRevenueWithDeductions } from '@/utils/dateHelpers';

interface PatientLite {
  id: string;
  name: string;
}

export interface ClinicInternalStatementOptions {
  clinicId: string;
  clinicName: string;
  clinicAddress?: string | null;
  clinicCnpj?: string | null;
  month: number; // 0-indexed
  year: number;
  patients?: PatientLite[];
}

interface Row {
  date: string;
  type: 'Sessão' | 'Serviço' | 'Mensalidade' | 'Dedução';
  description: string;
  status: string;
  amount: number;
  paid: boolean;
  sessionIndex?: number;
  sessionTotal?: number;
}

interface PrivateApt {
  id: string;
  date: string;
  time: string;
  price: number;
  status: string;
  paid: boolean | null;
  patient_id: string | null;
  client_name: string;
  service_name: string | null;
}

interface EvolutionRow {
  id: string;
  date: string;
  patient_id: string;
  attendance_status: string;
}

interface PaymentRecord {
  patient_id: string;
  amount: number;
  paid: boolean;
  payment_date: string | null;
}

interface PatientFull {
  id: string;
  name: string;
  payment_type: string | null;
  payment_value: number | null;
  weekdays: string[] | null;
  package_id: string | null;
}

interface PackageRow {
  id: string;
  name: string;
  package_type: string;
  price: number;
  session_limit: number | null;
}

const fmtBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) => format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });

const fmtCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '');
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const STATUS_LABEL: Record<string, string> = {
  presente: 'Presente',
  falta: 'Falta',
  falta_remunerada: 'Falta Remun.',
  falta_cobrada: 'Falta Cobrada',
  reposicao: 'Reposição',
  feriado_remunerado: 'Feriado Rem.',
  feriado_nao_remunerado: 'Feriado',
  cancelado: 'Cancelado',
  agendado: 'Agendado',
  confirmado: 'Confirmado',
};

const COUNTS_AS_BILLABLE = (s: string) =>
  s === 'presente' ||
  s === 'falta_remunerada' ||
  s === 'falta_cobrada' ||
  s === 'reposicao' ||
  s === 'feriado_remunerado';

const isMensalType = (pt: string | null | undefined, pkgType: string | null | undefined) =>
  pt === 'fixo' || pt === 'mensal' || pkgType === 'mensal';

export async function generateClinicInternalStatementPdf(
  opts: ClinicInternalStatementOptions
): Promise<void> {
  const { clinicId, clinicName, clinicAddress, clinicCnpj, month, year, patients: patientsHint } = opts;

  const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [svcRes, payRes, patRes, evoRes, pkgRes, clinicRes, clinicPayRes] = await Promise.all([
    supabase
      .from('private_appointments')
      .select('id, date, time, price, status, paid, patient_id, client_name, services(name)')
      .eq('clinic_id', clinicId)
      .gte('date', startStr)
      .lte('date', endStr),
    supabase
      .from('patient_payment_records')
      .select('patient_id, amount, paid, payment_date')
      .eq('clinic_id', clinicId)
      .eq('month', month + 1)
      .eq('year', year),
    supabase
      .from('patients')
      .select('id, name, payment_type, payment_value, weekdays, package_id')
      .eq('clinic_id', clinicId),
    supabase
      .from('evolutions')
      .select('id, date, patient_id, attendance_status')
      .eq('clinic_id', clinicId)
      .gte('date', startStr)
      .lte('date', endStr),
    supabase
      .from('clinic_packages')
      .select('id, name, package_type, price, session_limit')
      .eq('clinic_id', clinicId),
    supabase
      .from('clinics')
      .select('payment_type, payment_amount, discount_percentage')
      .eq('id', clinicId)
      .maybeSingle(),
    supabase
      .from('clinic_payment_records')
      .select('amount, paid, payment_date')
      .eq('clinic_id', clinicId)
      .eq('month', month + 1)
      .eq('year', year)
      .maybeSingle(),
  ]);

  const clinicPayInfo: { payment_type: string | null; payment_amount: number | null; discount_percentage: number | null } | null =
    (clinicRes.data as any) ?? null;

  const isClinicFixedSalary =
    clinicPayInfo?.payment_type === 'fixo_mensal' ||
    clinicPayInfo?.payment_type === 'fixo' ||
    clinicPayInfo?.payment_type === 'mensal' ||
    clinicPayInfo?.payment_type === 'fixo_diario' ||
    clinicPayInfo?.payment_type === 'fixo_dia';

  const clinicDiscountPct = Math.max(0, Math.min(100, Number(clinicPayInfo?.discount_percentage || 0)));
  const clinicDiscountFactor = 1 - clinicDiscountPct / 100;
  const clinicSessionAmount = Number(clinicPayInfo?.payment_amount || 0);
  const isClinicPerSession = clinicPayInfo?.payment_type === 'sessao' || clinicPayInfo?.payment_type === 'por_sessao';

  const services: PrivateApt[] = (svcRes.data || []).map((d: any) => ({
    id: d.id,
    date: d.date,
    time: d.time,
    price: Number(d.price) || 0,
    status: d.status,
    paid: d.paid,
    patient_id: d.patient_id,
    client_name: d.client_name,
    service_name: d.services?.name ?? null,
  }));
  const payments: PaymentRecord[] = (payRes.data || []) as any;
  const allPatients: PatientFull[] = (patRes.data || []) as any;
  const evolutions: EvolutionRow[] = (evoRes.data || []) as any;
  const packages: PackageRow[] = (pkgRes.data || []) as any;

  const patientMap = new Map<string, PatientFull>();
  allPatients.forEach(p => patientMap.set(p.id, p));
  patientsHint?.forEach(p => {
    if (!patientMap.has(p.id))
      patientMap.set(p.id, { id: p.id, name: p.name, payment_type: null, payment_value: null, weekdays: null, package_id: null });
  });
  const pkgMap = new Map<string, PackageRow>();
  packages.forEach(p => pkgMap.set(p.id, p));

  const servicesByPatient: Record<string, PrivateApt[]> = {};
  const orphanServices: PrivateApt[] = [];
  for (const s of services) {
    if (s.status === 'cancelado') continue;
    if (s.patient_id) (servicesByPatient[s.patient_id] ||= []).push(s);
    else orphanServices.push(s);
  }

  const evosByPatient: Record<string, EvolutionRow[]> = {};
  for (const e of evolutions) {
    (evosByPatient[e.patient_id] ||= []).push(e);
  }

  // ===== PDF =====
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16, contentW = W - M * 2;
  const dark: [number, number, number] = [25, 25, 35];
  const muted: [number, number, number] = [110, 110, 125];
  const accent: [number, number, number] = [40, 60, 120];
  const accentLight: [number, number, number] = [235, 238, 248];
  const border: [number, number, number] = [220, 220, 230];
  const green: [number, number, number] = [30, 130, 60];
  const orange: [number, number, number] = [200, 110, 30];
  const red: [number, number, number] = [180, 60, 60];
  let y = M;

  const ensure = (h: number) => { if (y + h > H - M - 10) { doc.addPage(); y = M; } };

  // HEADER
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 22, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text('EXTRATO FINANCEIRO INTERNO', M, 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(clinicName, M, 16);
  doc.setFontSize(8);
  const periodLabel = format(new Date(year, month, 1), "MMMM 'de' yyyy", { locale: ptBR });
  doc.text(periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1), W - M, 10, { align: 'right' });
  doc.text(`Emitido em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, W - M, 16, { align: 'right' });
  y = 28;

  if (clinicAddress || clinicCnpj) {
    doc.setFontSize(7.5); doc.setTextColor(...muted); doc.setFont('helvetica', 'normal');
    const parts = [clinicAddress, clinicCnpj ? `CNPJ: ${fmtCNPJ(clinicCnpj)}` : null].filter(Boolean);
    doc.text(parts.join('  •  '), M, y); y += 5;
  }

  // Nota de modelo de remuneração da clínica (quando fixo)
  const clPay = clinicPayInfo?.payment_type;
  const clAmt = clinicPayInfo?.payment_amount ?? 0;
  if (clPay === 'fixo_mensal' || clPay === 'fixo' || clPay === 'mensal') {
    doc.setFontSize(8); doc.setTextColor(...accent); doc.setFont('helvetica', 'bold');
    doc.text(
      `Remuneração: Salário Fixo Mensal — ${fmtBRL(clAmt)} (independente do nº de sessões)`,
      M, y,
    );
    y += 6;
  } else if (clPay === 'fixo_diario' || clPay === 'fixo_dia') {
    doc.setFontSize(8); doc.setTextColor(...accent); doc.setFont('helvetica', 'bold');
    doc.text(
      `Remuneração: Fixo por Dia Trabalhado — ${fmtBRL(clAmt)} / dia`,
      M, y,
    );
    y += 6;
  }

  // ===== Compute all data first for executive summary =====
  const patientIdsWithMovement = new Set<string>();
  Object.keys(servicesByPatient).forEach(id => patientIdsWithMovement.add(id));
  Object.keys(evosByPatient).forEach(id => patientIdsWithMovement.add(id));
  payments.forEach(p => patientIdsWithMovement.add(p.patient_id));

  const orderedPatients = Array.from(patientIdsWithMovement)
    .map(id => ({ id, info: patientMap.get(id) }))
    .filter(p => p.info)
    .sort((a, b) => (a.info!.name).localeCompare(b.info!.name, 'pt-BR'));

  interface PatientBlock {
    id: string;
    info: PatientFull;
    pkg: PackageRow | null;
    isMensal: boolean;
    monthlyValue: number;
    perSession: number;
    packageLabel: string;
    rows: Row[];
    sessionsTotal: number;
    servicesTotal: number;
    deductionTotal: number;
    patientTotal: number;
    received: number;
    pending: number;
    paymentStatus: 'pago' | 'pendente' | 'parcial' | 'sem_registro';
  }

  const blocks: PatientBlock[] = [];

  for (const p of orderedPatients) {
    const info = p.info!;
    const pSvcs = (servicesByPatient[p.id] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const pEvos = (evosByPatient[p.id] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const pPay = payments.find(x => x.patient_id === p.id);
    const pkg = info.package_id ? pkgMap.get(info.package_id) || null : null;
    const isMensal = isMensalType(info.payment_type, pkg?.package_type);

    const monthlyValue = pPay?.amount ?? Number(info.payment_value || 0);
    let perSession = 0;
    let packageLabel = '';

    // Quando a clínica é de salário fixo, ignoramos a mensalidade do paciente
    // e mostramos apenas as sessões com valor zero (a receita real é da clínica).
    const treatAsFixedSalary = isClinicFixedSalary;

    // ⚠️ IMPORTANTE: o desconto da clínica (discount_percentage) incide sobre o
    // TOTAL recebido no mês, não por sessão. Por isso aqui mantemos o valor
    // bruto da sessão e o desconto é aplicado depois, no recebido/total.
    if (treatAsFixedSalary) {
      perSession = 0;
      packageLabel = clinicPayInfo?.payment_type === 'fixo_diario' || clinicPayInfo?.payment_type === 'fixo_dia'
        ? 'Salário fixo da clínica (por dia)'
        : 'Salário fixo da clínica (mensal)';
    } else if (pkg?.package_type === 'sessao') {
      perSession = Number(pkg.price) || 0;
      packageLabel = `Por sessão • ${pkg.name}`;
    } else if (pkg?.package_type === 'personalizado') {
      const limit = pkg.session_limit || pEvos.length || 1;
      perSession = (Number(pkg.price) || 0) / Math.max(1, limit);
      packageLabel = `Personalizado • ${pkg.name} (${limit} sessões)`;
    } else if (isMensal) {
      const dyn = getDynamicSessionValue(monthlyValue, info.weekdays || undefined, month, year);
      perSession = dyn.perSession || monthlyValue;
      packageLabel = pkg ? `Mensal • ${pkg.name}` : 'Mensalidade';
    } else {
      // Por sessão (sem pacote): valor fixo do paciente OU da clínica.
      // Valor BRUTO — desconto da clínica entra no total.
      const baseSessionValue = Number(info.payment_value) > 0
        ? Number(info.payment_value)
        : clinicSessionAmount;
      perSession = baseSessionValue;
      packageLabel = 'Por sessão';
    }

    const rows: Row[] = [];
    let sessionsTotal = 0;
    let deductionTotal = 0;

    if (treatAsFixedSalary) {
      // Sessões listadas apenas para visibilidade — sem cobrança individual.
      pEvos.forEach(e => {
        rows.push({
          date: e.date,
          type: 'Sessão',
          description: 'Atendimento (salário fixo da clínica)',
          status: STATUS_LABEL[e.attendance_status] || e.attendance_status,
          amount: 0,
          paid: false,
        });
      });
      sessionsTotal = 0;
    } else if (isMensal) {
      // For mensalistas: monthly fee divided per actual occurrences
      const billableEvos = pEvos.filter(e => COUNTS_AS_BILLABLE(e.attendance_status));
      const absences = pEvos.filter(e => e.attendance_status === 'falta');
      const calc = calculateMensalRevenueWithDeductions(monthlyValue, perSession, absences.length);

      // Use dynamic occurrences from weekday count (not actual evolutions logged)
      const dynInfo = getDynamicSessionValue(monthlyValue, info.weekdays || undefined, month, year);
      const totalSessionsInMonth = dynInfo.occurrences || billableEvos.length || 1;

      let billableCounter = 0;
      pEvos.forEach(e => {
        const isBillable = COUNTS_AS_BILLABLE(e.attendance_status);
        if (isBillable) billableCounter++;
        rows.push({
          date: e.date,
          type: 'Sessão',
          description: isBillable ? 'Atendimento' : 'Sessão sem cobrança',
          status: STATUS_LABEL[e.attendance_status] || e.attendance_status,
          amount: isBillable ? perSession : 0,
          paid: !!pPay?.paid,
          sessionIndex: isBillable ? billableCounter : undefined,
          sessionTotal: isBillable ? totalSessionsInMonth : undefined,
        });
      });

      if (calc.hasDeduction && calc.deduction > 0) {
        rows.push({
          date: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
          type: 'Dedução',
          description: `Desconto por ${absences.length} falta(s) não cobrada(s)`,
          status: '—',
          amount: -calc.deduction,
          paid: false,
        });
        deductionTotal = calc.deduction;
      }

      sessionsTotal = calc.finalRevenue;
    } else {
      // Per session / personalizado / avulso: each session has its own value
      pEvos.forEach(e => {
        const billable = COUNTS_AS_BILLABLE(e.attendance_status);
        const amount = billable ? perSession : 0;
        sessionsTotal += amount;
        rows.push({
          date: e.date,
          type: 'Sessão',
          description: 'Atendimento clínico',
          status: STATUS_LABEL[e.attendance_status] || e.attendance_status,
          amount,
          paid: !!pPay?.paid,
        });
      });
    }

    // Services (always per-line)
    pSvcs.forEach(s => {
      rows.push({
        date: s.date,
        type: 'Serviço',
        description: s.service_name || 'Serviço prestado',
        status: STATUS_LABEL[s.status] || s.status,
        amount: s.price,
        paid: !!s.paid,
      });
    });

    const servicesTotal = pSvcs.reduce((acc, s) => acc + s.price, 0);
    const grossTotal = sessionsTotal + servicesTotal;
    // Por paciente, mostramos sempre o valor BRUTO. O desconto da clínica
    // (discount_percentage) é aplicado APENAS no Total Geral da Clínica.
    const patientTotal = treatAsFixedSalary ? 0 : grossTotal;

    if (grossTotal === 0 && rows.length === 0 && !treatAsFixedSalary) continue;

    // Payment status calculation (valor bruto por paciente)
    let received = 0;
    if (treatAsFixedSalary) {
      received = 0;
    } else if (isMensal) {
      if (pPay?.paid) received += sessionsTotal;
    } else {
      if (pPay?.paid) received += sessionsTotal;
    }
    received += pSvcs.filter(s => s.paid).reduce((acc, s) => acc + s.price, 0);
    const pending = Math.max(0, patientTotal - received);

    let paymentStatus: PatientBlock['paymentStatus'] = 'sem_registro';
    if (treatAsFixedSalary) paymentStatus = 'sem_registro';
    else if (patientTotal === 0) paymentStatus = 'sem_registro';
    else if (received >= patientTotal - 0.01) paymentStatus = 'pago';
    else if (received > 0) paymentStatus = 'parcial';
    else paymentStatus = 'pendente';

    blocks.push({
      id: p.id,
      info,
      pkg,
      isMensal,
      monthlyValue,
      perSession,
      packageLabel,
      rows,
      sessionsTotal,
      servicesTotal,
      deductionTotal,
      patientTotal,
      received,
      pending,
      paymentStatus,
    });
  }

  // Orphan services totais BRUTOS (desconto vai no total geral)
  const orphanGross = orphanServices.reduce((acc, s) => acc + s.price, 0);
  const orphanReceivedGross = orphanServices.filter(s => s.paid).reduce((acc, s) => acc + s.price, 0);
  const orphanTotal = orphanGross;
  const orphanReceived = orphanReceivedGross;

  // Para clínicas com salário fixo: a "receita" da clínica é o salário (mensal) ou
  // salário diário × dias trabalhados (dias únicos com sessões cobráveis).
  let clinicFixedRevenue = 0;
  if (isClinicFixedSalary) {
    if (clinicPayInfo?.payment_type === 'fixo_diario' || clinicPayInfo?.payment_type === 'fixo_dia') {
      const billableDays = new Set<string>();
      evolutions.forEach(e => {
        if (COUNTS_AS_BILLABLE(e.attendance_status)) billableDays.add(e.date);
      });
      clinicFixedRevenue = Number(clinicPayInfo?.payment_amount || 0) * billableDays.size;
    } else {
      clinicFixedRevenue = Number(clinicPayInfo?.payment_amount || 0);
    }
  }

  const clinicPayRecord = (clinicPayRes.data as any) || null;
  const clinicFixedReceived = isClinicFixedSalary && clinicPayRecord?.paid
    ? Number(clinicPayRecord?.amount ?? clinicFixedRevenue)
    : 0;

  const patientsRevenueTotal = blocks.reduce((acc, b) => acc + b.patientTotal, 0);
  const patientsReceivedTotal = blocks.reduce((acc, b) => acc + b.received, 0);

  // Total bruto e total com desconto da clínica aplicado SOMENTE aqui
  const grossGrandTotal = (isClinicFixedSalary ? clinicFixedRevenue : patientsRevenueTotal) + orphanTotal;
  const grossGrandReceived = (isClinicFixedSalary ? clinicFixedReceived : patientsReceivedTotal) + orphanReceived;

  // Salário fixo não recebe desconto percentual; demais modelos sim
  const grandTotal = isClinicFixedSalary ? grossGrandTotal : grossGrandTotal * clinicDiscountFactor;
  const grandReceived = isClinicFixedSalary ? grossGrandReceived : grossGrandReceived * clinicDiscountFactor;
  const grandPending = Math.max(0, grandTotal - grandReceived);
  const grandDiscount = grossGrandTotal - grandTotal;

  const inadimplencia = grandTotal > 0 ? (grandPending / grandTotal) * 100 : 0;
  const billedBlocks = blocks.filter(b => b.patientTotal > 0);
  const totalPatients = blocks.length;
  const billedPatients = billedBlocks.length;
  const paidPatients = isClinicFixedSalary
    ? (clinicFixedReceived >= clinicFixedRevenue - 0.01 && clinicFixedRevenue > 0 ? totalPatients : 0)
    : billedBlocks.filter(b => b.paymentStatus === 'pago').length;
  const pendingPatients = isClinicFixedSalary
    ? (clinicFixedReceived >= clinicFixedRevenue - 0.01 ? 0 : totalPatients)
    : billedBlocks.filter(b => b.paymentStatus === 'pendente' || b.paymentStatus === 'parcial').length;
  const noChargePatients = isClinicFixedSalary ? 0 : totalPatients - billedPatients;

  // ===== EXECUTIVE SUMMARY =====
  const summaryH = 50;
  ensure(summaryH + 2);
  doc.setFillColor(...accentLight);
  doc.rect(M, y, contentW, summaryH, 'F');
  doc.setDrawColor(...accent); doc.setLineWidth(0.3);
  doc.rect(M, y, contentW, summaryH);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...accent);
  doc.text('RESUMO EXECUTIVO', M + 3, y + 5);

  // 4 KPIs in a row
  const kpiW = (contentW - 6) / 4;
  const kpiY = y + 10;
  const kpis = [
    { label: 'Faturamento', value: fmtBRL(grandTotal), color: dark },
    { label: 'Recebido', value: fmtBRL(grandReceived), color: green },
    { label: 'Pendente', value: fmtBRL(grandPending), color: orange },
    { label: 'Inadimplência', value: `${inadimplencia.toFixed(1)}%`, color: inadimplencia > 30 ? red : dark },
  ];
  kpis.forEach((k, i) => {
    const x = M + 3 + i * kpiW;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...muted);
    doc.text(k.label.toUpperCase(), x, kpiY);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...(k.color as [number, number, number]));
    doc.text(k.value, x, kpiY + 6);
  });

  // Sub-stats (espaçados verticalmente para não sobrepor os KPIs)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...dark);
  const subY = y + 34;
  const movimentoLabel = isClinicFixedSalary
    ? `Pacientes atendidos: ${totalPatients}`
    : `Pacientes atendidos: ${totalPatients}`;
  doc.text(movimentoLabel, M + 3, subY);
  doc.setTextColor(...green);
  doc.text(`Quitados: ${paidPatients}`, M + 3 + kpiW, subY);
  doc.setTextColor(...orange);
  doc.text(`Em aberto: ${pendingPatients}`, M + 3 + kpiW * 2, subY);
  doc.setTextColor(...muted);
  doc.text(`Serviços avulsos: ${orphanServices.length}`, M + 3 + kpiW * 3, subY);

  doc.setFontSize(7); doc.setTextColor(...muted);
  doc.text(`Total de sessões registradas: ${evolutions.length}  •  Serviços vinculados: ${services.length - orphanServices.length}${clinicDiscountPct > 0 && !isClinicFixedSalary ? `  •  Desconto da clínica (${clinicDiscountPct}%) aplicado apenas no Total Geral` : ''}`, M + 3, y + 42);

  y += summaryH + 4;

  // ===== Per-patient detail =====
  const drawTableHeader = () => {
    ensure(11);
    doc.setFillColor(245, 246, 250);
    doc.rect(M, y, contentW, 9, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...dark);
    doc.text('Data', M + 2, y + 6);
    doc.text('Tipo', M + 20, y + 6);
    doc.text('Descrição', M + 42, y + 6);
    doc.text('Status', M + 112, y + 6);
    if (!isClinicFixedSalary) {
      doc.text('Pago', M + 138, y + 6);
      doc.text('Valor', W - M - 2, y + 6, { align: 'right' });
    }
    y += 13;
  };

  const drawRow = (r: Row) => {
    ensure(5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...dark);
    doc.text(fmtDate(r.date), M + 2, y);
    const typeColor: [number, number, number] =
      r.type === 'Serviço' ? [120, 60, 160] :
      r.type === 'Mensalidade' ? accent :
      r.type === 'Dedução' ? red :
      muted;
    doc.setTextColor(...typeColor);
    doc.text(r.type, M + 20, y);
    doc.setTextColor(...dark);
    const desc = doc.splitTextToSize(r.description, 68)[0];
    doc.text(desc, M + 42, y);
    doc.setTextColor(...muted);
    doc.text(r.status, M + 112, y);
    if (!isClinicFixedSalary) {
      if (r.type === 'Sessão' && r.amount === 0) {
        doc.setTextColor(...muted);
        doc.text('—', M + 138, y);
      } else if (r.type === 'Dedução') {
        doc.setTextColor(...muted);
        doc.text('—', M + 138, y);
      } else {
        doc.setTextColor(...(r.paid ? green : orange));
        doc.text(r.paid ? 'Sim' : 'Não', M + 138, y);
      }
      doc.setTextColor(...(r.amount < 0 ? red : dark));
      const valueLabel = r.sessionIndex && r.sessionTotal
        ? `${fmtBRL(r.amount)} (${r.sessionIndex}/${r.sessionTotal})`
        : fmtBRL(r.amount);
      doc.text(valueLabel, W - M - 2, y, { align: 'right' });
    }
    y += 5;
  };

  const statusBadge = (status: PatientBlock['paymentStatus']) => {
    const cfg = {
      pago: { label: 'QUITADO', color: green },
      pendente: { label: 'PENDENTE', color: orange },
      parcial: { label: 'PARCIAL', color: orange },
      sem_registro: { label: '', color: muted },
    }[status];
    return cfg;
  };

  for (const b of blocks) {
    ensure(24);
    // Patient header bar (taller for breathing room)
    doc.setFillColor(250, 251, 253);
    doc.rect(M, y, contentW, 14, 'F');
    doc.setDrawColor(...border);
    doc.line(M, y + 14, W - M, y + 14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...accent);
    doc.text(b.info.name, M + 2, y + 5);

    // Status badge on right (top) — hide for fixed salary clinics e quando vazio
    const badge = statusBadge(b.paymentStatus);
    if (!isClinicFixedSalary && badge.label) {
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...badge.color);
      doc.text(badge.label, W - M - 2, y + 5, { align: 'right' });
    }

    // Subtitle: package + session counter
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...muted);
    let sessionInfoBilled: string;
    if (isClinicFixedSalary) {
      const sessionsCount = b.rows.filter(r => r.type === 'Sessão').length;
      sessionInfoBilled = `${sessionsCount} sessão(ões) registrada(s)`;
    } else if (b.isMensal) {
      const billable = b.rows.filter(r => r.type === 'Sessão' && r.amount > 0).length;
      const totalSlots = b.rows.find(r => r.sessionTotal)?.sessionTotal ?? billable;
      sessionInfoBilled = `${billable}/${totalSlots} sessões`;
    } else {
      const billable = b.rows.filter(r => r.type === 'Sessão' && r.amount > 0).length;
      sessionInfoBilled = `${billable} sessão(ões) cobrável(is)`;
    }
    doc.text(`${b.packageLabel}  •  ${sessionInfoBilled}`, M + 2, y + 10);

    // Right side under badge: monthly value + weekly breakdown for mensalistas
    if (isClinicFixedSalary) {
      doc.setTextColor(...muted); doc.setFontSize(7.5); doc.setFont('helvetica', 'italic');
      doc.text('Sem cobrança individual', W - M - 2, y + 10, { align: 'right' });
    } else if (b.isMensal && b.monthlyValue > 0) {
      const totalSlots = b.rows.find(r => r.sessionTotal)?.sessionTotal ?? 0;
      const detail = totalSlots > 0
        ? `${fmtBRL(b.monthlyValue)}/mês  (Mês de ${totalSlots} semanas: ${fmtBRL(b.perSession)}/sessão)`
        : `${fmtBRL(b.monthlyValue)}/mês`;
      doc.setTextColor(...badge.color); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      doc.text(detail, W - M - 2, y + 10, { align: 'right' });
    }
    y += 18;

    drawTableHeader();
    b.rows.forEach(r => drawRow(r));

    // Subtotal line
    ensure(10);
    doc.setDrawColor(...border); doc.line(M, y + 0.5, W - M, y + 0.5); y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text(`Subtotal — ${b.info.name}`, M + 2, y);
    if (isClinicFixedSalary) {
      doc.setTextColor(...muted); doc.setFont('helvetica', 'italic');
      doc.text('—  (incluso no salário fixo)', W - M - 2, y, { align: 'right' });
    } else {
      doc.text(fmtBRL(b.patientTotal), W - M - 2, y, { align: 'right' });
    }
    y += 4;

    // Recebido / pendente line — omit for fixed salary clinics (handled at clinic level)
    if (!isClinicFixedSalary) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...green);
      doc.text(`Recebido: ${fmtBRL(b.received)}`, M + 2, y);
      doc.setTextColor(...orange);
      doc.text(`Pendente: ${fmtBRL(b.pending)}`, M + 50, y);
      if (b.deductionTotal > 0) {
        doc.setTextColor(...red);
        doc.text(`Deduções: ${fmtBRL(b.deductionTotal)}`, M + 100, y);
      }
      y += 7;
    } else {
      y += 3;
    }
  }

  // ===== ORPHAN SERVICES =====
  if (orphanServices.length > 0) {
    ensure(16);
    doc.setFillColor(250, 251, 253);
    doc.rect(M, y, contentW, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...accent);
    doc.text('Serviços avulsos (sem paciente vinculado)', M + 2, y + 5);
    y += 10;

    drawTableHeader();
    orphanServices.sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
      drawRow({
        date: s.date,
        type: 'Serviço',
        description: `${s.service_name || 'Serviço'} — ${s.client_name}`,
        status: STATUS_LABEL[s.status] || s.status,
        amount: s.price,
        paid: !!s.paid,
      });
    });

    ensure(10);
    doc.setDrawColor(...border); doc.line(M, y + 0.5, W - M, y + 0.5); y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text('Subtotal — Serviços avulsos', M + 2, y);
    doc.text(fmtBRL(orphanTotal), W - M - 2, y, { align: 'right' });
    y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...green);
    doc.text(`Recebido: ${fmtBRL(orphanReceived)}`, M + 2, y);
    doc.setTextColor(...orange);
    doc.text(`Pendente: ${fmtBRL(orphanTotal - orphanReceived)}`, M + 50, y);
    y += 7;
  }

  // ===== GRAND TOTAL =====
  const grandBoxH = clinicDiscountPct > 0 && !isClinicFixedSalary ? 30 : 22;
  ensure(grandBoxH + 6);
  y += 2;
  doc.setFillColor(...accent);
  doc.rect(M, y, contentW, grandBoxH, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
  doc.text('TOTAL GERAL DA CLÍNICA', M + 3, y + 6);
  doc.setFontSize(14);
  doc.text(fmtBRL(grandTotal), W - M - 3, y + 8, { align: 'right' });

  if (clinicDiscountPct > 0 && !isClinicFixedSalary) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.setTextColor(210, 220, 245);
    doc.text(
      `Bruto ${fmtBRL(grossGrandTotal)} • Desconto ${clinicDiscountPct}% (−${fmtBRL(grandDiscount)})`,
      M + 3, y + 12,
    );
  }

  const baseY = clinicDiscountPct > 0 && !isClinicFixedSalary ? y + 6 : y;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor(180, 230, 200);
  doc.text(`Recebido: ${fmtBRL(grandReceived)}`, M + 3, baseY + 14);
  doc.setTextColor(255, 220, 180);
  doc.text(`Pendente: ${fmtBRL(grandPending)}`, M + 3, baseY + 19);
  doc.setTextColor(255, 255, 255);
  doc.text(`Inadimplência: ${inadimplencia.toFixed(1)}%`, W - M - 3, baseY + 19, { align: 'right' });

  y += grandBoxH + 4;

  // ===== Insight para clínicas com salário fixo =====
  if (isClinicFixedSalary && clinicFixedRevenue > 0) {
    const totalSessions = blocks.reduce(
      (acc, b) => acc + b.rows.filter(r => r.type === 'Sessão').length,
      0,
    );
    const patientsCount = blocks.length;
    const perSession = totalSessions > 0 ? clinicFixedRevenue / totalSessions : 0;
    const perPatient = patientsCount > 0 ? clinicFixedRevenue / patientsCount : 0;

    ensure(28);
    doc.setFillColor(245, 246, 250);
    doc.rect(M, y, contentW, 22, 'F');
    doc.setDrawColor(...accent); doc.setLineWidth(0.4);
    doc.line(M, y, M, y + 22);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...accent);
    doc.text('RESUMO DO MÊS (salário fixo rateado)', M + 4, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text(
      `Este mês você recebeu ${fmtBRL(perSession)} por atendimento (${totalSessions} sessões realizadas).`,
      M + 4, y + 12,
    );
    doc.text(
      `E ${fmtBRL(perPatient)} por paciente atendido (${patientsCount} paciente${patientsCount !== 1 ? 's' : ''}).`,
      M + 4, y + 18,
    );
    y += 26;
  }

  // FOOTER
  const pages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(...muted); doc.setFont('helvetica', 'normal');
    doc.text(
      `${clinicName} • Extrato Interno ${format(new Date(year, month, 1), 'MM/yyyy')} • Documento confidencial`,
      M, H - 6
    );
    doc.text(`Página ${p}/${pages}`, W - M, H - 6, { align: 'right' });
  }

  const safeClinic = clinicName.replace(/\s+/g, '-').toLowerCase();
  doc.save(`extrato-interno-${safeClinic}-${year}-${String(month + 1).padStart(2, '0')}.pdf`);
  toast.success('Extrato interno gerado!');
}
