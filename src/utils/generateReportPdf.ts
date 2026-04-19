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
const MARGIN = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FONT = 'helvetica';

// Brand color (lilac/purple — matches app theme #7C3AED ~ HSL 252 56% 57%)
const BRAND: [number, number, number] = [124, 58, 237];
const BRAND_SOFT: [number, number, number] = [243, 240, 255];
const BRAND_BORDER: [number, number, number] = [200, 188, 245];
const TEXT_DARK: [number, number, number] = [30, 30, 40];
const TEXT_MED: [number, number, number] = [85, 85, 100];
const TEXT_SOFT: [number, number, number] = [140, 140, 155];

// Font sizes
const TITLE_SIZE = 18;
const SECTION_SIZE = 12;
const BODY_SIZE = 10;
const SMALL_SIZE = 8;
const FOOTER_SIZE = 7;

const LINE_HEIGHT = 5;
const SECTION_GAP = 7;
const PARAGRAPH_GAP = 2.5;

const FOOTER_RESERVE = 18;
const USABLE_BOTTOM = PAGE_H - MARGIN - FOOTER_RESERVE;

// ── Helpers ──
function htmlToLines(html: string): string[] {
  let text = html;
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
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|ul|ol|blockquote|tr|table)[^>]*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
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

// Strip leading numbering like "1.", "2.", "3.1." from headings
function stripNumbering(text: string): string {
  return text.replace(/^\d+(\.\d+)*\.?\s+/, '').trim();
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

// Detect "Resumo Executivo" section to render as cards
function isExecSummaryHeading(text: string): boolean {
  return /resumo\s+executivo/i.test(text);
}

// Detect identification section to render as 2-column grid
function isIdentificationHeading(text: string): boolean {
  return /(cabe[çc]alho|identifica[çc][ãa]o|dados\s+do\s+paciente)/i.test(text);
}

// Detect a session sub-heading line ("Sessão – 01/04/2026" or "3.2 Sessão – ...")
function parseSessionHeading(text: string): { date: string | null; raw: string } | null {
  const m = text.match(/sess[ãa]o\s*[–—-]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (m) return { date: m[1], raw: text };
  if (/^sess[ãa]o\b/i.test(text)) return { date: null, raw: text };
  return null;
}

// Heuristic: detect "Ausência/Falta" content
function isAbsenceContent(body: string): boolean {
  return /aus[êe]ncia|n[ãa]o\s+compareceu|falta\s+registrada|n[ãa]o\s+houve\s+continuidade/i.test(body);
}

export async function generateReportPdf(opts: ReportPdfOptions) {
  const {
    title, content, fileName, clinicName, clinicAddress,
    clinicLetterhead, clinicStamp, clinicEmail, clinicCnpj, clinicPhone,
    therapistName, therapistProfessionalId, therapistCbo,
    therapistStampImage, therapistSignatureImage, therapistClinicalArea
  } = opts;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let y = MARGIN;

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

  const writeText = (text: string, indent = 0) => {
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(BODY_SIZE);
    pdf.setTextColor(...TEXT_DARK);
    const maxW = CONTENT_W - indent;
    const lines: string[] = pdf.splitTextToSize(text, maxW);
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      pdf.text(line, MARGIN + indent, y);
      y += LINE_HEIGHT;
    }
  };

  // ── Modern section heading: lilac left bar + uppercase tracking ──
  const drawSectionHeading = (text: string) => {
    const cleaned = stripNumbering(text);
    ensureHeadingWithBody(SECTION_GAP + 8);
    y += SECTION_GAP;

    // Left vertical accent bar
    pdf.setFillColor(...BRAND);
    pdf.rect(MARGIN, y - 4, 2.5, 7, 'F');

    pdf.setFont(FONT, 'bold');
    pdf.setFontSize(SECTION_SIZE);
    pdf.setTextColor(...TEXT_DARK);
    pdf.text(cleaned.toUpperCase(), MARGIN + 6, y + 1.5);

    y += 6;

    // Subtle underline
    pdf.setDrawColor(...BRAND_BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 4;
  };

  // ── 2-column key-value grid (for identification section) ──
  const drawKeyValueGrid = (pairs: { label: string; value: string }[]) => {
    const colW = (CONTENT_W - 6) / 2;
    const rowH = 11;
    for (let i = 0; i < pairs.length; i += 2) {
      ensureSpace(rowH + 2);
      const left = pairs[i];
      const right = pairs[i + 1];

      // Left cell
      pdf.setFont(FONT, 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...TEXT_SOFT);
      pdf.text(left.label.toUpperCase(), MARGIN, y);
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(...TEXT_DARK);
      const lv = pdf.splitTextToSize(left.value || '—', colW)[0];
      pdf.text(lv, MARGIN, y + 5);

      // Right cell
      if (right) {
        const rx = MARGIN + colW + 6;
        pdf.setFont(FONT, 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(...TEXT_SOFT);
        pdf.text(right.label.toUpperCase(), rx, y);
        pdf.setFont(FONT, 'bold');
        pdf.setFontSize(BODY_SIZE);
        pdf.setTextColor(...TEXT_DARK);
        const rv = pdf.splitTextToSize(right.value || '—', colW)[0];
        pdf.text(rv, rx, y + 5);
      }
      y += rowH;
    }
    y += 1;
  };

  // ── Stat cards row (for Executive Summary) ──
  const drawStatCards = (stats: { label: string; value: string }[]) => {
    if (stats.length === 0) return;
    const gap = 4;
    const cardW = (CONTENT_W - gap * (stats.length - 1)) / stats.length;
    const cardH = 22;
    ensureSpace(cardH + 4);

    stats.forEach((s, i) => {
      const x = MARGIN + i * (cardW + gap);
      // Card background
      pdf.setFillColor(...BRAND_SOFT);
      pdf.setDrawColor(...BRAND_BORDER);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD');

      // Value (large)
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(15);
      pdf.setTextColor(...BRAND);
      pdf.text(s.value, x + cardW / 2, y + 11, { align: 'center' });

      // Label (small uppercase)
      pdf.setFont(FONT, 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(...TEXT_MED);
      const labelLines: string[] = pdf.splitTextToSize(s.label.toUpperCase(), cardW - 4);
      pdf.text(labelLines[0], x + cardW / 2, y + 17, { align: 'center' });
    });
    y += cardH + 4;
  };

  // ── Session card with date badge + status ──
  const drawSessionCard = (date: string | null, body: string[]) => {
    const fullBody = body.join(' ').trim();
    const isAbsence = isAbsenceContent(fullBody);
    ensureHeadingWithBody(14);

    y += 2;
    // Left badge with date
    if (date) {
      const badgeW = 26;
      const badgeH = 7;
      const badgeFill: [number, number, number] = isAbsence ? [240, 240, 240] : BRAND;
      const badgeText: [number, number, number] = isAbsence ? TEXT_MED : [255, 255, 255];
      pdf.setFillColor(...badgeFill);
      pdf.roundedRect(MARGIN, y - 5, badgeW, badgeH, 1, 1, 'F');
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...badgeText);
      pdf.text(date, MARGIN + badgeW / 2, y - 0.5, { align: 'center' });

      // Status pill
      const statusLabel = isAbsence ? 'AUSÊNCIA' : 'PRESENTE';
      const statusColor: [number, number, number] = isAbsence ? [180, 100, 100] : [60, 140, 90];
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(6.5);
      pdf.setTextColor(...statusColor);
      pdf.text(statusLabel, MARGIN + badgeW + 4, y - 0.5);
      y += 5;
    }

    // Body text
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(BODY_SIZE);
    pdf.setTextColor(...TEXT_DARK);
    const wrapped: string[] = pdf.splitTextToSize(fullBody, CONTENT_W);
    for (const wl of wrapped) {
      ensureSpace(LINE_HEIGHT);
      pdf.text(wl, MARGIN, y);
      y += LINE_HEIGHT;
    }
    y += 4;
  };

  // ═══════════════════════════════════════
  // ── HEADER (LETTERHEAD or fallback brand bar) ──
  // ═══════════════════════════════════════
  if (clinicLetterhead) {
    try {
      const img = await loadImageFromUrl(clinicLetterhead);
      const ratio = img.height / img.width;
      const imgW = CONTENT_W;
      const imgH = Math.min(ratio * imgW, 30);
      pdf.addImage(clinicLetterhead, 'PNG', MARGIN, y, imgW, imgH);
      y += imgH + 5;
    } catch { /* skip */ }
  } else {
    // Fallback: thin lilac top bar
    pdf.setFillColor(...BRAND);
    pdf.rect(0, 0, PAGE_W, 4, 'F');
  }

  // ── Title block ──
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(TITLE_SIZE);
  pdf.setTextColor(...TEXT_DARK);
  const titleLines: string[] = pdf.splitTextToSize(title, CONTENT_W);
  for (const tl of titleLines) {
    pdf.text(tl, PAGE_W / 2, y + 6, { align: 'center' });
    y += 8;
  }
  y += 1;

  // Emission date with brand accent
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(SMALL_SIZE);
  pdf.setTextColor(...TEXT_SOFT);
  pdf.text(
    `Emitido em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    PAGE_W / 2, y + 3, { align: 'center' }
  );
  y += 8;

  // ═══════════════════════════════════════
  // ── PRE-PROCESS CONTENT: extract identification & summary ──
  // ═══════════════════════════════════════
  const rawLines = htmlToLines(content);

  // Group lines into sections to enable special rendering
  type Block = { type: 'heading' | 'subheading' | 'kv' | 'text' | 'bullet' | 'numbered' | 'session'; content: string; pairs?: { label: string; value: string }[]; sessionLines?: string[]; sectionFlag?: 'identification' | 'summary' | null };
  const blocks: Block[] = [];
  let currentSectionFlag: 'identification' | 'summary' | null = null;
  let pendingKVs: { label: string; value: string }[] = [];
  let pendingSession: { date: string | null; lines: string[] } | null = null;

  const flushPendingKVs = () => {
    if (pendingKVs.length > 0 && currentSectionFlag === 'identification') {
      blocks.push({ type: 'kv', content: '', pairs: [...pendingKVs], sectionFlag: 'identification' });
      pendingKVs = [];
    } else if (pendingKVs.length > 0) {
      // Render as inline kv text
      for (const kv of pendingKVs) {
        blocks.push({ type: 'text', content: `${kv.label}: ${kv.value}` });
      }
      pendingKVs = [];
    }
  };

  const flushPendingSession = () => {
    if (pendingSession) {
      blocks.push({ type: 'session', content: '', sessionLines: pendingSession.lines, pairs: pendingSession.date ? [{ label: 'date', value: pendingSession.date }] : [] });
      pendingSession = null;
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (trimmed === '') continue;
    if (isSignatureLine(trimmed)) continue;
    if (/^[-*=]{3,}$/.test(trimmed)) continue;
    if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;

    const lineType = classifyLine(trimmed);

    // Major section heading
    if (lineType === 'section' || lineType === 'allcaps' || lineType === 'mdheading') {
      flushPendingKVs();
      flushPendingSession();
      const headingText = stripNumbering(trimmed.replace(/^#{1,3}\s/, ''));
      if (isIdentificationHeading(headingText)) {
        currentSectionFlag = 'identification';
        // Skip rendering this heading entirely — title already implies identification
        continue;
      } else if (isExecSummaryHeading(headingText)) {
        currentSectionFlag = 'summary';
        blocks.push({ type: 'heading', content: headingText });
        continue;
      } else {
        currentSectionFlag = null;
        blocks.push({ type: 'heading', content: headingText });
        continue;
      }
    }

    // Sub-section: detect session
    const sessionInfo = parseSessionHeading(trimmed);
    if (sessionInfo || (lineType === 'subsection' && /sess[ãa]o/i.test(trimmed))) {
      flushPendingKVs();
      flushPendingSession();
      const dateMatch = trimmed.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      pendingSession = { date: dateMatch ? dateMatch[1] : null, lines: [] };
      continue;
    }

    if (lineType === 'subsection') {
      flushPendingKVs();
      flushPendingSession();
      blocks.push({ type: 'subheading', content: stripNumbering(trimmed) });
      continue;
    }

    // Pipe table 2-col
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.split('|').filter(c => c.trim() !== '');
      if (cells.length === 2) {
        if (pendingSession) { pendingSession.lines.push(`${cells[0].trim()}: ${cells[1].trim()}`); continue; }
        pendingKVs.push({ label: cells[0].trim(), value: cells[1].trim() });
        continue;
      }
    }

    // Key-value match
    const kvMatch = trimmed.match(/^([A-ZÀ-Ú][^:]{2,40}):\s*(.+)$/);
    if (kvMatch && !trimmed.startsWith('http')) {
      if (pendingSession) { pendingSession.lines.push(trimmed); continue; }
      pendingKVs.push({ label: kvMatch[1].trim(), value: kvMatch[2].trim() });
      continue;
    }

    // Bullet
    if (/^[-•]\s/.test(trimmed)) {
      flushPendingKVs();
      const itemText = trimmed.slice(2).trim();
      if (pendingSession) { pendingSession.lines.push(`• ${itemText}`); continue; }
      blocks.push({ type: 'bullet', content: itemText });
      continue;
    }

    // Numbered
    const numberedMatch = trimmed.match(/^(\d+[.)\\])\s+(.+)/);
    if (numberedMatch && lineType !== 'section') {
      flushPendingKVs();
      blocks.push({ type: 'numbered', content: `${numberedMatch[1]} ${numberedMatch[2]}` });
      continue;
    }

    // Regular text
    flushPendingKVs();
    if (pendingSession) {
      pendingSession.lines.push(trimmed);
    } else {
      blocks.push({ type: 'text', content: trimmed });
    }
  }
  flushPendingKVs();
  flushPendingSession();

  // Try to extract structured data from collected KV blocks
  const allKVs: { label: string; value: string }[] = [];
  for (const b of blocks) {
    if (b.type === 'kv' && b.pairs) allKVs.push(...b.pairs);
  }

  const findKV = (regex: RegExp): string | undefined => {
    const f = allKVs.find(k => regex.test(k.label));
    return f?.value;
  };

  // Build identification grid
  const identificationPairs: { label: string; value: string }[] = [];
  const addPair = (label: string, value: string | undefined) => {
    if (value && value.trim()) identificationPairs.push({ label, value: value.trim() });
  };
  addPair('Nome do Paciente', findKV(/nome.*paciente|^paciente$/i));
  addPair('Data de Nascimento', findKV(/nascimento/i));
  addPair('Instituição', findKV(/institui[çc][ãa]o/i));
  addPair('Área Clínica', findKV(/[áa]rea\s+cl[íi]nica/i));
  addPair('Diagnóstico', findKV(/diagn[óo]stico/i));
  addPair('Profissional Responsável', findKV(/profission[ai]l|terapeuta|respons[áa]vel/i));

  // Build stat cards from summary KVs
  const summaryStats: { label: string; value: string }[] = [];
  const addStat = (label: string, regex: RegExp) => {
    const v = findKV(regex);
    if (v) summaryStats.push({ label, value: v });
  };
  addStat('Total de Sessões', /total\s+de\s+sess|sess[õo]es\s+totais/i);
  addStat('Presenças', /^presen[çc]as|compareceu/i);
  addStat('Faltas', /^faltas|aus[êe]ncias/i);
  addStat('Taxa de Presença', /taxa\s+de\s+presen|frequ[êe]ncia/i);

  // ═══════════════════════════════════════
  // ── RENDER BLOCKS ──
  // ═══════════════════════════════════════

  // Always render identification grid first if we have data
  if (identificationPairs.length > 0) {
    drawSectionHeading('Identificação');
    drawKeyValueGrid(identificationPairs);
  }

  let summaryRendered = false;

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];

    if (b.type === 'heading') {
      // Skip identification (already rendered)
      if (isIdentificationHeading(b.content)) continue;

      drawSectionHeading(b.content);

      // Special rendering for Resumo Executivo
      if (isExecSummaryHeading(b.content) && summaryStats.length > 0 && !summaryRendered) {
        drawStatCards(summaryStats);
        summaryRendered = true;
        // Skip the upcoming KV block that contains the same data
        const next = blocks[bi + 1];
        if (next && next.type === 'kv') bi++;
      }
      continue;
    }

    if (b.type === 'subheading') {
      ensureHeadingWithBody(7);
      y += 3;
      pdf.setFont(FONT, 'bold');
      pdf.setFontSize(BODY_SIZE + 0.5);
      pdf.setTextColor(...BRAND);
      pdf.text(b.content, MARGIN, y);
      y += 5;
      continue;
    }

    if (b.type === 'kv' && b.pairs) {
      // Skip identification KVs (already rendered as grid)
      if (b.sectionFlag === 'identification') continue;
      // Skip summary KVs if cards rendered
      if (summaryRendered && b.pairs.some(p => /sess[õo]es|presen[çc]a|falta|taxa/i.test(p.label))) continue;
      // Otherwise render inline
      for (const kv of b.pairs) {
        ensureSpace(LINE_HEIGHT * 2);
        pdf.setFont(FONT, 'bold');
        pdf.setFontSize(BODY_SIZE);
        pdf.setTextColor(...TEXT_DARK);
        const label = `${kv.label}: `;
        const labelW = pdf.getTextWidth(label);
        pdf.text(label, MARGIN, y);
        pdf.setFont(FONT, 'normal');
        const lines: string[] = pdf.splitTextToSize(kv.value, CONTENT_W - labelW);
        pdf.text(lines[0], MARGIN + labelW, y);
        y += LINE_HEIGHT;
        for (let li = 1; li < lines.length; li++) {
          ensureSpace(LINE_HEIGHT);
          pdf.text(lines[li], MARGIN, y);
          y += LINE_HEIGHT;
        }
        y += 1;
      }
      continue;
    }

    if (b.type === 'session') {
      const date = b.pairs && b.pairs[0]?.value ? b.pairs[0].value : null;
      drawSessionCard(date, b.sessionLines || []);
      continue;
    }

    if (b.type === 'bullet') {
      ensureSpace(LINE_HEIGHT);
      pdf.setFont(FONT, 'normal');
      pdf.setFontSize(BODY_SIZE);
      pdf.setTextColor(...TEXT_DARK);
      pdf.setFillColor(...BRAND);
      pdf.circle(MARGIN + 2, y - 1.5, 0.7, 'F');
      const wrapped: string[] = pdf.splitTextToSize(b.content, CONTENT_W - 8);
      for (let wi = 0; wi < wrapped.length; wi++) {
        if (wi > 0) ensureSpace(LINE_HEIGHT);
        pdf.text(wrapped[wi], MARGIN + 6, y);
        y += LINE_HEIGHT;
      }
      y += 1;
      continue;
    }

    if (b.type === 'numbered') {
      writeText(b.content);
      y += 1;
      continue;
    }

    // Plain text
    writeText(b.content);
    y += PARAGRAPH_GAP;
  }

  // ═══════════════════════════════════════
  // ── SIGNATURE BLOCK ──
  // ═══════════════════════════════════════
  const sigLineW = 65;
  const sigCenterX = PAGE_W / 2;
  const sigSpacingAbove = 14;

  // Estimate height
  let sigImgH = 0, stImgH = 0;
  if (therapistSignatureImage) {
    try {
      const si = await loadImageFromUrl(therapistSignatureImage);
      sigImgH = Math.min((si.height / si.width) * 50, 16) + 2;
    } catch { /* skip */ }
  }
  if (therapistStampImage) {
    try {
      const sti = await loadImageFromUrl(therapistStampImage);
      stImgH = Math.min((sti.height / sti.width) * 38, 22) + 2;
    } catch { /* skip */ }
  }
  const textRows = 1 + (therapistClinicalArea ? 1 : 0) + (therapistCbo ? 1 : 0) + (therapistProfessionalId ? 1 : 0);
  const sigBlockHeight = sigSpacingAbove + sigImgH + stImgH + 6 + textRows * 4.5 + 4;

  if (y + sigBlockHeight > USABLE_BOTTOM) {
    pdf.addPage();
    y = MARGIN;
  }

  let sigY = y + sigSpacingAbove;

  // Signature image
  if (therapistSignatureImage) {
    try {
      const sigImg = await loadImageFromUrl(therapistSignatureImage);
      const sigW = 45;
      const sigH = Math.min((sigImg.height / sigImg.width) * sigW, 14);
      pdf.addImage(therapistSignatureImage, 'PNG', sigCenterX - sigW / 2, sigY, sigW, sigH);
      sigY += sigH + 2;
    } catch { /* skip */ }
  }

  // Stamp image (ONLY ONCE, centered)
  if (therapistStampImage) {
    try {
      const stImg = await loadImageFromUrl(therapistStampImage);
      const stW = 38;
      const stH = Math.min((stImg.height / stImg.width) * stW, 20);
      pdf.addImage(therapistStampImage, 'PNG', sigCenterX - stW / 2, sigY, stW, stH);
      sigY += stH + 2;
    } catch { /* skip */ }
  }

  // Signature line
  pdf.setDrawColor(...TEXT_MED);
  pdf.setLineWidth(0.4);
  pdf.line(sigCenterX - sigLineW / 2, sigY, sigCenterX + sigLineW / 2, sigY);
  sigY += 4.5;

  // Therapist name
  pdf.setFont(FONT, 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...TEXT_DARK);
  pdf.text(therapistName || 'Profissional Responsável', sigCenterX, sigY, { align: 'center' });
  sigY += 4.5;

  // Sub info
  pdf.setFont(FONT, 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...TEXT_MED);
  if (therapistClinicalArea) {
    pdf.text(therapistClinicalArea, sigCenterX, sigY, { align: 'center' });
    sigY += 4;
  }
  const credentials: string[] = [];
  if (therapistCbo) credentials.push(`CBO ${therapistCbo}`);
  if (therapistProfessionalId) credentials.push(`Reg. ${therapistProfessionalId}`);
  if (credentials.length > 0) {
    pdf.text(credentials.join(' • '), sigCenterX, sigY, { align: 'center' });
  }

  // ═══════════════════════════════════════
  // ── FOOTER ON ALL PAGES ──
  // ═══════════════════════════════════════
  const totalPages = pdf.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    pdf.setPage(pg);

    const footerY = PAGE_H - MARGIN;

    // Lilac divider
    pdf.setDrawColor(...BRAND_BORDER);
    pdf.setLineWidth(0.4);
    pdf.line(MARGIN, footerY - 9, PAGE_W - MARGIN, footerY - 9);

    // Clinic info (line 1: name • cnpj | line 2: address • phone • email)
    const line1Parts: string[] = [];
    if (clinicName) line1Parts.push(clinicName);
    if (clinicCnpj) line1Parts.push(`CNPJ ${clinicCnpj}`);

    const line2Parts: string[] = [];
    if (clinicAddress) line2Parts.push(clinicAddress);
    if (clinicPhone) line2Parts.push(clinicPhone);
    if (clinicEmail) line2Parts.push(clinicEmail);

    pdf.setFont(FONT, 'bold');
    pdf.setFontSize(FOOTER_SIZE);
    pdf.setTextColor(...BRAND);
    if (line1Parts.length > 0) {
      pdf.text(line1Parts.join('  •  '), PAGE_W / 2, footerY - 6, { align: 'center' });
    }

    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(FOOTER_SIZE - 0.5);
    pdf.setTextColor(...TEXT_SOFT);
    if (line2Parts.length > 0) {
      pdf.text(line2Parts.join('  •  '), PAGE_W / 2, footerY - 3, { align: 'center' });
    }

    // Page number (right) + confidential (left)
    pdf.setFont(FONT, 'normal');
    pdf.setFontSize(FOOTER_SIZE - 0.5);
    pdf.setTextColor(...TEXT_SOFT);
    pdf.text(`Página ${pg} de ${totalPages}`, PAGE_W - MARGIN, footerY, { align: 'right' });

    pdf.setFont(FONT, 'italic');
    pdf.setFontSize(FOOTER_SIZE - 1);
    pdf.setTextColor(...TEXT_SOFT);
    pdf.text('Documento confidencial — uso exclusivo profissional', MARGIN, footerY);
  }

  const safeName = (fileName || title).replace(/\s+/g, '_');
  pdf.save(`${safeName}.pdf`);
  toast.success('PDF exportado!');
}
