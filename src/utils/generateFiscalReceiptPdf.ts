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
  presente:               { label: 'Presente',           billable: true },
  reposicao:              { label: 'Reposição',          billable: true },
  falta_remunerada:       { label: 'Falta Remunerada',   billable: true },
  feriado_remunerado:     { label: 'Feriado Remunerado', billable: true },
  falta:                  { label: 'Falta',              billable: false },
  feriado_nao_remunerado: { label: 'Feriado',            billable: false },
};

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return cpf;
}

export async function generateFiscalReceiptPdf(opts: FiscalReceiptOptions, returnBlob?: false): Promise<void>;
export async function generateFiscalReceiptPdf(opts: FiscalReceiptOptions, returnBlob?: true): Promise<Blob>;
export async function generateFiscalReceiptPdf(opts: FiscalReceiptOptions, returnBlob = false): Promise<void | Blob> {
  const { patient, clinic, evolutions, startDate, endDate, stamp, therapistName, professionalId, therapistCpf, cbo, totalPaid, paymentStatus, paymentDate } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 18;
  const contentW = W - margin * 2;

  const darkText:    [number, number, number] = [20, 20, 30];
  const mutedText:   [number, number, number] = [110, 110, 125];
  const borderColor: [number, number, number] = [210, 210, 220];
  const accentColor: [number, number, number] = [35, 55, 115];
  const successColor:[number, number, number] = [30, 130, 30];
  const warningColor:[number, number, number] = [175, 95, 0];

  const LH  = 4.8;   // normal line height
  const LHS = 4.2;   // small line height
  const LABEL_W = 46;

  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > 276) { doc.addPage(); y = margin; }
  };

  const drawDivider = (gapBefore = 3, gapAfter = 4) => {
    y += gapBefore;
    doc.setDrawColor(...borderColor);
    doc.line(margin, y, W - margin, y);
    y += gapAfter;
  };

  const sectionTitle = (text: string) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accentColor);
    doc.text(text, margin, y);
    y += LH + 1;
  };

  // label:value in two columns
  const lv = (label: string, value: string) => {
    ensureSpace(LH + 1);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedText);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    const maxW = contentW - LABEL_W;
    const lines = doc.splitTextToSize(value, maxW);
    doc.text(lines, margin + LABEL_W, y);
    y += Math.max(1, lines.length) * LH;
  };

  // ─── CABEÇALHO ──────────────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('EXTRATO FINANCEIRO', margin, y);

  const periodLabel = `${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text(`Período: ${periodLabel}   ·   Emissão: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`, margin, y + 5);
  y += 10;
  drawDivider(0, 4);

  // ─── TOMADOR DO SERVIÇO ─────────────────────────────────────────────────
  sectionTitle('TOMADOR DO SERVIÇO');

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

  lv('Nome:', patient.name);
  if (patient.cpf) lv(isMinor ? 'CPF do Paciente:' : 'CPF:', formatCpf(patient.cpf));
  if (patient.birthdate) {
    const bdStr = format(new Date(patient.birthdate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    lv('Nascimento:', `${bdStr}${patientAge !== null ? ` (${patientAge} anos)` : ''}`);
  }
  if (patient.phone) lv('Telefone:', patient.phone);

  if (patient.responsibleName || isMinor) {
    y += 1;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...mutedText);
    doc.text('Responsável Legal:', margin, y);
    y += LHS + 1;
    if (patient.responsibleName) lv('Nome:', patient.responsibleName);
    if (patient.responsible_cpf) lv(isMinor ? 'CPF (NF):' : 'CPF:', formatCpf(patient.responsible_cpf));
    if (patient.responsibleEmail) lv('E-mail:', patient.responsibleEmail);
  }

  drawDivider(2, 4);

  // ─── PRESTADOR DE SERVIÇO ───────────────────────────────────────────────
  sectionTitle('PRESTADOR DE SERVIÇO');

  if (therapistName)        lv('Nome:', therapistName);
  if (professionalId)       lv('Registro:', professionalId);
  if (therapistCpf)         lv('CPF:', formatCpf(therapistCpf));
  if (cbo)                  lv('CBO:', cbo);
  if (stamp?.clinical_area) lv('Área:', stamp.clinical_area);
  if (clinic?.name)         lv('Clínica:', clinic.name);
  if (clinic?.cnpj)         lv('CNPJ:', formatCpf(clinic.cnpj));
  if (clinic?.address)      lv('Endereço:', clinic.address);
  if (clinic?.phone)        lv('Telefone:', clinic.phone);
  if (clinic?.email)        lv('E-mail:', clinic.email);

  drawDivider(2, 4);

  // ─── DETALHAMENTO DAS SESSÕES ───────────────────────────────────────────
  const areaLabel   = patient.clinicalArea || stamp?.clinical_area || 'Atendimento';
  const areaDisplay = areaLabel.length > 28 ? areaLabel.substring(0, 27) + '…' : areaLabel;
  const paymentValue = patient.paymentValue || 0;

  sectionTitle(`DETALHAMENTO DAS SESSÕES (${evolutions.length})`);

  // table columns
  const c1 = margin, c2 = margin + 28, c3 = margin + 88, c4 = W - margin - 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('Data',                  c1, y);
  doc.text('Área / Serviço',        c2, y);
  doc.text('Status',                c3, y);
  doc.text('Valor',                 c4, y, { align: 'right' });
  y += 2.5;
  doc.setDrawColor(...borderColor);
  doc.line(margin, y, W - margin, y);
  y += 4;

  let sessionTotal = 0;
  let sessionCount = 0;

  doc.setFont('helvetica', 'normal');
  for (const evo of evolutions) {
    ensureSpace(LH + 1);
    const st = STATUS_LABELS[evo.attendanceStatus] ?? { label: evo.attendanceStatus, billable: false };
    const sessionValue = st.billable && patient.paymentType !== 'fixo' ? paymentValue : 0;
    const dateStr = format(new Date(evo.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });

    doc.setFontSize(8.5);
    doc.setTextColor(...darkText);
    doc.text(dateStr, c1, y);
    doc.text(areaDisplay, c2, y);
    doc.setTextColor(st.billable ? darkText[0] : mutedText[0], st.billable ? darkText[1] : mutedText[1], st.billable ? darkText[2] : mutedText[2]);
    doc.text(st.label, c3, y);
    doc.setTextColor(sessionValue > 0 ? darkText[0] : mutedText[0], sessionValue > 0 ? darkText[1] : mutedText[1], sessionValue > 0 ? darkText[2] : mutedText[2]);
    doc.text(sessionValue > 0 ? `R$ ${sessionValue.toFixed(2)}` : '—', c4, y, { align: 'right' });
    y += LH + 0.5;

    if (st.billable) { sessionTotal += sessionValue; sessionCount++; }
  }

  if (patient.paymentType === 'fixo' && paymentValue > 0) {
    sessionTotal  = paymentValue;
    sessionCount  = evolutions.filter(e => STATUS_LABELS[e.attendanceStatus]?.billable).length;
  }

  // ─── RESUMO FINANCEIRO ──────────────────────────────────────────────────
  ensureSpace(38);
  drawDivider(2, 4);
  sectionTitle('RESUMO FINANCEIRO');

  const summaryRows: [string, string][] = patient.paymentType === 'fixo'
    ? [
        ['Modalidade:', 'Mensalidade fixa'],
        ['Sessões realizadas:', String(sessionCount)],
        ['Valor da mensalidade:', `R$ ${paymentValue.toFixed(2)}`],
      ]
    : [
        ['Modalidade:', 'Por sessão'],
        ['Sessões cobráveis:', String(sessionCount)],
        ['Valor por sessão:', `R$ ${paymentValue.toFixed(2)}`],
      ];

  const displayTotal = totalPaid !== undefined ? totalPaid : sessionTotal;
  summaryRows.push(['TOTAL DO PERÍODO:', `R$ ${displayTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]);

  summaryRows.forEach(([label, value], i) => {
    ensureSpace(LH + 1);
    const isTotal = i === summaryRows.length - 1;
    doc.setFontSize(isTotal ? 9.5 : 8.5);
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.setTextColor(...(isTotal ? darkText : mutedText));
    doc.text(label, margin + 2, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(isTotal ? accentColor : darkText));
    doc.text(value, W - margin - 2, y, { align: 'right' });
    y += isTotal ? LH + 1.5 : LH;
  });

  // payment status
  ensureSpace(10);
  y += 1;
  const statusText  = paymentStatus === 'paid' ? 'PAGO' : paymentStatus === 'partial' ? 'PARCIALMENTE PAGO' : 'PENDENTE';
  const statusColor: [number, number, number] = paymentStatus === 'paid' ? successColor : warningColor;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...statusColor);
  doc.text(`Status: ${statusText}`, margin + 2, y);
  if (paymentDate && paymentStatus === 'paid') {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    const lw = doc.getTextWidth(`Status: ${statusText}`);
    doc.text(`   ·   Recebido em: ${format(new Date(paymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`, margin + 2 + lw, y);
  }
  y += LH;

  // ─── DECLARAÇÃO ─────────────────────────────────────────────────────────
  drawDivider(3, 4);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  const declaration = `Declaro, para os devidos fins fiscais e legais, que prestei os serviços de ${areaLabel.toLowerCase()} ao(à) paciente ${patient.name} conforme sessões discriminadas neste documento, no período de ${periodLabel}.`;
  const declLines   = doc.splitTextToSize(declaration, contentW);
  const declH       = declLines.length * LH + 2;
  ensureSpace(declH);
  declLines.forEach((line: string) => { doc.text(line, margin, y); y += LH; });

  // ─── BLOCO DE ASSINATURA ─────────────────────────────────────────────────
  // Layout (coluna esquerda):
  //   1. Carimbo (stamp) — acima da rubrica
  //   2. Rubrica (assinatura) — imediatamente abaixo do carimbo, acima da linha
  //   3. Linha de assinatura
  //   4. Nome + credenciais

  type ImgInfo = { src: string; w: number; h: number } | null;
  let sigInfo: ImgInfo = null;
  let stInfo:  ImgInfo = null;

  if (stamp?.signature_image) {
    try {
      const el = document.createElement('img');
      el.src   = stamp.signature_image;
      await new Promise<void>(r => { el.onload = () => r(); el.onerror = () => r(); });
      let sw = 38, sh = (el.height / el.width) * sw;
      if (sh > 13) { sh = 13; sw = (el.width / el.height) * sh; }
      sigInfo = { src: stamp.signature_image, w: sw, h: sh };
    } catch { /* skip */ }
  }
  if (stamp?.stamp_image) {
    try {
      const el = document.createElement('img');
      el.src   = stamp.stamp_image;
      await new Promise<void>(r => { el.onload = () => r(); el.onerror = () => r(); });
      let sw = 38, sh = (el.height / el.width) * sw;
      if (sh > 18) { sh = 18; sw = (el.width / el.height) * sh; }
      stInfo = { src: stamp.stamp_image, w: sw, h: sh };
    } catch { /* skip */ }
  }

  // Carimbo + rubrica + 3mm de gap antes da linha + credenciais
  const stampH     = stInfo  ? stInfo.h  : 0;
  const sigH       = sigInfo ? sigInfo.h : 0;
  const aboveLineH = stampH + sigH + 3; // 3mm de respiro antes da linha
  const credRows   = 1 + (stamp?.clinical_area ? 1 : 0) + (professionalId ? 1 : 0) + (therapistCpf ? 1 : 0) + (cbo ? 1 : 0);
  const blockH     = aboveLineH + 4 + credRows * LHS + 2;

  ensureSpace(blockH + 5);
  y += 4;

  // 1. Carimbo — topo do bloco, esquerda
  if (stInfo) {
    doc.addImage(stInfo.src, 'PNG', margin, y, stInfo.w, stInfo.h, undefined, 'FAST');
    y += stInfo.h;
  }

  // 2. Rubrica — logo abaixo do carimbo, sem gap
  if (sigInfo) {
    doc.addImage(sigInfo.src, 'PNG', margin, y, sigInfo.w, sigInfo.h, undefined, 'FAST');
    y += sigInfo.h;
  }

  // 3. Linha de assinatura — 3mm abaixo da rubrica (respiro visual)
  y += 3;
  doc.setDrawColor(...borderColor);
  doc.line(margin, y, margin + contentW * 0.62, y);
  y += 4;

  // 4. Nome e credenciais
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.text(therapistName || '________________________________', margin, y);
  y += LHS + 1;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  if (stamp?.clinical_area) { doc.text(stamp.clinical_area,               margin, y); y += LHS; }
  if (professionalId)        { doc.text(`Registro: ${professionalId}`,     margin, y); y += LHS; }
  if (therapistCpf)          { doc.text(`CPF: ${formatCpf(therapistCpf)}`, margin, y); y += LHS; }
  if (cbo)                   { doc.text(`CBO: ${cbo}`,                     margin, y); y += LHS; }

  y += 4;

  // ─── RODAPÉ ─────────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedText);
    doc.text(
      `${patient.name}  ·  Extrato Financeiro  ·  ${periodLabel}  ·  Emitido em ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}  ·  Pág. ${p}/${pageCount}`,
      W / 2, 291, { align: 'center' }
    );
  }

  const safeName  = patient.name.replace(/\s+/g, '-').toLowerCase();
  const safeStart = format(startDate, 'yyyy-MM-dd');
  const safeEnd   = format(endDate,   'yyyy-MM-dd');

  if (returnBlob) return doc.output('blob') as Blob;

  doc.save(`extrato-financeiro-${safeName}-${safeStart}_${safeEnd}.pdf`);
  toast.success('Extrato financeiro gerado com sucesso!');
}
