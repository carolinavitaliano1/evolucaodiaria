import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export interface FiscalReceiptOptions {
  patient: {
    id: string;
    name: string;
    birthdate?: string;
    cpf?: string;
    phone?: string;
    clinicalArea?: string;
    responsibleName?: string;
    responsibleEmail?: string;
    responsible_cpf?: string;
    paymentType?: string;
    paymentValue?: number;
  };
  clinic?: {
    name?: string;
    cnpj?: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  evolutions: Array<{
    id: string;
    date: string;
    attendanceStatus: string;
    text?: string;
  }>;
  startDate: Date;
  endDate: Date;
  stamp?: {
    id: string;
    name: string;
    clinical_area: string;
    stamp_image: string | null;
    signature_image: string | null;
  } | null;
  therapistName?: string;
  professionalId?: string;
  totalPaid?: number;
  paymentStatus?: 'paid' | 'pending' | 'partial';
  paymentDate?: string | null;
}

const STATUS_LABELS: Record<string, { label: string; billable: boolean }> = {
  presente:               { label: 'Presente',            billable: true },
  reposicao:              { label: 'Reposição',           billable: true },
  falta_remunerada:       { label: 'Falta Remunerada',    billable: true },
  feriado_remunerado:     { label: 'Feriado Remunerado',  billable: true },
  falta:                  { label: 'Falta',               billable: false },
  feriado_nao_remunerado: { label: 'Feriado',             billable: false },
};

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return cpf;
}

