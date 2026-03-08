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
    cbo?: string | null;
    stamp_image: string | null;
    signature_image: string | null;
  } | null;
  therapistName?: string;
  professionalId?: string;
  therapistCpf?: string;
  cbo?: string;
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

const LINE_H = 5.5;      // standard line height (mm)
const LABEL_W = 50;      // fixed label column width (mm)

export async function generateFiscalReceiptPdf(opts: FiscalReceiptOptions, returnBlob?: false): Promise<void>;
export async function generateFiscalReceiptPdf(opts: FiscalReceiptOptions, returnBlob?: true): Promise<Blob>;
export async function generateFiscalReceiptPdf(opts: FiscalReceiptOptions, returnBlob = false): Promise<void | Blob> {
  const { patient, clinic, evolutions, startDate, endDate, stamp, therapistName, professionalId, therapistCpf, cbo, totalPaid, paymentStatus, paymentDate } = opts;

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
    if (y + needed > 279) { doc.addPage(); y = margin; }
  };

  const drawLine = () => {
    doc.setDrawColor(...borderColor);
    doc.line(margin, y, W - margin, y);
    y += 5;
  };

  // Render a label:value row where label is bold left and value is normal, wrapping properly
  const labelValue = (label: string, value: string) => {
    ensureSpace(7);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkText);
    doc.text(label, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    const maxValueW = contentW - LABEL_W;
    const wrapped = doc.splitTextToSize(value, maxValueW);
    doc.text(wrapped, margin + LABEL_W, y);

    // Advance by however many lines the value takes
    y += Math.max(1, wrapped.length) * LINE_H + 0.5;
  };

  // ── CABEÇALHO ────────────────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('RECIBO DE ATENDIMENTO', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  const periodLabel = `${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`;
  doc.text(`Período: ${periodLabel}   ·   Emissão: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`, margin, y);
  y += 4;
  drawLine();

  // ── DADOS DO PACIENTE / TOMADOR DO SERVIÇO ─────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('TOMADOR DO SERVIÇO', margin, y);
  y += 6;

  // Determine age to decide which CPF goes on the fiscal document
  const patientAge = (() => {
    if (!patient.birthdate) return null;
    try {
      const b = new Date(patient.birthdate + 'T12:00:00');
      let a = new Date().getFullYear() - b.getFullYear();
      const m = new Date().getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && new Date().getDate() < b.getDate())) a--;
      return a;
    } catch { return null; }
  })();
  const isMinor = patientAge !== null && patientAge < 18;

  labelValue('Nome:', patient.name);
  // Show patient CPF always (for registration), but note if minor
  if (patient.cpf) {
    const cpfLabel = isMinor ? 'CPF do Paciente:' : 'CPF:';
    labelValue(cpfLabel, formatCpf(patient.cpf));
  }
  if (patient.birthdate) {
    const bdStr = format(new Date(patient.birthdate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    labelValue('Nascimento:', `${bdStr}${patientAge !== null ? ` (${patientAge} anos)` : ''}`);
  }
  if (patient.phone) labelValue('Telefone:', patient.phone);

  // Responsável Legal — obrigatório para menores, exibido quando informado
  if (patient.responsibleName || isMinor) {
    y += 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedText);
    doc.text(isMinor ? 'Responsável Legal (Pagador — menor de idade):' : 'Responsável Legal:', margin, y);
    y += 5;
    if (patient.responsibleName) labelValue('Nome:', patient.responsibleName);
    if (patient.responsible_cpf) {
      labelValue(isMinor ? 'CPF (Nota Fiscal):' : 'CPF:', formatCpf(patient.responsible_cpf));
    }
    if (patient.responsibleEmail) labelValue('E-mail:', patient.responsibleEmail);
  }

  y += 2;
  drawLine();

  // ── DADOS DO PRESTADOR DE SERVIÇO ─────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('PRESTADOR DE SERVIÇO', margin, y);
  y += 6;

  if (therapistName) labelValue('Nome:', therapistName);
  if (professionalId) labelValue('Registro:', professionalId);
  if (therapistCpf) labelValue('CPF:', formatCpf(therapistCpf));
  if (cbo) labelValue('CBO:', cbo);
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
  y += 7;

  // Table header
  const c1 = margin, c2 = margin + 32, c3 = margin + 92, c4 = W - margin - 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
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
  const areaDisplay = areaLabel.length > 26 ? areaLabel.substring(0, 25) + '…' : areaLabel;

  doc.setFont('helvetica', 'normal');
  for (const evo of evolutions) {
    ensureSpace(7);
    const st = STATUS_LABELS[evo.attendanceStatus] ?? { label: evo.attendanceStatus, billable: false };
    const sessionValue = st.billable && patient.paymentType !== 'fixo' ? paymentValue : 0;
    const dateStr = format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });

    doc.setFontSize(9);
    doc.setTextColor(...darkText);
    doc.text(dateStr, c1, y);
    doc.text(areaDisplay, c2, y);

    if (st.billable) doc.setTextColor(...darkText);
    else doc.setTextColor(...mutedText);
    doc.text(st.label, c3, y);

    doc.setTextColor(
      sessionValue > 0 ? darkText[0] : mutedText[0],
      sessionValue > 0 ? darkText[1] : mutedText[1],
      sessionValue > 0 ? darkText[2] : mutedText[2],
    );
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
  ensureSpace(45);
  y += 2;
  doc.setDrawColor(...borderColor);
  doc.line(margin, y, W - margin, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('RESUMO FINANCEIRO', margin, y);
  y += 6;

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
    ensureSpace(7);
    const isTotal = i === summaryRows.length - 1;
    doc.setFontSize(isTotal ? 10.5 : 9.5);
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.setTextColor(...(isTotal ? darkText : mutedText));
    doc.text(label, margin + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(isTotal ? accentColor : darkText));
    doc.text(value, W - margin - 2, y, { align: 'right' });
    y += isTotal ? 7 : 5.5;
  });

  // Payment status badge
  ensureSpace(12);
  y += 2;
  const statusText = paymentStatus === 'paid' ? 'PAGO'
    : paymentStatus === 'partial' ? 'PARCIALMENTE PAGO'
    : 'PENDENTE';
  const statusColor: [number, number, number] = paymentStatus === 'paid' ? successColor : warningColor;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...statusColor);
  doc.text(`Status: ${statusText}`, margin + 4, y);
  if (paymentDate && paymentStatus === 'paid') {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    const labelW = doc.getTextWidth(`Status: ${statusText}`);
    doc.text(`   ·   Recebido em: ${format(new Date(paymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`, margin + 4 + labelW, y);
  }
  y += 7;

  drawLine();

  // ── DECLARAÇÃO / ASSINATURA ───────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  const declaration = `Declaro, para os devidos fins fiscais e legais, que prestei os serviços de ${areaLabel.toLowerCase()} ao(à) paciente ${patient.name} conforme sessões discriminadas neste documento, no período de ${periodLabel}.`;
  const declLines = doc.splitTextToSize(declaration, contentW);
  declLines.forEach((line: string) => { ensureSpace(6); doc.text(line, margin, y); y += 5; });
  y += 5;

  // Signature block — estimate height to avoid orphan on new page
  const hasSig = !!stamp?.signature_image;
  const hasStampImg = !!stamp?.stamp_image;
  const sigEstH = (hasSig ? 22 : 0) + (hasStampImg ? 22 : 0) + 6 + 6 + 5 + 5 + 5 + 5;
  ensureSpace(sigEstH);

  if (stamp?.signature_image) {
    try {
      const imgEl = document.createElement('img');
      imgEl.src = stamp.signature_image;
      await new Promise<void>(r => { imgEl.onload = () => r(); imgEl.onerror = () => r(); });
      let sw = 45; let sh = (imgEl.height / imgEl.width) * sw;
      if (sh > 12) { sh = 12; sw = (imgEl.width / imgEl.height) * sh; }
      doc.addImage(stamp.signature_image, 'PNG', margin, y, sw, sh, undefined, 'FAST');
      y += sh + 2;
    } catch { /* skip */ }
  }
  if (stamp?.stamp_image) {
    try {
      const imgEl2 = document.createElement('img');
      imgEl2.src = stamp.stamp_image;
      await new Promise<void>(r => { imgEl2.onload = () => r(); imgEl2.onerror = () => r(); });
      let sw = 40; let sh = (imgEl2.height / imgEl2.width) * sw;
      if (sh > 18) { sh = 18; sw = (imgEl2.width / imgEl2.height) * sh; }
      doc.addImage(stamp.stamp_image, 'PNG', margin, y, sw, sh, undefined, 'FAST');
      y += sh + 3;
    } catch { /* skip */ }
  }
  doc.setDrawColor(...borderColor);
  doc.line(margin, y, margin + contentW * 0.55, y);
  y += 5;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.text(therapistName || '________________________________', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedText);
  if (stamp?.clinical_area) { doc.text(stamp.clinical_area, margin, y); y += 5; }
  if (professionalId) { doc.text(`Registro: ${professionalId}`, margin, y); y += 5; }
  if (therapistCpf) { doc.text(`CPF: ${formatCpf(therapistCpf)}`, margin, y); y += 5; }
  if (cbo) { doc.text(`CBO: ${cbo}`, margin, y); y += 5; }

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

  if (returnBlob) {
    return doc.output('blob') as Blob;
  }

  doc.save(`recibo-fiscal-${safeName}-${safeStart}_${safeEnd}.pdf`);
  toast.success('Recibo fiscal gerado com sucesso!');
}
