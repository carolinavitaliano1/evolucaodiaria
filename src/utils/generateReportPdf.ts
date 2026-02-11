import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface ReportPdfOptions {
  title: string;
  content: string;
  fileName?: string;
}

/**
 * Generates a professional institutional PDF from report content (HTML or plain text).
 * Handles markdown tables, headings, bullet lists, and numbered sections.
 */
export function generateReportPdf({ title, content, fileName }: ReportPdfOptions) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 22;
  const contentWidth = pageWidth - margin * 2;
  const footerY = pageHeight - 12;

  const checkPage = (y: number, needed = 20) => {
    if (y > pageHeight - needed) { pdf.addPage(); return 22; }
    return y;
  };

  let yPos = margin;

  // ── Header ──
  pdf.setTextColor(30, 30, 30);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title.toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(130, 130, 130);
  pdf.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    pageWidth / 2, yPos, { align: 'center' }
  );
  yPos += 6;

  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // ── Parse content ──
  const plainText = content.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const rawLines = plainText.split('\n');

  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const cols = tableRows[0].length;
    const colW = contentWidth / cols;
    const rowH = 7;
    const tableHeight = tableRows.length * rowH + 2;
    yPos = checkPage(yPos, tableHeight + 10);

    for (let r = 0; r < tableRows.length; r++) {
      const row = tableRows[r];
      const isHeader = r === 0;

      if (isHeader) {
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, yPos - 4.5, contentWidth, rowH, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(40, 40, 40);
      } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        if (r % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPos - 4.5, contentWidth, rowH, 'F');
        }
      }

      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.15);
      pdf.line(margin, yPos + 2.5, pageWidth - margin, yPos + 2.5);

      for (let c = 0; c < row.length; c++) {
        const cellX = margin + c * colW + 3;
        const cellText = (row[c] || '').trim();
        const truncated = cellText.length > 45 ? cellText.slice(0, 42) + '...' : cellText;
        pdf.text(truncated, cellX, yPos);
      }
      yPos += rowH;
      yPos = checkPage(yPos);
    }
    yPos += 5;
    tableRows = [];
    inTable = false;
  };

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(45, 45, 45);

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    // Skip markdown dividers / table separator rows
    if (/^[-*=]{3,}$/.test(trimmed)) continue;
    if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;

    // Detect table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter(c => c.trim() !== '');
      if (cells.length >= 2) {
        inTable = true;
        tableRows.push(cells.map(c => c.trim()));
        continue;
      }
    }

    if (inTable) flushTable();

    if (trimmed === '') { yPos += 3; continue; }

    // Detect headings
    const isSectionHeading = /^\d+(\.\d+)?\.?\s/.test(trimmed) && trimmed.length < 100;
    const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 80 && !/^\d/.test(trimmed);
    const isMdHeading = /^#{1,3}\s/.test(trimmed);

    if (isSectionHeading || isAllCaps || isMdHeading) {
      yPos += 5;
      yPos = checkPage(yPos, 15);
      const headingText = trimmed.replace(/^#{1,3}\s/, '');
      if (isSectionHeading) {
        pdf.setFillColor(80, 80, 80);
        pdf.rect(margin - 1, yPos - 4, 1.5, 5, 'F');
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(isSectionHeading ? 11.5 : 11);
      pdf.setTextColor(25, 25, 25);
      const headingLines = pdf.splitTextToSize(headingText, contentWidth - 5);
      for (const hl of headingLines) {
        yPos = checkPage(yPos, 10);
        pdf.text(hl, margin + 2, yPos);
        yPos += 6;
      }
      yPos += 2;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(45, 45, 45);
      continue;
    }

    // Bullet / numbered list
    const isBullet = /^[-•]\s/.test(trimmed);
    const isNumberedItem = /^\d+\)\s/.test(trimmed);

    if (isBullet || isNumberedItem) {
      const itemText = isBullet ? trimmed.slice(2) : trimmed;
      const prefix = isBullet ? '•' : '';
      const indent = isBullet ? 6 : 0;
      const displayText = isBullet ? `${prefix}  ${itemText}` : itemText;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(45, 45, 45);
      const wrapped = pdf.splitTextToSize(displayText, contentWidth - indent);
      for (const wl of wrapped) {
        yPos = checkPage(yPos);
        pdf.text(wl, margin + indent, yPos);
        yPos += 5;
      }
      yPos += 1.5;
      continue;
    }

    // Regular paragraph
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(45, 45, 45);
    const wrapped = pdf.splitTextToSize(trimmed, contentWidth);
    for (const wl of wrapped) {
      yPos = checkPage(yPos);
      pdf.text(wl, margin, yPos);
      yPos += 5;
    }
    yPos += 2;
  }

  if (inTable) flushTable();

  // ── Signature section ──
  yPos += 10;
  yPos = checkPage(yPos, 40);
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;
  const sigLineW = 65;
  const sigX = pageWidth / 2 - sigLineW / 2;
  pdf.setDrawColor(100, 100, 100);
  pdf.line(sigX, yPos, sigX + sigLineW, yPos);
  yPos += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);
  pdf.text('Responsável Técnico', pageWidth / 2, yPos, { align: 'center' });
  yPos += 4;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(130, 130, 130);
  pdf.text('(Assinatura e Carimbo)', pageWidth / 2, yPos, { align: 'center' });

  // ── Footer ──
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setTextColor(170, 170, 170);
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Página ${i} de ${total}`, pageWidth / 2, footerY, { align: 'center' });
  }

  const safeName = (fileName || title).replace(/\s+/g, '_');
  pdf.save(`${safeName}.pdf`);
  toast.success('PDF exportado!');
}
