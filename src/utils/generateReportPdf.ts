import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface ReportPdfOptions {
  title: string;
  content: string;
  fileName?: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicLetterhead?: string;
  clinicStamp?: string;
  clinicEmail?: string;
  clinicCnpj?: string;
  clinicPhone?: string;
  clinicServicesDescription?: string;
  therapistName?: string;
  therapistProfessionalId?: string;
  therapistCbo?: string;
  therapistStampImage?: string | null;
  therapistSignatureImage?: string | null;
  therapistClinicalArea?: string | null;
}

function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── A4 Constants ──
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 20; // 20mm all sides
const CONTENT_W = PAGE_W - MARGIN * 2; // 170mm usable
const FONT = 'helvetica';

// Font sizes
const TITLE_SIZE = 16;
const SECTION_SIZE = 12;
const BODY_SIZE = 10;
const SMALL_SIZE = 8;
const FOOTER_SIZE = 7;

// Spacing
const LINE_HEIGHT = 5.5; // ~1.5 line spacing for 10pt
const SECTION_GAP = 8;
const PARAGRAPH_GAP = 3;

// Footer
const FOOTER_RESERVE = 20;
const USABLE_BOTTOM = PAGE_H - MARGIN - FOOTER_RESERVE;

// ── Helpers ──

function htmlToLines(html: string): string[] {
  let text = html;

  // Convert HTML tables to key-value blocks
  text = text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableHtml: string) => {
    const rows: string[][] = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(tableHtml)) !== null) {
      const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      let cellMatch;
      const cells: string[] = [];
      while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }
      if (cells.length >= 2) rows.push(cells);
    }
    if (rows.length > 0) {
      if (rows[0].length === 2) {
        return '\n' + rows.map(r => `${r[0]}: ${r[1]}`).join('\n') + '\n';
      }
      return '\n' + rows.map(r => r.join(' — ')).join('\n') + '\n';
    }
    return '\n';
  });

  // Block elements → newlines
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|ul|ol|blockquote|tr|table)[^>]*\/?>/gi, '\n');
  // Strip inline tags (strong, em, span, a, etc.) WITHOUT duplicating content
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  // Strip residual markdown bold/italic markers
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text.split('\n');
}

