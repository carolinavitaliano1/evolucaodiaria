import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface ReportPdfOptions {
  title: string;
  content: string;
  fileName?: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicLetterhead?: string;
  clinicEmail?: string;
  clinicCnpj?: string;
  clinicPhone?: string;
  clinicServicesDescription?: string;
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

// ── Constants (A4) ──
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 25; // ~2.5 cm
const CONTENT_W = PAGE_W - MARGIN * 2;
const FONT = 'helvetica';

// Font sizes (max 11pt)
const TITLE_SIZE = 11;
const SECTION_SIZE = 11;
const SUBSECTION_SIZE = 10.5;
const BODY_SIZE = 10;
const SMALL_SIZE = 8;
const FOOTER_FONT_SIZE = 6.5;

// Spacing
const LINE_HEIGHT = 5; // ~1.5 spacing for 10pt
const SECTION_GAP = 7; // 18px ≈ 7mm
const PARAGRAPH_GAP = 3; // 8px ≈ 3mm

// Footer area
const FOOTER_RESERVE = 28;
const USABLE_BOTTOM = PAGE_H - FOOTER_RESERVE;

// ── Helpers ──

/** Convert HTML to clean text lines */
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
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text.split('\n');
}

/** Check if line is a signature block line that should be skipped */
function isSignatureLine(line: string): boolean {
  return (
    /^respons[áa]vel\s+t[ée]cnico/i.test(line) ||
    /^terapeuta\s+respons[áa]vel/i.test(line) ||
    /^\(espa[çc]o para assinatura/i.test(line) ||
    /^\(assinatura e carimbo/i.test(line) ||
    /^\(assinatura\)/i.test(line)
  );
}

/** Check if line is a section heading vs numbered list item */
function classifyLine(trimmed: string): 'section' | 'subsection' | 'allcaps' | 'mdheading' | null {
  if (/^\d+\.\d+/.test(trimmed) && trimmed.length < 120) return 'subsection';
  // Only treat as section heading if it looks like a title (short, or has UPPERCASE words after the number)
  if (/^\d+\.?\s/.test(trimmed) && trimmed.length < 120) {
    const afterNum = trimmed.replace(/^\d+\.?\s*/, '');
    // If the text after the number is mostly uppercase or very short (< 60 chars), it's a section heading
    // Otherwise it's a numbered list item (long sentence)
    const upperRatio = (afterNum.match(/[A-ZÀ-Ú]/g) || []).length / Math.max(afterNum.length, 1);
    if (upperRatio > 0.5 || afterNum.length < 50) return 'section';
    return null; // treat as numbered list item
  }
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 100 && !/^\d/.test(trimmed)) return 'allcaps';
  if (/^#{1,3}\s/.test(trimmed)) return 'mdheading';
  return null;
}

export async function generateReportPdf(opts: ReportPdfOptions) {
  const {
    title, content, fileName, clinicName, clinicAddress,
    clinicLetterhead, clinicEmail, clinicCnpj, clinicPhone,
    clinicServicesDescription
  } = opts;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN;

  // ── Pagination ──
  const ensureSpace = (needed: number) => {
    if (y + needed > USABLE_BOTTOM) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  // Ensure heading + at least 3 body lines stay together (orphan prevention)
  const ensureHeadingWithBody = (headingHeight: number) => {
    const minBodyAfter = LINE_HEIGHT * 3;
    if (y + headingHeight + minBodyAfter > USABLE_BOTTOM) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  const setBody = () => {
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(BODY_SIZE);
    pdf.setTextColor(40, 40, 40);
  };

  const writeJustified = (text: string, indent = 0) => {
    setBody();
    const lines = pdf.splitTextToSize(text, CONTENT_W - indent);
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      pdf.text(line, MARGIN + indent, y, { align: 'left' });
      y += LINE_HEIGHT;
    }
  };

  // ── Letterhead ──
  if (clinicLetterhead) {
    try {
      const img = await loadImageFromUrl(clinicLetterhead);
      const imgW = CONTENT_W;
      const imgH = Math.min((img.height / img.width) * imgW, 35);
      pdf.addImage(clinicLetterhead, 'PNG', MARGIN, y, imgW, imgH);
      y += imgH + 3;
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 6;
    } catch { /* skip */ }
  }

  // ── Report Title (16pt bold, centered) ──
  y += 4;
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(TITLE_SIZE);
  pdf.setTextColor(30, 30, 30);
  const titleLines = pdf.splitTextToSize(title.toUpperCase(), CONTENT_W - 20);
  for (const tl of titleLines) {
    pdf.text(tl, PAGE_W / 2, y, { align: 'center' });
    y += 8;
  }
  y += 2;

  // Thin divider
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN + 30, y, PAGE_W - MARGIN - 30, y);
  y += 5;

  // Date
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(SMALL_SIZE);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `Data de Emissão: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    PAGE_W / 2, y, { align: 'center' }
  );
  y += 10;

  // ── Parse & Render content ──
  const rawLines = htmlToLines(content);

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (trimmed === '') {
      y += PARAGRAPH_GAP;
      continue;
    }

    // Skip signature lines (the PDF adds its own)
    if (isSignatureLine(trimmed)) continue;

    // Skip markdown separators & pipe tables
    if (/^[-*=]{3,}$/.test(trimmed)) continue;
    if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter(c => c.trim() !== '');
      if (cells.length === 2) {
        // Render as key-value (label semi-bold, value normal)
        ensureSpace(LINE_HEIGHT * 2);
        pdf.setFont(FONT, 'bold');
        pdf.setFontSize(BODY_SIZE);
        pdf.setTextColor(40, 40, 40);
        const label = `${cells[0].trim()}: `;
        const labelW = pdf.getTextWidth(label);
        pdf.text(label, MARGIN, y);
        pdf.setFont(FONT, 'normal');
        const valLines = pdf.splitTextToSize(cells[1].trim(), CONTENT_W - labelW);
        pdf.text(valLines[0], MARGIN + labelW, y);
        y += LINE_HEIGHT;
        for (let vi = 1; vi < valLines.length; vi++) {
          ensureSpace(LINE_HEIGHT);
          pdf.text(valLines[vi], MARGIN + labelW, y);
          y += LINE_HEIGHT;
        }
        y += 1;
        continue;
      } else if (cells.length > 2) {
        writeJustified(cells.map(c => c.trim()).join(' — '));
        y += 1;
        continue;
      }
    }

    // ── Classify line ──
    const lineType = classifyLine(trimmed);

    if (lineType === 'section' || lineType === 'allcaps' || lineType === 'mdheading') {
      const headingText = trimmed.replace(/^#{1,3}\s/, '');
      
      // Orphan prevention: ensure heading + some body fits
      ensureHeadingWithBody(SECTION_SIZE + SECTION_GAP);

      y += SECTION_GAP;

      // Small accent bar for main numbered sections
      if (lineType === 'section') {
        pdf.setFillColor(60, 60, 60);
        pdf.rect(MARGIN - 1, y - 4.5, 2, 5.5, 'F');
      }

      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(SECTION_SIZE);
      pdf.setTextColor(25, 25, 25);
      const hLines = pdf.splitTextToSize(headingText, CONTENT_W - 6);
      for (const hl of hLines) {
        ensureSpace(8);
        pdf.text(hl, MARGIN + 3, y);
        y += 7;
      }
      y += 3;
      setBody();
      continue;
    }

    if (lineType === 'subsection') {
      const headingText = trimmed;
      ensureHeadingWithBody(SUBSECTION_SIZE + SECTION_GAP);
      y += SECTION_GAP - 2;

      pdf.setFont(FONT, 'normal'); // subsection: no excessive bold
      pdf.setFontSize(SUBSECTION_SIZE);
      pdf.setTextColor(30, 30, 30);
      const hLines = pdf.splitTextToSize(headingText, CONTENT_W - 4);
      for (const hl of hLines) {
        ensureSpace(7);
        pdf.text(hl, MARGIN + 2, y);
        y += 7;
      }
      y += 2;
      setBody();
      continue;
    }

    // ── Session sub-header (e.g. "Sessão – 04/02/2026") ──
    if (/^sess[ãa]o/i.test(trimmed)) {
      ensureHeadingWithBody(LINE_HEIGHT + SECTION_GAP);
      y += SECTION_GAP - 2;
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(35, 35, 35);
      pdf.text(trimmed, MARGIN + 2, y);
      y += LINE_HEIGHT + 2;
      setBody();
      continue;
    }

    // ── Key-value line (e.g. "Nome do Paciente: João") ──
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
      const valueLines = pdf.splitTextToSize(kvMatch[2], CONTENT_W - labelW);
      pdf.text(valueLines[0], MARGIN + labelW, y);
      y += LINE_HEIGHT;
      for (let vi = 1; vi < valueLines.length; vi++) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(valueLines[vi], MARGIN + labelW, y);
        y += LINE_HEIGHT;
      }
      y += 1;
      continue;
    }

    // ── Bullet list items ──
    if (/^[-•]\s/.test(trimmed)) {
      const itemText = trimmed.slice(2).trim();
      if (itemText === '') continue;
      ensureSpace(LINE_HEIGHT);
      setBody();
      const bulletIndent = 6;
      pdf.text('•', MARGIN + 2, y);
      const wrapped = pdf.splitTextToSize(itemText, CONTENT_W - bulletIndent - 2);
      for (const wl of wrapped) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(wl, MARGIN + bulletIndent, y);
        y += LINE_HEIGHT;
      }
      y += 2;
      continue;
    }

    // ── Numbered list items ──
    const numberedMatch = trimmed.match(/^(\d+[.)\\])\s+(.+)/);
    if (numberedMatch && lineType !== 'section') {
      ensureSpace(LINE_HEIGHT + 3);
      setBody();
      const numPrefix = numberedMatch[1] + ' ';
      const numW = pdf.getTextWidth(numPrefix);
      pdf.text(numPrefix, MARGIN + 2, y);
      const wrapped = pdf.splitTextToSize(numberedMatch[2], CONTENT_W - numW - 4);
      for (const wl of wrapped) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(wl, MARGIN + numW + 2, y);
        y += LINE_HEIGHT;
      }
      y += 3; // spacing between numbered items
      continue;
    }

    // ── Regular paragraph text ──
    writeJustified(trimmed);
    y += PARAGRAPH_GAP;
  }

  // ── Signature Block ──
  // Separator line: max 3mm from last content line
  const sepY = y + 3;
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, sepY, PAGE_W - MARGIN, sepY);

  // Signature lines right after separator (3mm gap)
  const sigY = sepY + 3;
  const sigLineW = 60;
  const leftCenterX = MARGIN + CONTENT_W * 0.25;
  const rightCenterX = MARGIN + CONTENT_W * 0.75;

  // Left signature: Terapeuta Responsável
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.4);
  pdf.line(leftCenterX - sigLineW / 2, sigY, leftCenterX + sigLineW / 2, sigY);
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(50, 50, 50);
  pdf.text('Terapeuta Responsável', leftCenterX, sigY + 5, { align: 'center' });
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(130, 130, 130);
  pdf.text('(Assinatura e Carimbo)', leftCenterX, sigY + 9, { align: 'center' });

  // Right signature: Responsável Técnico
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.4);
  pdf.line(rightCenterX - sigLineW / 2, sigY, rightCenterX + sigLineW / 2, sigY);
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(50, 50, 50);
  pdf.text('Responsável Técnico', rightCenterX, sigY + 5, { align: 'center' });
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(130, 130, 130);
  pdf.text('(Assinatura e Carimbo)', rightCenterX, sigY + 9, { align: 'center' });

  // ── Footer on all pages (pushed to very bottom) ──
  const totalPages = pdf.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    pdf.setPage(pg);

    const footerLines: string[] = [];
    if (clinicName) footerLines.push(clinicName);
    if (clinicAddress) footerLines.push(clinicAddress);

    if (footerLines.length > 0) {
      const fLineH = 3.2;
      // Footer starts just above the page number, at the very bottom
      const fStartY = PAGE_H - 5 - footerLines.length * fLineH - 4;

      // Divider
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.2);
      pdf.line(MARGIN, fStartY, PAGE_W - MARGIN, fStartY);

      pdf.setFont(FONT, 'normal');
      pdf.setFontSize(FOOTER_FONT_SIZE);
      pdf.setTextColor(140, 140, 140);

      let fy = fStartY + 4;
      for (const fl of footerLines) {
        pdf.text(fl, PAGE_W / 2, fy, { align: 'center' });
        fy += fLineH;
      }
    }

    // Page number at very bottom
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(170, 170, 170);
    pdf.text(`Página ${pg} de ${totalPages}`, PAGE_W / 2, PAGE_H - 5, { align: 'center' });
  }

  const safeName = (fileName || title).replace(/\s+/g, '_');
  pdf.save(`${safeName}.pdf`);
  toast.success('PDF exportado!');
}
