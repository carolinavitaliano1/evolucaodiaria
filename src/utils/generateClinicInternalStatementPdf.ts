import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getDynamicSessionValue } from '@/utils/dateHelpers';

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
  type: 'Sessão' | 'Serviço' | 'Pacote';
  description: string;
  status: string;
  amount: number;
  paid: boolean;
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

const STATUS_LABEL: Record<string, string> = {
  presente: 'Presente',
  falta: 'Falta',
  falta_remunerada: 'Falta Remunerada',
  reposicao: 'Reposição',
  feriado_remunerado: 'Feriado Rem.',
  feriado_nao_remunerado: 'Feriado',
};

const COUNTS_AS_BILLABLE = (s: string) =>
  s === 'presente' || s === 'falta_remunerada' || s === 'reposicao' || s === 'feriado_remunerado';

export async function generateClinicInternalStatementPdf(
  opts: ClinicInternalStatementOptions
): Promise<void> {
  const { clinicId, clinicName, clinicAddress, clinicCnpj, month, year, patients: patientsHint } = opts;

  const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const [svcRes, payRes, patRes, evoRes, pkgRes] = await Promise.all([
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
  ]);

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

  // Group services by patient (or orphan)
  const servicesByPatient: Record<string, PrivateApt[]> = {};
  const orphanServices: PrivateApt[] = [];
  for (const s of services) {
    if (s.status === 'cancelado') continue;
    if (s.patient_id) (servicesByPatient[s.patient_id] ||= []).push(s);
    else orphanServices.push(s);
  }

  // Group evolutions by patient
  const evosByPatient: Record<string, EvolutionRow[]> = {};
  for (const e of evolutions) {
    (evosByPatient[e.patient_id] ||= []).push(e);
  }

  // Build PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 18, contentW = W - M * 2;
  const dark: [number, number, number] = [25, 25, 35];
  const muted: [number, number, number] = [110, 110, 125];
  const accent: [number, number, number] = [40, 60, 120];
  const border: [number, number, number] = [220, 220, 230];
  let y = M;

  const ensure = (h: number) => { if (y + h > H - M - 10) { doc.addPage(); y = M; } };
  const hr = () => { doc.setDrawColor(...border); doc.line(M, y, W - M, y); y += 4; };

  // HEADER
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...accent);
  doc.text('EXTRATO COMPLETO INTERNO', M, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...dark);
  doc.text(clinicName, M, y); y += 5;
  doc.setFontSize(8); doc.setTextColor(...muted);
  if (clinicAddress) { doc.text(clinicAddress, M, y); y += 4; }
  if (clinicCnpj) { doc.text(`CNPJ: ${clinicCnpj}`, M, y); y += 4; }
  doc.text(`Período: ${format(new Date(year, month, 1), "MMMM 'de' yyyy", { locale: ptBR })}`, M, y);
  doc.text(`Emissão: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`, W - M, y, { align: 'right' });
  y += 5; hr(); y += 2;

  let grandTotal = 0;
  let grandReceived = 0;

  // All patients with movement
  const patientIdsWithMovement = new Set<string>();
  Object.keys(servicesByPatient).forEach(id => patientIdsWithMovement.add(id));
  Object.keys(evosByPatient).forEach(id => patientIdsWithMovement.add(id));
  payments.forEach(p => patientIdsWithMovement.add(p.patient_id));

  const orderedPatients = Array.from(patientIdsWithMovement)
    .map(id => ({ id, info: patientMap.get(id) }))
    .filter(p => p.info)
    .sort((a, b) => (a.info!.name).localeCompare(b.info!.name, 'pt-BR'));

  const drawTableHeader = () => {
    ensure(7);
    doc.setFillColor(245, 246, 250);
    doc.rect(M, y, contentW, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text('Data', M + 2, y + 4);
    doc.text('Tipo', M + 22, y + 4);
    doc.text('Descrição', M + 42, y + 4);
    doc.text('Status', M + 110, y + 4);
    doc.text('Pago', M + 138, y + 4);
    doc.text('Valor', W - M - 2, y + 4, { align: 'right' });
    y += 7;
  };

  const drawRow = (r: Row) => {
    ensure(5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text(fmtDate(r.date), M + 2, y);
    const typeColor: [number, number, number] =
      r.type === 'Serviço' ? [120, 60, 160] : r.type === 'Pacote' ? [60, 100, 160] : muted;
    doc.setTextColor(...typeColor);
    doc.text(r.type, M + 22, y);
    doc.setTextColor(...dark);
    const desc = doc.splitTextToSize(r.description, 65)[0];
    doc.text(desc, M + 42, y);
    doc.setTextColor(...muted);
    doc.text(r.status, M + 110, y);
    doc.setTextColor(...(r.paid ? [30, 130, 60] as [number, number, number] : [180, 100, 30] as [number, number, number]));
    doc.text(r.paid ? 'Sim' : 'Não', M + 138, y);
    doc.setTextColor(...dark);
    doc.text(fmtBRL(r.amount), W - M - 2, y, { align: 'right' });
    y += 5;
  };

  for (const p of orderedPatients) {
    const info = p.info!;
    const pSvcs = servicesByPatient[p.id] || [];
    const pEvos = (evosByPatient[p.id] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const pPay = payments.find(x => x.patient_id === p.id);
    const pkg = info.package_id ? pkgMap.get(info.package_id) : null;

    // Compute per-session value
    const monthlyValue = pPay?.amount ?? Number(info.payment_value || 0);
    let perSession = 0;
    let packageLabel = '';
    if (pkg?.package_type === 'sessao') {
      perSession = Number(pkg.price) || 0;
      packageLabel = `Pacote por sessão — ${pkg.name}`;
    } else if (pkg?.package_type === 'personalizado') {
      const limit = pkg.session_limit || pEvos.length || 1;
      perSession = (Number(pkg.price) || 0) / Math.max(1, limit);
      packageLabel = `Pacote personalizado — ${pkg.name} (${limit} sessões)`;
    } else {
      const dyn = getDynamicSessionValue(monthlyValue, info.weekdays || undefined, month, year);
      perSession = dyn.perSession || monthlyValue;
      packageLabel = pkg ? `Pacote mensal — ${pkg.name}` : 'Mensalidade';
    }

    // Build session rows
    const sessionRows: Row[] = pEvos.map(e => {
      const billable = COUNTS_AS_BILLABLE(e.attendance_status);
      return {
        date: e.date,
        type: 'Sessão',
        description: 'Atendimento clínico',
        status: STATUS_LABEL[e.attendance_status] || e.attendance_status,
        amount: billable ? perSession : 0,
        paid: !!pPay?.paid,
      };
    });

    const sessionsTotal = sessionRows.reduce((s, r) => s + r.amount, 0);
    const servicesTotal = pSvcs.reduce((s, x) => s + (x.price || 0), 0);
    const patientTotal = sessionsTotal + servicesTotal;

    if (patientTotal === 0 && sessionRows.length === 0 && pSvcs.length === 0) continue;

    grandTotal += patientTotal;
    if (pPay?.paid) grandReceived += sessionsTotal;
    grandReceived += pSvcs.filter(s => s.paid).reduce((s, x) => s + x.price, 0);

    // Patient header
    ensure(14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...accent);
    doc.text(info.name, M, y); y += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...muted);
    doc.text(`${packageLabel} • Valor por sessão: ${fmtBRL(perSession)}`, M, y); y += 4;

    drawTableHeader();

    // Sessions detailed
    sessionRows.forEach(r => drawRow(r));

    // Services
    pSvcs.sort((a, b) => a.date.localeCompare(b.date)).forEach(s => drawRow({
      date: s.date,
      type: 'Serviço',
      description: s.service_name || 'Serviço prestado',
      status: s.status,
      amount: s.price,
      paid: !!s.paid,
    }));

    // Subtotal
    ensure(6);
    doc.setDrawColor(...border); doc.line(M, y, W - M, y); y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...dark);
    doc.text(`Subtotal — ${info.name}`, M + 2, y);
    doc.text(fmtBRL(patientTotal), W - M - 2, y, { align: 'right' });
    y += 7;
  }

  // ORPHAN SERVICES
  if (orphanServices.length > 0) {
    ensure(12);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...accent);
    doc.text('Serviços sem paciente vinculado', M, y); y += 5;
    drawTableHeader();
    let orphanTotal = 0;
    orphanServices.sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
      orphanTotal += s.price;
      if (s.paid) grandReceived += s.price;
      drawRow({
        date: s.date,
        type: 'Serviço',
        description: `${s.service_name || 'Serviço'} — ${s.client_name}`,
        status: s.status,
        amount: s.price,
        paid: !!s.paid,
      });
    });
    grandTotal += orphanTotal;
    ensure(6);
    doc.setDrawColor(...border); doc.line(M, y, W - M, y); y += 4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...dark);
    doc.text('Subtotal — Serviços avulsos', M + 2, y);
    doc.text(fmtBRL(orphanTotal), W - M - 2, y, { align: 'right' });
    y += 7;
  }

  // GRAND TOTAL
  ensure(20);
  y += 3;
  doc.setDrawColor(...accent); doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y); y += 6;
  doc.setLineWidth(0.2);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...accent);
  doc.text('TOTAL FATURADO', M, y);
  doc.text(fmtBRL(grandTotal), W - M, y, { align: 'right' });
  y += 6;
  doc.setFontSize(9.5); doc.setTextColor(30, 130, 60);
  doc.text('Total recebido', M, y);
  doc.text(fmtBRL(grandReceived), W - M, y, { align: 'right' });
  y += 5;
  doc.setTextColor(180, 100, 30);
  doc.text('Total pendente', M, y);
  doc.text(fmtBRL(Math.max(0, grandTotal - grandReceived)), W - M, y, { align: 'right' });

  // FOOTER
  const pages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7); doc.setTextColor(...muted); doc.setFont('helvetica', 'normal');
    doc.text(
      `${clinicName} — Extrato Interno ${format(new Date(year, month, 1), 'MM/yyyy')} — Pag. ${p}/${pages}`,
      W / 2, H - 8, { align: 'center' }
    );
  }

  const safeClinic = clinicName.replace(/\s+/g, '-').toLowerCase();
  doc.save(`extrato-interno-${safeClinic}-${year}-${String(month + 1).padStart(2, '0')}.pdf`);
  toast.success('Extrato interno gerado!');
}
