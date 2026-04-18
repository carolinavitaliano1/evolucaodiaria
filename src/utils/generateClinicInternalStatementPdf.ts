import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  /** Optional list to label patients; otherwise we fetch names from DB */
  patients?: PatientLite[];
}

interface SessionRow {
  date: string;
  type: 'Sessão' | 'Serviço';
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

interface PaymentRecord {
  patient_id: string;
  amount: number;
  paid: boolean;
  payment_date: string | null;
}

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string) => format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });

export async function generateClinicInternalStatementPdf(opts: ClinicInternalStatementOptions): Promise<void> {
  const { clinicId, clinicName, clinicAddress, clinicCnpj, month, year, patients: patientsHint } = opts;

  const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Fetch services + payment records + patient names
  const [svcRes, payRes, patRes] = await Promise.all([
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
      .select('id, name')
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
  const allPatients: PatientLite[] = (patRes.data || patientsHint || []) as any;
  const patientNameMap = new Map<string, string>();
  allPatients.forEach(p => patientNameMap.set(p.id, p.name));
  patientsHint?.forEach(p => { if (!patientNameMap.has(p.id)) patientNameMap.set(p.id, p.name); });

  // Group services by patient
  const servicesByPatient: Record<string, PrivateApt[]> = {};
  const orphanServices: PrivateApt[] = [];
  for (const s of services) {
    if (s.status === 'cancelado') continue;
    if (s.patient_id) {
      (servicesByPatient[s.patient_id] ||= []).push(s);
    } else {
      orphanServices.push(s);
    }
  }

  // Build PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 18, contentW = W - M * 2;
  const dark: [number, number, number] = [25, 25, 35];
  const muted: [number, number, number] = [110, 110, 125];
  const accent: [number, number, number] = [40, 60, 120];
  const border: [number, number, number] = [220, 220, 230];
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - M - 10) { doc.addPage(); y = M; }
  };
  const hr = () => { doc.setDrawColor(...border); doc.line(M, y, W - M, y); y += 4; };

  // ── HEADER ──
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

  // ── BUILD ROWS PER PATIENT ──
  let grandTotal = 0;
  let grandReceived = 0;

  // Determine all patient ids with movement (services or payment record)
  const patientIdsWithMovement = new Set<string>();
  Object.keys(servicesByPatient).forEach(id => patientIdsWithMovement.add(id));
  payments.forEach(p => patientIdsWithMovement.add(p.patient_id));

  // Sort patients alphabetically
  const orderedPatients = Array.from(patientIdsWithMovement)
    .map(id => ({ id, name: patientNameMap.get(id) || 'Paciente' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

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

  const drawRow = (r: SessionRow) => {
    ensure(5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text(fmtDate(r.date), M + 2, y);
    doc.setTextColor(...(r.type === 'Serviço' ? [120, 60, 160] as [number, number, number] : muted));
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
    const pSvcs = servicesByPatient[p.id] || [];
    const pPay = payments.find(x => x.patient_id === p.id);

    // Sessions revenue: we don't have evolutions here for full session detail; use payment record amount
    const sessionsAmount = pPay?.amount || 0;
    const servicesAmount = pSvcs.reduce((s, x) => s + (x.price || 0), 0);
    const patientTotal = sessionsAmount + servicesAmount;
    if (patientTotal === 0 && pSvcs.length === 0 && !pPay) continue;

    grandTotal += patientTotal;
    if (pPay?.paid) grandReceived += sessionsAmount;
    grandReceived += pSvcs.filter(s => s.paid).reduce((s, x) => s + x.price, 0);

    ensure(12);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...accent);
    doc.text(p.name, M, y); y += 5;
    drawTableHeader();

    // Sessions row (consolidated by month — we only have the payment record amount)
    if (sessionsAmount > 0) {
      drawRow({
        date: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        type: 'Sessão',
        description: 'Mensalidade / Sessões do mês',
        status: '—',
        amount: sessionsAmount,
        paid: !!pPay?.paid,
      });
    }

    // Services rows (sorted by date)
    pSvcs
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(s => drawRow({
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
    doc.text(`Subtotal — ${p.name}`, M + 2, y);
    doc.text(fmtBRL(patientTotal), W - M - 2, y, { align: 'right' });
    y += 7;
  }

  // ── ORPHAN SERVICES ──
  if (orphanServices.length > 0) {
    ensure(12);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...accent);
    doc.text('Serviços sem paciente vinculado', M, y); y += 5;
    drawTableHeader();
    let orphanTotal = 0;
    orphanServices
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(s => {
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

  // ── GRAND TOTAL ──
  ensure(16);
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

  // ── FOOTER ──
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
