import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export interface PaymentReceiptOptions {
  therapistName: string;
  therapistCpf?: string | null;
  therapistAddress?: string | null;
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
  payerName: string;
  payerCpf?: string | null;
  location?: string | null;
  amount: number;
  serviceName: string;
  period: string;
  paymentMethod: string;
  paymentDate: string;
  clinicName?: string | null;
  clinicAddress?: string | null;
  clinicCnpj?: string | null;
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
  const { therapistName, therapistCpf, therapistAddress, therapistProfessionalId, therapistCbo,
    therapistClinicalArea, stamp, payerName, payerCpf, location, amount, serviceName, period,
    paymentMethod, paymentDate, clinicName, clinicAddress, clinicCnpj } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, margin = 20, contentW = W - margin * 2;
  const darkText: [number, number, number] = [25, 25, 35];
  const mutedText: [number, number, number] = [100, 100, 115];
  const borderColor: [number, number, number] = [210, 210, 220];
  const accentColor: [number, number, number] = [40, 60, 120];
  let y = margin;

  const drawLine = () => { doc.setDrawColor(...borderColor); doc.line(margin, y, W - margin, y); y += 5; };

  // Header
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentColor);
  doc.text('RECIBO DE PAGAMENTO', margin, y);
  const emissao = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
  doc.text(`Emissão: ${emissao}`, W - margin, y, { align: 'right' });
  y += 5; drawLine(); y += 4;

  // Clinic block (if available)
  if (clinicName || clinicAddress || clinicCnpj) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...accentColor);
    if (clinicName) { doc.text(clinicName, margin, y); y += 5; }
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
    if (clinicAddress) { doc.splitTextToSize(clinicAddress, contentW).forEach((l: string) => { doc.text(l, margin, y); y += 4.5; }); }
    if (clinicCnpj) { doc.text(`CNPJ: ${formatCpf(clinicCnpj)}`, margin, y); y += 4.5; }
    y += 3; drawLine(); y += 4;
  }

  const therapistCpfFmt = therapistCpf ? formatCpf(therapistCpf) : null;
  const payerCpfFmt = payerCpf ? formatCpf(payerCpf) : null;
  const amountStr = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const payDateFmt = paymentDate ? format(new Date(paymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '___/___/______';
  const locationStr = location ? `${location}, ` : '';

  const cpfPart = therapistCpfFmt ? `, inscrito(a) no CPF/CNPJ sob o número ${therapistCpfFmt},` : '';
  const addrPart = therapistAddress ? ` residente e domiciliado(a) em ${therapistAddress},` : '';
  const payerCpfPart = payerCpfFmt ? `, inscrito(a) no CPF sob o número ${payerCpfFmt},` : '';

  const p1 = `Eu, ${therapistName}${cpfPart}${addrPart} declaro para os devidos fins que recebi de ${payerName}${payerCpfPart} a importância de R$ ${amountStr}, referente ao pagamento do serviço de ${serviceName}, realizado no período de ${period}.`;
  const p2 = `A quantia foi paga através de ${paymentMethod} na data de ${payDateFmt}.`;

  doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(...darkText);
  doc.splitTextToSize(p1, contentW).forEach((l: string) => { doc.text(l, margin, y); y += 6.5; });
  y += 3;
  doc.splitTextToSize(p2, contentW).forEach((l: string) => { doc.text(l, margin, y); y += 6.5; });
  y += 3;
  doc.text('Por ser verdade, firmo o presente recibo.', margin, y); y += 6.5;
  y += 6;

  doc.setFontSize(10); doc.setTextColor(...mutedText);
  // location may already contain "City, DD/MM/YYYY" when localDate was filled
  const localText = location ? `Local e data: ${location}` : `Local e data: _______________, ____/____/________`;
  doc.text(localText, margin, y);
  y += 12;

  if (stamp?.signature_image) {
    try {
      const img = document.createElement('img'); img.src = stamp.signature_image;
      await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });
      let sw = 45, sh = (img.height / img.width) * sw; if (sh > 12) { sh = 12; sw = (img.width / img.height) * sh; }
      doc.addImage(stamp.signature_image, 'PNG', margin, y, sw, sh, undefined, 'FAST'); y += sh + 2;
    } catch { /* skip */ }
  }
  if (stamp?.stamp_image) {
    try {
      const img2 = document.createElement('img'); img2.src = stamp.stamp_image;
      await new Promise<void>(r => { img2.onload = () => r(); img2.onerror = () => r(); });
      let sw = 40, sh = (img2.height / img2.width) * sw; if (sh > 18) { sh = 18; sw = (img2.width / img2.height) * sh; }
      doc.addImage(stamp.stamp_image, 'PNG', margin, y, sw, sh, undefined, 'FAST'); y += sh + 3;
    } catch { /* skip */ }
  }

  doc.setDrawColor(...borderColor); doc.line(margin, y, margin + contentW * 0.55, y); y += 5;
  doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...darkText);
  doc.text(therapistName, margin, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...mutedText);
  const area = stamp?.clinical_area || therapistClinicalArea;
  if (area) { doc.text(area, margin, y); y += 5; }
  if (therapistProfessionalId) { doc.text(`Registro: ${therapistProfessionalId}`, margin, y); y += 5; }
  if (therapistCpfFmt) { doc.text(`CPF: ${therapistCpfFmt}`, margin, y); y += 5; }
  const cbo = stamp?.cbo || therapistCbo;
  if (cbo) { doc.text(`CBO: ${cbo}`, margin, y); y += 5; }

  doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...mutedText);
  doc.text(`Recibo de Pagamento  ·  ${payerName}  ·  ${serviceName}  ·  Emitido em ${emissao}`, W / 2, 291, { align: 'center' });

  const safePayer = payerName.replace(/\s+/g, '-').toLowerCase();
  const safeDate = paymentDate || format(new Date(), 'yyyy-MM-dd');
  if (returnBlob) return doc.output('blob') as Blob;
  doc.save(`recibo-pagamento-${safePayer}-${safeDate}.pdf`);
  toast.success('Recibo de pagamento gerado com sucesso!');
}