export async function generateFiscalReceiptPdf(opts: FiscalReceiptOptions): Promise<void> {
  const { patient, clinic, evolutions, startDate, endDate, stamp, therapistName, professionalId, totalPaid, paymentStatus, paymentDate } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 20;
  const contentW = W - margin * 2;
  const darkText: [number, number, number] = [25, 25, 35];
  const mutedText: [number, number, number] = [100, 100, 115];
  const borderColor: [number, number, number] = [210, 210, 220];
  const accentColor: [number, number, number] = [40, 60, 120];
  const successColor: [number, number, number] = [34, 139, 34];
  const warningColor: [number, number, number] = [180, 100, 0];

  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > 272) { doc.addPage(); y = margin; }
  };

  const drawLine = () => {
    doc.setDrawColor(...borderColor);
    doc.line(margin, y, W - margin, y);
    y += 6;
  };

  const labelValue = (label: string, value: string, indented = false) => {
    const x = indented ? margin + 4 : margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...darkText);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    const wrapped = doc.splitTextToSize(value, contentW - 50);
    doc.text(wrapped, x + 48, y);
    y += wrapped.length > 1 ? wrapped.length * 5.2 + 1 : 6;
  };

  // ── CABEÇALHO ────────────────────────────────────────────────────────────
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('RECIBO DE ATENDIMENTO', margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  const periodLabel = `${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`;
  doc.text(`Período: ${periodLabel}   ·   Emissão: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`, margin, y);
  y += 5;
  drawLine();

  // ── DADOS DO PACIENTE / TOMADOR DO SERVIÇO ─────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('TOMADOR DO SERVIÇO', margin, y);
  y += 7;

  labelValue('Nome:', patient.name);
  if (patient.cpf) labelValue('CPF/CNPJ:', formatCpf(patient.cpf));
  if (patient.birthdate) {
    const age = (() => {
      try {
        const b = new Date(patient.birthdate + 'T12:00:00');
        let a = new Date().getFullYear() - b.getFullYear();
        const m = new Date().getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && new Date().getDate() < b.getDate())) a--;
        return a;
      } catch { return null; }
    })();
    const bdStr = format(new Date(patient.birthdate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    labelValue('Nascimento:', `${bdStr}${age !== null ? ` (${age} anos)` : ''}`);
  }
  if (patient.phone) labelValue('Telefone:', patient.phone);

  // Responsável (menor de idade)
  if (patient.responsibleName) {
    y += 2;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedText);
    doc.text('Responsável Legal:', margin, y);
    y += 5;
    labelValue('Nome:', patient.responsibleName);
    if (patient.responsible_cpf) labelValue('CPF:', formatCpf(patient.responsible_cpf));
    if (patient.responsibleEmail) labelValue('E-mail:', patient.responsibleEmail);
  }

  y += 2;
  drawLine();

  // ── DADOS DO PRESTADOR DE SERVIÇO ─────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('PRESTADOR DE SERVIÇO', margin, y);
  y += 7;

  if (therapistName) labelValue('Nome:', therapistName);
  if (professionalId) labelValue('Registro:', professionalId);
  if (stamp?.clinical_area) labelValue('Área:', stamp.clinical_area);
  if (clinic?.name) labelValue('Clínica:', clinic.name);
  if (clinic?.cnpj) labelValue('CNPJ:', formatCpf(clinic.cnpj));
  if (clinic?.address) labelValue('Endereço:', clinic.address);
  if (clinic?.phone) labelValue('Telefone:', clinic.phone);
  if (clinic?.email) labelValue('E-mail:', clinic.email);

  y += 2;
  drawLine();

  // ── DETALHAMENTO DAS SESSÕES ───────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text(`DETALHAMENTO DAS SESSÕES (${evolutions.length})`, margin, y);
  y += 8;

  // Table header
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  const c1 = margin, c2 = margin + 30, c3 = margin + 90, c4 = W - margin - 5;
  doc.text('Data', c1, y);
  doc.text('Área Clínica / Serviço', c2, y);
  doc.text('Status', c3, y);
  doc.text('Valor', c4, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(...borderColor);
  doc.line(margin, y, W - margin, y);
  y += 5;

  let sessionTotal = 0;
  let sessionCount = 0;

  const paymentValue = patient.paymentValue || 0;
  const areaLabel = patient.clinicalArea || stamp?.clinical_area || 'Atendimento';

  doc.setFont('helvetica', 'normal');
  for (const evo of evolutions) {
    ensureSpace(8);
    const st = STATUS_LABELS[evo.attendanceStatus] ?? { label: evo.attendanceStatus, billable: false };
    const sessionValue = st.billable && patient.paymentType !== 'fixo' ? paymentValue : 0;
    const dateStr = format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });

    doc.setFontSize(8.5);
    doc.setTextColor(...darkText);
    doc.text(dateStr, c1, y);
    doc.text(areaLabel.length > 25 ? areaLabel.substring(0, 24) + '…' : areaLabel, c2, y);
    if (st.billable) doc.setTextColor(...darkText);
    else doc.setTextColor(...mutedText);
    doc.text(st.label, c3, y);
    doc.setTextColor(sessionValue > 0 ? darkText[0] : mutedText[0], sessionValue > 0 ? darkText[1] : mutedText[1], sessionValue > 0 ? darkText[2] : mutedText[2]);
    doc.text(sessionValue > 0 ? `R$ ${sessionValue.toFixed(2)}` : '—', c4, y, { align: 'right' });
    y += 6;

    if (st.billable) { sessionTotal += sessionValue; sessionCount++; }
  }

  // Fixed monthly patients
  if (patient.paymentType === 'fixo' && paymentValue > 0) {
    const billableCount = evolutions.filter(e => STATUS_LABELS[e.attendanceStatus]?.billable).length;
    sessionTotal = paymentValue;
    sessionCount = billableCount;
  }

  // ── RESUMO FINANCEIRO ─────────────────────────────────────────────────
  ensureSpace(40);
  y += 2;
  doc.setDrawColor(...borderColor);
  doc.line(margin, y, W - margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('RESUMO FINANCEIRO', margin, y);
  y += 7;

  const summaryRows: [string, string][] = [];
  if (patient.paymentType === 'fixo') {
    summaryRows.push(['Modalidade de Pagamento:', 'Mensalidade fixa']);
    summaryRows.push(['Sessões realizadas no período:', String(sessionCount)]);
    summaryRows.push(['Valor da mensalidade:', `R$ ${paymentValue.toFixed(2)}`]);
  } else {
    summaryRows.push(['Modalidade de Pagamento:', 'Por sessão']);
    summaryRows.push(['Sessões cobráveis:', String(sessionCount)]);
    summaryRows.push(['Valor por sessão:', `R$ ${paymentValue.toFixed(2)}`]);
  }

  const displayTotal = totalPaid !== undefined ? totalPaid : sessionTotal;
  summaryRows.push(['TOTAL DO PERÍODO:', `R$ ${displayTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]);

  summaryRows.forEach(([label, value], i) => {
    const isTotal = i === summaryRows.length - 1;
    doc.setFontSize(isTotal ? 10.5 : 9);
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.setTextColor(...(isTotal ? darkText : mutedText));
    doc.text(label, margin + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(isTotal ? accentColor : darkText));
    doc.text(value, W - margin - 2, y, { align: 'right' });
    y += isTotal ? 7 : 6;
  });

  // Payment status badge
  ensureSpace(14);
  y += 2;
  const statusText = paymentStatus === 'paid' ? '✓ PAGO'
    : paymentStatus === 'partial' ? '~ PARCIALMENTE PAGO'
    : '⏳ PENDENTE';
  const statusColor: [number, number, number] = paymentStatus === 'paid' ? successColor
    : paymentStatus === 'partial' ? warningColor
    : warningColor;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...statusColor);
  doc.text(`Status: ${statusText}`, margin + 4, y);
  if (paymentDate && paymentStatus === 'paid') {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    doc.text(`   ·   Recebido em: ${format(new Date(paymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`, margin + 4 + doc.getTextWidth(`Status: ${statusText}`), y);
  }
  y += 8;

  drawLine();

  // ── DECLARAÇÃO / ASSINATURA ───────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  const declaration = `Declaro, para os devidos fins fiscais e legais, que prestei os serviços de ${areaLabel.toLowerCase()} ao(à) paciente ${patient.name} conforme sessões discriminadas neste documento, no período de ${periodLabel}.`;
  const declLines = doc.splitTextToSize(declaration, contentW);
  declLines.forEach((line: string) => { ensureSpace(6); doc.text(line, margin, y); y += 5.5; });
  y += 6;

  // Signature block
  ensureSpace(70);
  if (stamp?.signature_image) {
    try {
      doc.addImage(stamp.signature_image, 'PNG', margin, y, 55, 18, undefined, 'FAST');
      y += 20;
    } catch { /* skip */ }
  }
  if (stamp?.stamp_image) {
    try {
      doc.addImage(stamp.stamp_image, 'PNG', margin, y, 38, 38, undefined, 'FAST');
      y += 40;
    } catch { /* skip */ }
  }
  doc.setDrawColor(...borderColor);
  doc.line(margin, y, margin + contentW * 0.55, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.text(therapistName || '________________________________', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  if (stamp?.clinical_area) { doc.text(stamp.clinical_area, margin, y); y += 4.5; }
  if (professionalId) { doc.text(`Registro: ${professionalId}`, margin, y); y += 4.5; }

  // ── RODAPÉ ───────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    doc.text(
      `${patient.name}  ·  Recibo de Atendimento  ·  ${periodLabel}  ·  Emitido em ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}  ·  Pág. ${p}/${pageCount}`,
      W / 2, 291, { align: 'center' }
    );
  }

  const safeName = patient.name.replace(/\s+/g, '-').toLowerCase();
  const safeStart = format(startDate, 'yyyy-MM-dd');
  const safeEnd = format(endDate, 'yyyy-MM-dd');
  doc.save(`recibo-fiscal-${safeName}-${safeStart}_${safeEnd}.pdf`);
  toast.success('Recibo fiscal gerado com sucesso!');
}
