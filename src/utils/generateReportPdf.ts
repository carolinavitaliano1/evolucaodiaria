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

// ── Constants ──
const PAGE_W = 210; // A4 mm
const PAGE_H = 297;
const MARGIN = 25; // ~2.5 cm
const CONTENT_W = PAGE_W - MARGIN * 2;
const FONT = 'helvetica'; // closest built-in to Arial/Inter

const TITLE_SIZE = 14;
const SUBTITLE_SIZE = 12;
const BODY_SIZE = 10;
const SMALL_SIZE = 8.5;
const FOOTER_FONT_SIZE = 6.5;

const LINE_HEIGHT = 5; // ~1.5 spacing for 10pt
const SECTION_GAP = 8;
const PARAGRAPH_GAP = 3;

// Footer area reserved at the bottom of every page
const FOOTER_RESERVE = 30;
const USABLE_BOTTOM = PAGE_H - FOOTER_RESERVE;

// ── Helpers ──

/** Convert HTML content to clean structured lines */
function htmlToLines(html: string): string[] {
  let text = html;

  // Convert HTML tables to key-value blocks (no pipe tables)
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
    // Render as "Label: Value" block
    if (rows.length > 0) {
      const isHeaderRow = rows[0].every(c => c.length < 30);
      const dataRows = isHeaderRow ? rows.slice(1) : rows;
      const headerRow = isHeaderRow ? rows[0] : null;

      // If 2 columns, treat as key-value
      if (rows[0].length === 2) {
        return '\n' + dataRows.map(r => `${r[0]}: ${r[1]}`).join('\n') + '\n';
      }
      // Otherwise keep as text rows
      return '\n' + rows.map(r => r.join(' — ')).join('\n') + '\n';
    }
    return '\n';
  });

  // Block elements → newlines
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|ul|ol|blockquote|tr|table)[^>]*\/?>/gi, '\n');
  // Strip remaining HTML
  text = text.replace(/<[^>]+>/g, '');
  // Decode entities
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text.split('\n');
}

/**
 * Generates a professional institutional PDF from report content.
 * All text is justified, no markdown tables, clean structured layout.
 */
