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

interface ContentBlock {
  type: 'heading' | 'paragraph' | 'list-item' | 'ordered-item' | 'blank';
  text: string;
  level?: number;
  bold?: boolean;
}

function decodeEntities(text: string): string {
  return text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ''));
}

function isBoldContent(html: string): boolean {
  return /<(strong|b)\b/i.test(html);
}

/** Parse HTML into structured blocks respecting editor structure */
function parseHtmlToBlocks(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // Tables → key-value paragraphs
  let processed = html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableHtml: string) => {
    const rows: string[][] = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    while ((trMatch = trRegex.exec(tableHtml)) !== null) {
      const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      let cellMatch;
      const cells: string[] = [];
      while ((cellMatch = cellRegex.exec(trMatch[1])) !== null) {
        cells.push(stripTags(cellMatch[1]).trim());
      }
      if (cells.length >= 2) rows.push(cells);
    }
    return rows.length > 0 ? rows.map(r => `<p>${r.join(': ')}</p>`).join('') : '';
  });

  // Ordered lists → tagged items with numbers
  let olCounter = 0;
  processed = processed.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, listHtml: string) => {
    olCounter = 0;
    return listHtml.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, itemHtml: string) => {
      olCounter++;
      return `<ordered-item data-num="${olCounter}">${itemHtml}</ordered-item>`;
    });
  });

  // Unordered lists
  processed = processed.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, listHtml: string) => {
    return listHtml.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (__, itemHtml: string) => {
      return `<bullet-item>${itemHtml}</bullet-item>`;
    });
  });

  // Match block elements
  const blockRegex = /<(h[1-6]|p|div|blockquote|ordered-item|bullet-item)([^>]*)>([\s\S]*?)<\/\1>|<br\s*\/?>/gi;
  let match;
  let lastIndex = 0;

  while ((match = blockRegex.exec(processed)) !== null) {
    const between = processed.slice(lastIndex, match.index).trim();
    if (between) {
      const t = stripTags(between).trim();
      if (t) blocks.push({ type: 'paragraph', text: t });
    }
    lastIndex = match.index + match[0].length;

    if (match[0].match(/^<br\s*\/?>$/i)) { blocks.push({ type: 'blank', text: '' }); continue; }

    const tag = match[1].toLowerCase();
    const attrs = match[2] || '';
    const innerHtml = match[3] || '';
    const text = stripTags(innerHtml).trim();

    if (!text) { blocks.push({ type: 'blank', text: '' }); continue; }

    if (tag.startsWith('h')) {
      blocks.push({ type: 'heading', text, level: parseInt(tag[1]), bold: true });
    } else if (tag === 'ordered-item') {
      const numMatch = attrs.match(/data-num="(\d+)"/);
      blocks.push({ type: 'ordered-item', text, level: numMatch ? parseInt(numMatch[1]) : 1 });
    } else if (tag === 'bullet-item') {
      blocks.push({ type: 'list-item', text });
    } else {
      blocks.push({ type: 'paragraph', text, bold: isBoldContent(innerHtml) });
    }
  }

  const remaining = processed.slice(lastIndex).trim();
  if (remaining) {
    stripTags(remaining).split('\n').forEach(line => {
      const t = line.trim();
      if (t) blocks.push({ type: 'paragraph', text: t });
      else blocks.push({ type: 'blank', text: '' });
    });
  }

  if (blocks.length === 0 && html.trim()) {
    stripTags(html).split('\n').forEach(line => {
      const t = line.trim();
      if (t) blocks.push({ type: 'paragraph', text: t });
      else blocks.push({ type: 'blank', text: '' });
    });
  }

  return blocks;
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

  // ── Parse & Render content (HTML-structure-aware) ──
  const blocks = parseHtmlToBlocks(content);

  for (const block of blocks) {
    if (block.type === 'blank') {
      y += PARAGRAPH_GAP;
      continue;
    }

    // Skip signature lines (the PDF adds its own)
    if (isSignatureLine(block.text)) continue;

    // Skip markdown separators
    if (/^[-*=]{3,}$/.test(block.text)) continue;

    if (block.type === 'heading') {
      ensureHeadingWithBody(SECTION_SIZE + SECTION_GAP);
      y += SECTION_GAP;

      // Accent bar
      pdf.setFillColor(60, 60, 60);
      pdf.rect(MARGIN - 1, y - 4.5, 2, 5.5, 'F');

      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(block.level && block.level <= 2 ? SECTION_SIZE : SUBSECTION_SIZE);
      pdf.setTextColor(25, 25, 25);
      const hLines = pdf.splitTextToSize(block.text, CONTENT_W - 6);
      for (const hl of hLines) {
        ensureSpace(8);
        pdf.text(hl, MARGIN + 3, y);
        y += 7;
      }
      y += 3;
      setBody();
      continue;
    }

    if (block.type === 'ordered-item') {
      ensureSpace(LINE_HEIGHT + 3);
      setBody();
      const numPrefix = `${block.level}. `;
      const numW = pdf.getTextWidth(numPrefix);
      pdf.text(numPrefix, MARGIN + 2, y);
      const wrapped = pdf.splitTextToSize(block.text, CONTENT_W - numW - 4);
      for (const wl of wrapped) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(wl, MARGIN + numW + 2, y);
        y += LINE_HEIGHT;
      }
      y += 3;
      continue;
    }

    if (block.type === 'list-item') {
      ensureSpace(LINE_HEIGHT);
      setBody();
      const bulletIndent = 6;
      pdf.text('•', MARGIN + 2, y);
      const wrapped = pdf.splitTextToSize(block.text, CONTENT_W - bulletIndent - 2);
      for (const wl of wrapped) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(wl, MARGIN + bulletIndent, y);
        y += LINE_HEIGHT;
      }
      y += 2;
      continue;
    }

    // ── Paragraph: check if bold (section-like) ──
    if (block.bold) {
      ensureSpace(LINE_HEIGHT + SECTION_GAP);
      y += SECTION_GAP;
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(30, 30, 30);
      const wrapped = pdf.splitTextToSize(block.text, CONTENT_W);
      for (const wl of wrapped) {
        ensureSpace(LINE_HEIGHT);
        pdf.text(wl, MARGIN, y);
        y += LINE_HEIGHT;
      }
      y += PARAGRAPH_GAP;
      setBody();
      continue;
    }

    // ── Regular paragraph ──
    writeJustified(block.text);
    y += PARAGRAPH_GAP;
  }

  // ── Signature Block ──
  // Signature lines: 3mm from last content line, no separator
  const sigY = y + 3;
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