export async function generatePaymentReceiptWord(opts: PaymentReceiptOptions): Promise<void> {
  const { therapistName, therapistCpf, therapistAddress, therapistProfessionalId, therapistCbo,
    therapistClinicalArea, stamp, payerName, payerCpf, location, amount, serviceName, period,
    paymentMethod, paymentDate, clinicName, clinicAddress, clinicCnpj } = opts;

  const fmt = (cpf: string) => {
    const d = cpf.replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return cpf;
  };

  const cpfPart = therapistCpf ? `, inscrito(a) no CPF/CNPJ sob o número ${fmt(therapistCpf)},` : '';
  const addrPart = therapistAddress ? ` residente e domiciliado(a) em ${therapistAddress},` : '';
  const payerCpfPart = payerCpf ? `, inscrito(a) no CPF sob o número ${fmt(payerCpf)},` : '';
  const amountStr = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const payDateStr = paymentDate ? format(new Date(paymentDate + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '___/___/______';
  const emissao = format(new Date(), 'dd/MM/yyyy', { locale: ptBR });
  const area = stamp?.clinical_area || therapistClinicalArea || '';
  const locationStr = location ? `${location}, ` : '';

  const clinicBlock = (clinicName || clinicAddress || clinicCnpj)
    ? `<div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #ddd">
        ${clinicName ? `<p style="font-weight:bold;color:#1e3a8a;margin:0">${clinicName}</p>` : ''}
        ${clinicAddress ? `<p style="margin:2px 0;font-size:9pt;color:#555">${clinicAddress}</p>` : ''}
        ${clinicCnpj ? `<p style="margin:2px 0;font-size:9pt;color:#555">CNPJ: ${fmt(clinicCnpj)}</p>` : ''}
      </div>`
    : '';

  const html = `<html><body style="font-family:Arial,sans-serif;font-size:12pt;margin:48px;line-height:1.7">
    <h2 style="color:#1e3a8a;margin-bottom:4px">RECIBO DE PAGAMENTO</h2>
    <p style="color:#666;margin-top:0;font-size:9pt">Emissão: ${emissao}</p>
    <hr style="border:1px solid #ddd;margin:16px 0"/>
    ${clinicBlock}
    <p style="text-align:justify">Eu, <strong>${therapistName}</strong>${cpfPart}${addrPart} declaro para os devidos fins que recebi de <strong>${payerName}</strong>${payerCpfPart} a importância de <strong>R$ ${amountStr}</strong>, referente ao pagamento do serviço de <strong>${serviceName}</strong>, realizado no período de <strong>${period}</strong>.</p>
    <p style="text-align:justify">A quantia foi paga através de <strong>${paymentMethod}</strong> na data de <strong>${payDateStr}</strong>.</p>
    <p>Por ser verdade, firmo o presente recibo.</p>
    <br/><p>Local e data: ${location ? `${location}, ____/____/________` : '_______________, ____/____/________'}</p>
    <br/><br/><br/>
    <p>___________________________</p>
    <p><strong>${therapistName}</strong></p>
    ${area ? `<p>${area}</p>` : ''}
    ${therapistProfessionalId ? `<p>Registro: ${therapistProfessionalId}</p>` : ''}
    ${therapistCpf ? `<p>CPF: ${fmt(therapistCpf)}</p>` : ''}
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