export async function generateReportPdf(opts: ReportPdfOptions) {
  const { title, content, fileName, clinicName, clinicAddress, clinicLetterhead, clinicEmail, clinicCnpj, clinicPhone, clinicServicesDescription } = opts;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN;

  // ── Pagination helper ──
  const ensureSpace = (needed: number) => {
    if (y + needed > USABLE_BOTTOM) {
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

  // ── Letterhead (logo image) ──
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

  // ── Report Title ──
  y += 4;
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(TITLE_SIZE);
  pdf.setTextColor(30, 30, 30);
  const titleLines = pdf.splitTextToSize(title.toUpperCase(), CONTENT_W - 20);
  for (const tl of titleLines) {
    pdf.text(tl, PAGE_W / 2, y, { align: 'center' });
    y += 8;
  }
  y += 3;

  // Divider
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.4);
  pdf.line(MARGIN + 30, y, PAGE_W - MARGIN - 30, y);
  y += 6;

  // Date
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(SMALL_SIZE);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    `Data de Emissão: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    PAGE_W / 2, y, { align: 'center' }
  );
  y += 10;

  // ── Parse content into lines ──
  const rawLines = htmlToLines(content);

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (trimmed === '') {
      y += PARAGRAPH_GAP;
      continue;
    }

    // Skip AI-generated signature block (the PDF adds its own)
    if (/^respons[áa]vel\s+t[ée]cnico/i.test(trimmed)) continue;
    if (/^\(espa[çc]o para assinatura/i.test(trimmed)) continue;
    if (/^\(assinatura e carimbo\)/i.test(trimmed)) continue;

    // Skip markdown table separators and pipe lines
    if (/^[-*=]{3,}$/.test(trimmed)) continue;
    if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Convert leftover pipe tables to key-value
      const cells = trimmed.split('|').filter(c => c.trim() !== '');
      if (cells.length === 2) {
        writeJustified(`${cells[0].trim()}: ${cells[1].trim()}`);
        y += 1;
        continue;
      } else if (cells.length > 2) {
        writeJustified(cells.map(c => c.trim()).join(' — '));
        y += 1;
        continue;
      }
    }

    // ── Section headings (numbered like "1. TITLE" or "4.1. Subtitle") ──
    const isSectionHeading = /^\d+(\.\d+)*\.?\s/.test(trimmed) && trimmed.length < 120;
    const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 100 && !/^\d/.test(trimmed);
    const isMdHeading = /^#{1,3}\s/.test(trimmed);

    if (isSectionHeading || isAllCaps || isMdHeading) {
      y += SECTION_GAP;
      const headingText = trimmed.replace(/^#{1,3}\s/, '');
      const isSubsection = /^\d+\.\d+/.test(trimmed);
      const fontSize = isSubsection ? SUBTITLE_SIZE - 1 : SUBTITLE_SIZE;

      ensureSpace(fontSize + SECTION_GAP);

      // Accent bar for main sections
      if (isSectionHeading && !isSubsection) {
        pdf.setFillColor(60, 60, 60);
        pdf.rect(MARGIN - 1, y - 4.5, 2, 6, 'F');
      }

      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(25, 25, 25);
      const hLines = pdf.splitTextToSize(headingText, CONTENT_W - 6);
      for (const hl of hLines) {
        ensureSpace(8);
        pdf.text(hl, MARGIN + 3, y);
        y += 7;
      }
      y += 4;
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
      // Wrap value next to label
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
    const isBullet = /^[-•]\s/.test(trimmed);
    if (isBullet) {
      const itemText = trimmed.slice(2).trim();
      if (itemText === '') continue; // skip empty bullets
      ensureSpace(LINE_HEIGHT);
      pdf.setFont(FONT, 'normal');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(40, 40, 40);
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

    // ── Numbered list items (1. or 1)) ──
    const numberedMatch = trimmed.match(/^(\d+[\.\\)])\s+(.+)/);
    if (numberedMatch && !isSectionHeading) {
      ensureSpace(LINE_HEIGHT);
      pdf.setFont(FONT, 'normal');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(40, 40, 40);
      const numPrefix = numberedMatch[1] + ' ';
      const numW = pdf.getTextWidth(numPrefix);
      pdf.text(numPrefix, MARGIN + 2, y);
      const wrapped = pdf.splitTextToSize(numberedMatch[2], CONTENT_W - numW - 4);
      for (const wl of wrapped) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(wl, MARGIN + numW + 2, y);
        y += LINE_HEIGHT;
      }
      y += 2;
      continue;
    }

    // ── Session sub-header (e.g. "Sessão – 04/02/2026") ──
    if (/^sess[ãa]o/i.test(trimmed)) {
      y += SECTION_GAP - 2;
      ensureSpace(14);
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(35, 35, 35);
      pdf.text(trimmed, MARGIN + 2, y);
      y += LINE_HEIGHT + 2;
      setBody();
      continue;
    }

    // ── Regular paragraph text (justified) ──
    writeJustified(trimmed);
    y += PARAGRAPH_GAP;
  }

  // ── Signature Block ──
  y += 12;
  ensureSpace(45);
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 18;
  const sigLineW = 65;
  const sigX = PAGE_W / 2 - sigLineW / 2;
  pdf.setDrawColor(100, 100, 100);
  pdf.setLineWidth(0.4);
  pdf.line(sigX, y, sigX + sigLineW, y);
  y += 6;
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(50, 50, 50);
  pdf.text('Responsável Técnico', PAGE_W / 2, y, { align: 'center' });
  y += 5;
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(130, 130, 130);
  pdf.text('(Assinatura e Carimbo)', PAGE_W / 2, y, { align: 'center' });

  // ── Footer on all pages ──
  const totalPages = pdf.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    pdf.setPage(pg);

    if (clinicName) {
      const footerLines: string[] = [clinicName];
      if (clinicServicesDescription) footerLines.push(clinicServicesDescription);
      if (clinicCnpj) footerLines.push(`CNPJ: ${clinicCnpj}`);
      const addrPhone: string[] = [];
      if (clinicAddress) addrPhone.push(clinicAddress);
      if (clinicPhone) addrPhone.push(`Tel: ${clinicPhone}`);
      if (addrPhone.length > 0) footerLines.push(addrPhone.join(' | '));
      if (clinicEmail) footerLines.push(clinicEmail);

      const fLineH = 3.2;
      const fBlockH = footerLines.length * fLineH + 5;
      const fStartY = PAGE_H - 9 - fBlockH;

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

    // Page number
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(170, 170, 170);
    pdf.text(`Página ${pg} de ${totalPages}`, PAGE_W / 2, PAGE_H - 8, { align: 'center' });
  }

  const safeName = (fileName || title).replace(/\s+/g, '_');
  pdf.save(`${safeName}.pdf`);
  toast.success('PDF exportado!');
}
