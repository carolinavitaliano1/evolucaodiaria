import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export interface PaymentReceiptOptions {
  therapistName: string;
  therapistCpf?: string | null;
  therapistAddress?: string | null;    // "residente e domiciliado em..."
  therapistProfessionalId?: string | null;
  therapistCbo?: string | null;
  therapistClinicalArea?: string | null;
  stamp?: {
    id: string;
    name: string;
    clinical_area: string;
    cbo?: string | null;
    stamp_image: string | null;
    signature_image: string | null;
  } | null;
  payerName: string;        // responsible name (if minor) or patient name
  payerCpf?: string | null; // responsible CPF (if minor) or patient CPF
  location?: string | null; // "Local" field, e.g. "São Paulo"
  amount: number;
  serviceName: string;      // e.g. "Psicologia"
  period: string;           // e.g. "março/2026"
  paymentMethod: string;    // e.g. "transferência bancária"
  paymentDate: string;      // e.g. "2026-03-15"
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return cpf;
}

export async function generatePaymentReceiptPdf(opts: PaymentReceiptOptions, returnBlob?: false): Promise<void>;
export async function generatePaymentReceiptPdf(opts: PaymentReceiptOptions, returnBlob?: true): Promise<Blob>;
export async function generatePaymentReceiptPdf(opts: PaymentReceiptOptions, returnBlob = false): Promise<void | Blob> {
  const { therapistName, therapistCpf, therapistAddress, therapistProfessionalId, therapistCbo, therapistClinicalArea, stamp,
    payerName, payerCpf, location, amount, serviceName, period, paymentMethod, paymentDate } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 20;
  const contentW = W - margin * 2;
  const darkText: [number, number, number] = [25, 25, 35];
  const mutedText: [number, number, number] = [100, 100, 115];
  const borderColor: [number, number, number] = [210, 210, 220];
  const accentColor: [number, number, number] = [40, 60, 120];

  let y = margin;

  const drawLine = () => {
    doc.setDrawColor(...borderColor);
    doc.line(margin, y, W - margin, y);
    y += 5;
  };

  // ── CABEÇALHO ────────────────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...accentColor);
  doc.text('RECIBO DE PAGAMENTO', margin, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  const emissao = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
  doc.text(`Emissão: ${emissao}`, W - margin, y, { align: 'right' });
  y += 5;
  drawLine();

  // ── CORPO DO RECIBO ───────────────────────────────────────────────────────
  y += 4;

  // Determine CPF/CNPJ label for therapist
  const therapistCpfFormatted = therapistCpf ? formatCpf(therapistCpf) : null;
  const payerCpfFormatted = payerCpf ? formatCpf(payerCpf) : null;
  const amountStr = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const payDateFormatted = paymentDate
    ? format(new Date(paymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
    : '___/___/______';

  // Build the declaration text
  const cpfLabel = therapistCpfFormatted ? `, inscrito(a) no CPF/CNPJ sob o número ${therapistCpfFormatted},` : '';
  const addressLabel = therapistAddress ? `, residente e domiciliado(a) em ${therapistAddress},` : '';
  const payerCpfLabel = payerCpfFormatted ? `, inscrito(a) no CPF sob o número ${payerCpfFormatted},` : '';

  const paragraph1 = `Eu, ${therapistName}${cpfLabel}${addressLabel} declaro para os devidos fins que recebi de ${payerName}${payerCpfLabel} a importância de R$ ${amountStr}, referente ao pagamento do serviço de ${serviceName}, realizado no período de ${period}.`;
  const paragraph2 = `A quantia foi paga através de ${paymentMethod} na data de ${payDateFormatted}.`;
  const paragraph3 = 'Por ser verdade, firmo o presente recibo.';

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkText);

  const p1Lines = doc.splitTextToSize(paragraph1, contentW);
  p1Lines.forEach((line: string) => { doc.text(line, margin, y); y += 6.5; });

  y += 3;
  const p2Lines = doc.splitTextToSize(paragraph2, contentW);
  p2Lines.forEach((line: string) => { doc.text(line, margin, y); y += 6.5; });

  y += 3;
  doc.text(paragraph3, margin, y);
  y += 6.5;

  y += 6;

  // "Local e data:" line
  doc.setFontSize(10);
  doc.setTextColor(...mutedText);
  const locationStr = location ? `${location}, ` : '';
  doc.text(`Local e data: ${locationStr}_______________, ____/____/________`, margin, y);
  y += 12;

  // ── ASSINATURA / CARIMBO ─────────────────────────────────────────────────
  const sigStamp = stamp || null;

  if (sigStamp?.signature_image) {
    try {
      const imgEl = document.createElement('img');
      imgEl.src = sigStamp.signature_image;
      await new Promise<void>(r => { imgEl.onload = () => r(); imgEl.onerror = () => r(); });
      let sw = 45; let sh = (imgEl.height / imgEl.width) * sw;
      if (sh > 12) { sh = 12; sw = (imgEl.width / imgEl.height) * sh; }
      doc.addImage(sigStamp.signature_image, 'PNG', margin, y, sw, sh, undefined, 'FAST');
      y += sh + 2;
    } catch { /* skip */ }
  }

  if (sigStamp?.stamp_image) {
    try {
      const imgEl2 = document.createElement('img');
      imgEl2.src = sigStamp.stamp_image;
      await new Promise<void>(r => { imgEl2.onload = () => r(); imgEl2.onerror = () => r(); });
      let sw = 40; let sh = (imgEl2.height / imgEl2.width) * sw;
      if (sh > 18) { sh = 18; sw = (imgEl2.width / imgEl2.height) * sh; }
      doc.addImage(sigStamp.stamp_image, 'PNG', margin, y, sw, sh, undefined, 'FAST');
      y += sh + 3;
    } catch { /* skip */ }
  }

  // Signature line
  doc.setDrawColor(...borderColor);
  doc.line(margin, y, margin + contentW * 0.55, y);
  y += 5;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.text(therapistName, margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mutedText);

  const area = sigStamp?.clinical_area || therapistClinicalArea;
  if (area) { doc.text(area, margin, y); y += 5; }
  if (therapistProfessionalId) { doc.text(`Registro: ${therapistProfessionalId}`, margin, y); y += 5; }
  if (therapistCpfFormatted) { doc.text(`CPF: ${therapistCpfFormatted}`, margin, y); y += 5; }
  const cboVal = sigStamp?.cbo || therapistCbo;
  if (cboVal) { doc.text(`CBO: ${cboVal}`, margin, y); y += 5; }

  // ── RODAPÉ ────────────────────────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text(
    `Recibo de Pagamento  ·  ${payerName}  ·  ${serviceName}  ·  Emitido em ${emissao}`,
    W / 2, 291, { align: 'center' }
  );

  const safePayer = payerName.replace(/\s+/g, '-').toLowerCase();
  const safeDate = paymentDate || format(new Date(), 'yyyy-MM-dd');

  if (returnBlob) {
    return doc.output('blob') as Blob;
  }

  doc.save(`recibo-pagamento-${safePayer}-${safeDate}.pdf`);
  toast.success('Recibo de pagamento gerado com sucesso!');
}

export async function generatePaymentReceiptWord(opts: PaymentReceiptOptions): Promise<void> {
  const { therapistName, therapistCpf, therapistAddress, therapistProfessionalId, therapistCbo, therapistClinicalArea, stamp,
    payerName, payerCpf, location, amount, serviceName, period, paymentMethod, paymentDate } = opts;

  const formatCpfLocal = (cpf: string) => {
    const d = cpf.replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return cpf;
  };

  const cpfLabel = therapistCpf ? `, inscrito(a) no CPF/CNPJ sob o número ${formatCpfLocal(therapistCpf)},` : '';
  const addressLabel = therapistAddress ? `, residente e domiciliado(a) em ${therapistAddress},` : '';
  const payerCpfLabel = payerCpf ? `, inscrito(a) no CPF sob o número ${formatCpfLocal(payerCpf)},` : '';
  const amountStr = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const payDateStr = paymentDate
    ? format(new Date(paymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
    : '___/___/______';
  const emissao = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
  const area = stamp?.clinical_area || therapistClinicalArea || '';
  const locationStr = location ? `${location}, ` : '';

  const html = `<html><body style="font-family:Arial,sans-serif;font-size:12pt;margin:48px;line-height:1.7">
    <h2 style="color:#1e3a8a;margin-bottom:4px">RECIBO DE PAGAMENTO</h2>
    <p style="color:#666;margin-top:0;font-size:9pt">Emissão: ${emissao}</p>
    <hr style="border:1px solid #ddd;margin:16px 0"/>
    <p style="text-align:justify">
      Eu, <strong>${therapistName}</strong>${cpfLabel}${addressLabel} declaro para os devidos fins que recebi de <strong>${payerName}</strong>${payerCpfLabel} a importância de <strong>R$ ${amountStr}</strong>, referente ao pagamento do serviço de <strong>${serviceName}</strong>, realizado no período de <strong>${period}</strong>.
    </p>
    <p style="text-align:justify">
      A quantia foi paga através de <strong>${paymentMethod}</strong> na data de <strong>${payDateStr}</strong>.
    </p>
    <p>Por ser verdade, firmo o presente recibo.</p>
    <br/>
    <p>Local e data: ${locationStr}_______________, ____/____/________</p>
    <br/><br/><br/>
    <p>___________________________</p>
    <p><strong>${therapistName}</strong></p>
    ${area ? `<p>${area}</p>` : ''}
    ${therapistProfessionalId ? `<p>Registro: ${therapistProfessionalId}</p>` : ''}
    ${therapistCpf ? `<p>CPF: ${formatCpfLocal(therapistCpf)}</p>` : ''}
    ${(stamp?.cbo || therapistCbo) ? `<p>CBO: ${stamp?.cbo || therapistCbo}</p>` : ''}
  </body></html>`;

  const { asBlob } = await import('html-docx-js-typescript');
  const blob = await asBlob(html) as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safePayer = payerName.replace(/\s+/g, '-').toLowerCase();
  const safeDate = paymentDate || format(new Date(), 'yyyy-MM-dd');
  a.download = `recibo-pagamento-${safePayer}-${safeDate}.docx`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Recibo Word gerado com sucesso!');
}

  const formatCpfLocal = (cpf: string) => {
    const d = cpf.replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return cpf;
  };

  const cpfLabel = therapistCpf ? `, inscrito(a) no CPF/CNPJ sob o número ${formatCpfLocal(therapistCpf)},` : '';
  const payerCpfLabel = payerCpf ? `, inscrito(a) no CPF sob o número ${formatCpfLocal(payerCpf)},` : '';
  const amountStr = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const payDateStr = paymentDate
    ? format(new Date(paymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
    : '___/___/______';
  const emissao = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
  const area = stamp?.clinical_area || therapistClinicalArea || '';

  const html = `<html><body style="font-family:Arial,sans-serif;font-size:12pt;margin:48px;line-height:1.7">
    <h2 style="color:#1e3a8a;margin-bottom:4px">RECIBO DE PAGAMENTO</h2>
    <p style="color:#666;margin-top:0;font-size:9pt">Emissão: ${emissao}</p>
    <hr style="border:1px solid #ddd;margin:16px 0"/>
    <p style="text-align:justify">
      Eu, <strong>${therapistName}</strong>${cpfLabel} declaro para os devidos fins que recebi de <strong>${payerName}</strong>${payerCpfLabel} a importância de <strong>R$ ${amountStr}</strong>, referente ao pagamento do serviço de <strong>${serviceName}</strong>, realizado no período de <strong>${period}</strong>.
    </p>
    <p style="text-align:justify">
      A quantia foi paga através de <strong>${paymentMethod}</strong> na data de <strong>${payDateStr}</strong>.
    </p>
    <p>Por ser verdade, firmo o presente recibo.</p>
    <br/>
    <p>Local e data: _____________________________________________</p>
    <br/><br/><br/>
    <p>___________________________</p>
    <p><strong>${therapistName}</strong></p>
    ${area ? `<p>${area}</p>` : ''}
    ${therapistProfessionalId ? `<p>Registro: ${therapistProfessionalId}</p>` : ''}
    ${therapistCpf ? `<p>CPF: ${formatCpfLocal(therapistCpf)}</p>` : ''}
    ${(stamp?.cbo || therapistCbo) ? `<p>CBO: ${stamp?.cbo || therapistCbo}</p>` : ''}
  </body></html>`;

  const { asBlob } = await import('html-docx-js-typescript');
  const blob = await asBlob(html) as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safePayer = payerName.replace(/\s+/g, '-').toLowerCase();
  const safeDate = paymentDate || format(new Date(), 'yyyy-MM-dd');
  a.download = `recibo-pagamento-${safePayer}-${safeDate}.docx`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Recibo Word gerado com sucesso!');
}