function isSignatureLine(line: string): boolean {
  return (
    /^respons[áa]vel\s+t[ée]cnico/i.test(line) ||
    /^terapeuta\s+respons[áa]vel/i.test(line) ||
    /^\(espa[çc]o para assinatura/i.test(line) ||
    /^\(assinatura e carimbo/i.test(line) ||
    /^\(assinatura\)/i.test(line)
  );
}

function classifyLine(trimmed: string): 'section' | 'subsection' | 'allcaps' | 'mdheading' | null {
  if (/^\d+\.\d+/.test(trimmed) && trimmed.length < 120) return 'subsection';
  if (/^\d+\.?\s/.test(trimmed) && trimmed.length < 120) {
    const afterNum = trimmed.replace(/^\d+\.?\s*/, '');
    const upperRatio = (afterNum.match(/[A-ZÀ-Ú]/g) || []).length / Math.max(afterNum.length, 1);
    if (upperRatio > 0.5 || afterNum.length < 50) return 'section';
    return null;
  }
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 100 && !/^\d/.test(trimmed)) return 'allcaps';
  if (/^#{1,3}\s/.test(trimmed)) return 'mdheading';
  return null;
}

export async function generateReportPdf(opts: ReportPdfOptions) {
  const {
    title, content, fileName, clinicName, clinicAddress,
    clinicLetterhead, clinicStamp, clinicEmail, clinicCnpj, clinicPhone,
    clinicServicesDescription, therapistName, therapistProfessionalId, therapistCbo,
    therapistStampImage, therapistSignatureImage, therapistClinicalArea
  } = opts;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN;

  // ── Pagination helper ──
  const ensureSpace = (needed: number) => {
    if (y + needed > USABLE_BOTTOM) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  const ensureHeadingWithBody = (headingH: number) => {
    if (y + headingH + LINE_HEIGHT * 3 > USABLE_BOTTOM) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  // ── Text writing (simple left-aligned, proper word-wrap) ──
  const writeText = (text: string, indent = 0) => {
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(BODY_SIZE);
    pdf.setTextColor(40, 40, 40);
    const maxW = CONTENT_W - indent;
    const lines: string[] = pdf.splitTextToSize(text, maxW);
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      pdf.text(line, MARGIN + indent, y);
      y += LINE_HEIGHT;
    }
  };

  // ── Draw section heading with light gray background ──
  const drawSectionHeading = (text: string) => {
    ensureHeadingWithBody(SECTION_GAP + 7);
    y += SECTION_GAP;

    pdf.setFont(FONT, 'bold');
    pdf.setFontSize(SECTION_SIZE);
    pdf.setTextColor(25, 25, 25);

    const headingLines: string[] = pdf.splitTextToSize(text, CONTENT_W - 8);
    const blockH = headingLines.length * 6 + 3;

    // Light gray background bar
    pdf.setFillColor(240, 240, 240);
    pdf.rect(MARGIN, y - 4, CONTENT_W, blockH, 'F');

    for (const hl of headingLines) {
      pdf.text(hl, MARGIN + 4, y);
      y += 6;
    }
    y += 2;
  };

  // ═══════════════════════════════════════
  // ── LETTERHEAD ──
  // ═══════════════════════════════════════
  if (clinicLetterhead) {
    try {
      const img = await loadImageFromUrl(clinicLetterhead);
      const imgW = CONTENT_W;
      const imgH = Math.min((img.height / img.width) * imgW, 35);
      pdf.addImage(clinicLetterhead, 'PNG', MARGIN, y, imgW, imgH);
      y += imgH + 4;
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 6;
    } catch { /* skip */ }
  }

  // ═══════════════════════════════════════
  // ── HEADER: Stamp (left) + Title (center/right) ──
  // ═══════════════════════════════════════
  const STAMP_SIZE_PX = 30;
  const STAMP_GAP = 8;
  const titleAreaX = clinicStamp ? MARGIN + STAMP_SIZE_PX + STAMP_GAP : MARGIN;
  const titleAreaW = clinicStamp ? CONTENT_W - STAMP_SIZE_PX - STAMP_GAP : CONTENT_W;

  let stampLoaded = false;
  if (clinicStamp) {
    try {
      await loadImageFromUrl(clinicStamp);
      pdf.addImage(clinicStamp, 'PNG', MARGIN, y, STAMP_SIZE_PX, STAMP_SIZE_PX);
      stampLoaded = true;
    } catch { /* skip */ }
  }

  // Title
  const titleStartY = y + 6;
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(TITLE_SIZE);
  pdf.setTextColor(20, 20, 20);
  const titleLines: string[] = pdf.splitTextToSize(title, titleAreaW - 4);
  let titleY = titleStartY;
  const titleCenterX = titleAreaX + titleAreaW / 2;
  for (const tl of titleLines) {
    pdf.text(tl, titleCenterX, titleY, { align: 'center' });
    titleY += 8;
  }
  titleY += 2;

  // Subtle divider under title
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.4);
  pdf.line(titleAreaX, titleY, titleAreaX + titleAreaW, titleY);
  titleY += 6;

  // Emission date
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(SMALL_SIZE);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `Data de Emissão: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    titleCenterX, titleY, { align: 'center' }
  );
  titleY += 8;

  y = Math.max(stampLoaded ? y + STAMP_SIZE_PX + 6 : y, titleY);

  // ═══════════════════════════════════════
  // ── CONTENT ──
  // ═══════════════════════════════════════
  const rawLines = htmlToLines(content);

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (trimmed === '') {
      y += PARAGRAPH_GAP;
      continue;
    }

    if (isSignatureLine(trimmed)) continue;
    if (/^[-*=]{3,}$/.test(trimmed)) continue;

    // Pipe table rows
    if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter(c => c.trim() !== '');
      if (cells.length === 2) {
        ensureSpace(LINE_HEIGHT * 2);
        pdf.setFont(FONT, 'bold');
        pdf.setFontSize(BODY_SIZE);
        pdf.setTextColor(40, 40, 40);
        const label = `${cells[0].trim()}: `;
        const labelW = pdf.getTextWidth(label);
        pdf.text(label, MARGIN, y);
        pdf.setFont(FONT, 'normal');
        const valLines: string[] = pdf.splitTextToSize(cells[1].trim(), CONTENT_W - labelW);
        for (const vl of valLines) {
          pdf.text(vl, MARGIN + labelW, y);
          y += LINE_HEIGHT;
        }
        y += 1;
        continue;
      } else if (cells.length > 2) {
        writeText(cells.map(c => c.trim()).join(' — '));
        y += 1;
        continue;
      }
    }

    // ── Classify line ──
    const lineType = classifyLine(trimmed);

    if (lineType === 'section' || lineType === 'allcaps' || lineType === 'mdheading') {
      const headingText = trimmed.replace(/^#{1,3}\s/, '');
      drawSectionHeading(headingText);
      continue;
    }

    if (lineType === 'subsection') {
      ensureHeadingWithBody(7);
      y += SECTION_GAP - 2;
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(BODY_SIZE + 1);
      pdf.setTextColor(30, 30, 30);
      const hLines: string[] = pdf.splitTextToSize(trimmed, CONTENT_W - 4);
      for (const hl of hLines) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(hl, MARGIN + 2, y);
        y += LINE_HEIGHT;
      }
      y += 2;
      continue;
    }

    // Session sub-header
    if (/^sess[ãa]o\s*[–—-]\s*\d/i.test(trimmed)) {
      ensureHeadingWithBody(LINE_HEIGHT + SECTION_GAP);
      y += SECTION_GAP - 2;
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(35, 35, 35);
      const sessLines: string[] = pdf.splitTextToSize(trimmed, CONTENT_W - 4);
      for (const sl of sessLines) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(sl, MARGIN + 2, y);
        y += LINE_HEIGHT;
      }
      y += 2;
      continue;
    }

    // Key-value line
    const kvMatch = trimmed.match(/^([A-ZÀ-Ú][^:]{2,40}):\s*(.+)$/);
    if (kvMatch && !trimmed.startsWith('http')) {
      ensureSpace(LINE_HEIGHT * 2);
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(40, 40, 40);
      const label = `${kvMatch[1]}: `;
      const labelW = pdf.getTextWidth(label);
      pdf.text(label, MARGIN, y);
      pdf.setFont(FONT, 'normal');
      const firstLines: string[] = pdf.splitTextToSize(kvMatch[2], CONTENT_W - labelW);
      pdf.text(firstLines[0], MARGIN + labelW, y);
      y += LINE_HEIGHT;
      for (let vi = 1; vi < firstLines.length; vi++) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(firstLines[vi], MARGIN, y);
        y += LINE_HEIGHT;
      }
      y += 1;
      continue;
    }

    // Bullet list
    if (/^[-•]\s/.test(trimmed)) {
      const itemText = trimmed.slice(2).trim();
      if (!itemText) continue;
      ensureSpace(LINE_HEIGHT);
      pdf.setFont(FONT, 'normal');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(40, 40, 40);
      pdf.text('•', MARGIN + 2, y);
      const wrapped: string[] = pdf.splitTextToSize(itemText, CONTENT_W - 8);
      for (const wl of wrapped) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(wl, MARGIN + 7, y);
        y += LINE_HEIGHT;
      }
      y += 1;
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+[.)\\])\s+(.+)/);
    if (numberedMatch && lineType !== 'section') {
      ensureSpace(LINE_HEIGHT + 3);
      pdf.setFont(FONT, 'normal');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(40, 40, 40);
      const numPrefix = numberedMatch[1] + ' ';
      const numW = pdf.getTextWidth(numPrefix);
      pdf.text(numPrefix, MARGIN + 2, y);
      const wrapped: string[] = pdf.splitTextToSize(numberedMatch[2], CONTENT_W - numW - 4);
      for (const wl of wrapped) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(wl, MARGIN + numW + 2, y);
        y += LINE_HEIGHT;
      }
      y += 2;
      continue;
    }

    // ── Regular paragraph (left-aligned, NO justification) ──
    writeText(trimmed);
    y += PARAGRAPH_GAP;
  }

  // ═══════════════════════════════════════
  // ── SIGNATURE BLOCK ──
  // ═══════════════════════════════════════
  const sigLineW = 60;
  const leftCenterX = MARGIN + CONTENT_W * 0.25;
  const rightCenterX = MARGIN + CONTENT_W * 0.75;
  const sigSpacingAbove = 12;

  let sigImgH = 0, stImgH = 0;
  if (therapistSignatureImage) {
    try {
      const si = await loadImageFromUrl(therapistSignatureImage);
      sigImgH = Math.min((si.height / si.width) * 55, 18) + 3;
    } catch { /* skip */ }
  }
  if (therapistStampImage) {
    try {
      const sti = await loadImageFromUrl(therapistStampImage);
      stImgH = Math.min((sti.height / sti.width) * 40, 35) + 3;
    } catch { /* skip */ }
  }
  const textRows = 1 + 1 + (therapistClinicalArea ? 1 : 0) + (therapistCbo ? 1 : 0) + (therapistProfessionalId ? 1 : 0);
  const sigBlockHeight = sigSpacingAbove + sigImgH + stImgH + 5 + textRows * 5 + 4;

  if (y + sigBlockHeight > USABLE_BOTTOM) {
    pdf.addPage();
    y = MARGIN;
  }

  let sigY = y + sigSpacingAbove;

  // Left side: Terapeuta Responsável
  if (therapistSignatureImage) {
    try {
      const sigImg = await loadImageFromUrl(therapistSignatureImage);
      const sigW = 40;
      const sigH = Math.min((sigImg.height / sigImg.width) * sigW, 12);
      pdf.addImage(therapistSignatureImage, 'PNG', leftCenterX - sigLineW / 2, sigY, sigW, sigH);
      sigY += sigH + 3;
    } catch { /* skip */ }
  }

  if (therapistStampImage) {
    try {
      const stImg = await loadImageFromUrl(therapistStampImage);
      const stW = Math.min(sigLineW, 35);
      const stH = Math.min((stImg.height / stImg.width) * stW, 18);
      pdf.addImage(therapistStampImage, 'PNG', leftCenterX - sigLineW / 2, sigY, stW, stH);
      sigY += stH + 3;
    } catch { /* skip */ }
  }

  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.4);
  pdf.line(leftCenterX - sigLineW / 2, sigY, leftCenterX + sigLineW / 2, sigY);
  sigY += 5;

  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(50, 50, 50);
  pdf.text(therapistName || 'Terapeuta Responsável', leftCenterX, sigY, { align: 'center' });
  sigY += 5;

  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 100, 100);
  if (therapistClinicalArea) {
    pdf.text(therapistClinicalArea, leftCenterX, sigY, { align: 'center' });
    sigY += 5;
  }
  if (therapistCbo) {
    pdf.text(`CBO: ${therapistCbo}`, leftCenterX, sigY, { align: 'center' });
    sigY += 5;
  }
  if (therapistProfessionalId) {
    pdf.text(`Registro: ${therapistProfessionalId}`, leftCenterX, sigY, { align: 'center' });
    sigY += 5;
  }

  // Right side: Responsável Técnico
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.4);
  pdf.line(rightCenterX - sigLineW / 2, y + sigSpacingAbove, rightCenterX + sigLineW / 2, y + sigSpacingAbove);
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(50, 50, 50);
  pdf.text('Responsável Técnico', rightCenterX, y + sigSpacingAbove + 5, { align: 'center' });
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(130, 130, 130);
  pdf.text('(Assinatura e Carimbo)', rightCenterX, y + sigSpacingAbove + 9, { align: 'center' });

  // ═══════════════════════════════════════
  // ── FOOTER ON ALL PAGES ──
  // ═══════════════════════════════════════
  const totalPages = pdf.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    pdf.setPage(pg);

    const footerY = PAGE_H - MARGIN;

    // Divider line
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, footerY - 10, PAGE_W - MARGIN, footerY - 10);

    // Clinic info
    const footerParts: string[] = [];
    if (clinicName) footerParts.push(clinicName);
    if (clinicAddress) footerParts.push(clinicAddress);

    if (footerParts.length > 0) {
      pdf.setFont(FONT, 'normal');
      pdf.setFontSize(FOOTER_SIZE);
      pdf.setTextColor(140, 140, 140);
      let fy = footerY - 7;
      for (const fl of footerParts) {
        pdf.text(fl, PAGE_W / 2, fy, { align: 'center' });
        fy += 3.5;
      }
    }

    // Page number
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(FOOTER_SIZE);
    pdf.setTextColor(160, 160, 160);
    pdf.text(`Página ${pg} de ${totalPages}`, PAGE_W / 2, footerY - 1, { align: 'center' });

    // Confidential text
    pdf.setFont(FONT, 'italic');
    pdf.setFontSize(6.5);
    pdf.setTextColor(170, 170, 170);
    pdf.text('Documento confidencial - uso exclusivo profissional', PAGE_W / 2, footerY + 2, { align: 'center' });
  }

  const safeName = (fileName || title).replace(/\s+/g, '_');
  pdf.save(`${safeName}.pdf`);
  toast.success('PDF exportado!');
}
