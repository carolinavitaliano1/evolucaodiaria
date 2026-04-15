import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, TabStopType, TabStopPosition } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';

// ─── Markdown Parser ───
interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

interface ParsedLine {
  type: 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'sub_bullet' | 'paragraph' | 'empty';
  segments: TextSegment[];
  raw: string;
}

function parseMarkdownLine(line: string): ParsedLine {
  const trimmed = line.trim();

  if (!trimmed) return { type: 'empty', segments: [], raw: '' };

  // Detect heading level
  let type: ParsedLine['type'] = 'paragraph';
  let content = trimmed;

  if (/^#{3,}\s+/.test(content)) {
    type = 'heading3';
    content = content.replace(/^#{3,}\s+/, '');
  } else if (/^##\s+/.test(content)) {
    type = 'heading2';
    content = content.replace(/^##\s+/, '');
  } else if (/^#\s+/.test(content)) {
    type = 'heading1';
    content = content.replace(/^#\s+/, '');
  }

  // Detect bullet - check original indentation for sub-bullets
  if (/^\s{2,}[*\-•]\s+/.test(line) || /^\s{2,}\d+\.\s+/.test(line)) {
    type = 'sub_bullet';
    content = content.replace(/^[*\-•]\s+/, '').replace(/^\d+\.\s+/, '');
  } else if (/^[*\-•]\s+/.test(content)) {
    type = 'bullet';
    content = content.replace(/^[*\-•]\s+/, '');
  }

  // Parse inline formatting (bold + italic)
  const segments: TextSegment[] = [];
  // Match **bold**, *italic*, ***bold+italic***
  const regex = /(\*{3}(.+?)\*{3}|\*{2}(.+?)\*{2}|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: content.slice(lastIndex, match.index), bold: false, italic: false });
    }
    if (match[2]) {
      // ***bold+italic***
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      // **bold**
      segments.push({ text: match[3], bold: true, italic: false });
    } else if (match[4]) {
      // *italic*
      segments.push({ text: match[4], bold: false, italic: true });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ text: content.slice(lastIndex), bold: false, italic: false });
  }

  // If line is all-caps heading pattern (e.g. "1. OBJETIVOS CLÍNICOS GERAIS"), make bold
  if (type === 'paragraph' && /^\d+\.\s+[A-ZÁÉÍÓÚÃÕÂÊÔÇ\s/()]+$/.test(content)) {
    type = 'heading2';
    segments.forEach(s => s.bold = true);
  }

  // If starts with "PACIENTE:" pattern, treat as heading3
  if (type === 'paragraph' && /^PACIENTE:/i.test(content)) {
    type = 'heading3';
    segments.forEach(s => s.bold = true);
  }

  return { type, segments, raw: content };
}

function parseMarkdown(text: string): ParsedLine[] {
  return text.split('\n').map(parseMarkdownLine);
}

// ─── Word Export ───
export async function downloadNextSessionAsWord(
  notes: string,
  title: string,
  sessionTitle: string,
  dateStr: string,
  fileName: string,
) {
  const lines = parseMarkdown(notes);
  const children: Paragraph[] = [];

  // Header
  children.push(new Paragraph({
    children: [new TextRun({ text: `Planejamento - ${title}`, bold: true, size: 32, font: 'Arial' })],
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Sessão: ${sessionTitle}`, size: 22, color: '666666', font: 'Arial' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Data: ${dateStr}`, size: 20, color: '999999', font: 'Arial' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  for (const line of lines) {
    if (line.type === 'empty') {
      children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      continue;
    }

    const runs = line.segments.map(seg => new TextRun({
      text: seg.text,
      bold: seg.bold || line.type === 'heading1' || line.type === 'heading2',
      italics: seg.italic,
      size: line.type === 'heading1' ? 30 : line.type === 'heading2' ? 26 : line.type === 'heading3' ? 24 : 22,
      font: 'Arial',
    }));

    if (line.type === 'heading1') {
      children.push(new Paragraph({
        children: runs,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 300, after: 200 },
      }));
    } else if (line.type === 'heading2') {
      children.push(new Paragraph({
        children: runs,
        spacing: { before: 240, after: 120 },
      }));
    } else if (line.type === 'heading3') {
      // Add extra space before patient blocks
      children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
      children.push(new Paragraph({
        children: runs,
        spacing: { before: 200, after: 120 },
        border: { bottom: { style: 'single' as any, size: 1, color: 'CCCCCC', space: 4 } },
      }));
    } else if (line.type === 'bullet') {
      children.push(new Paragraph({
        children: [new TextRun({ text: '•  ', font: 'Arial', size: 22 }), ...runs],
        indent: { left: 360 },
        spacing: { after: 80 },
        alignment: AlignmentType.JUSTIFIED,
      }));
    } else if (line.type === 'sub_bullet') {
      children.push(new Paragraph({
        children: [new TextRun({ text: '◦  ', font: 'Arial', size: 22 }), ...runs],
        indent: { left: 720 },
        spacing: { after: 60 },
        alignment: AlignmentType.JUSTIFIED,
      }));
    } else {
      children.push(new Paragraph({
        children: runs,
        spacing: { after: 100 },
        alignment: AlignmentType.JUSTIFIED,
      }));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // 2cm margins
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${fileName}.docx`);
}

// ─── PDF Export ───
export function downloadNextSessionAsPdf(
  notes: string,
  title: string,
  sessionTitle: string,
  dateStr: string,
  fileName: string,
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const PAGE_WIDTH = 210;
  const PAGE_HEIGHT = 297;
  const MARGIN = 20;
  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  const LINE_HEIGHT = 5;
  const SECTION_GAP = 4;
  let y = MARGIN;

  const checkPage = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Helper: render a line with inline bold/italic segments, handling word-wrap
  const renderFormattedBlock = (segments: TextSegment[], startX: number, availWidth: number, fontSize: number) => {
    doc.setFontSize(fontSize);

    // Build words with their formatting
    const words: { text: string; bold: boolean; italic: boolean }[] = [];
    for (const seg of segments) {
      if (!seg.text) continue;
      const parts = seg.text.split(/(\s+)/);
      for (const part of parts) {
        if (part) words.push({ text: part, bold: seg.bold, italic: seg.italic });
      }
    }

    let currentX = startX;
    for (const word of words) {
      const fontStyle = word.bold && word.italic ? 'bolditalic' : word.bold ? 'bold' : word.italic ? 'italic' : 'normal';
      doc.setFont('helvetica', fontStyle);
      doc.setFontSize(fontSize);
      const wordWidth = doc.getTextWidth(word.text);

      // Check if we need to wrap (skip for whitespace-only)
      if (word.text.trim() && currentX + wordWidth > startX + availWidth && currentX > startX) {
        y += LINE_HEIGHT;
        checkPage(LINE_HEIGHT);
        currentX = startX;
      }

      doc.text(word.text, currentX, y);
      currentX += wordWidth;
    }
    y += LINE_HEIGHT;
  };

  // ═══════════════════════════════════════
  // HEADER — matches Word: centered title, subtitle, date
  // ═══════════════════════════════════════
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const titleText = `Planejamento - ${title}`;
  const titleLines = doc.splitTextToSize(titleText, maxWidth);
  for (const tl of titleLines) {
    doc.text(tl, PAGE_WIDTH / 2, y, { align: 'center' });
    y += 7;
  }
  y += 1;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Sessão: ${sessionTitle}`, PAGE_WIDTH / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Data: ${dateStr}`, PAGE_WIDTH / 2, y, { align: 'center' });
  y += 4;

  // Separator
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;
  doc.setTextColor(0);

  // ═══════════════════════════════════════
  // BODY — parse and render each line
  // ═══════════════════════════════════════
  const lines = parseMarkdown(notes);

  for (const line of lines) {
    if (line.type === 'empty') {
      y += 3;
      continue;
    }

    const plainText = line.segments.map(s => s.text).join('');

    // ── Heading 1: Main title (centered, large, bold) ──
    if (line.type === 'heading1') {
      checkPage(14);
      y += SECTION_GAP;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const wrapped = doc.splitTextToSize(plainText, maxWidth);
      for (const wl of wrapped) {
        doc.text(wl, PAGE_WIDTH / 2, y, { align: 'center' });
        y += 6;
      }
      y += 2;
    }

    // ── Heading 2: Section titles (e.g., "1. OBJETIVOS CLÍNICOS GERAIS") ──
    else if (line.type === 'heading2') {
      checkPage(12);
      y += SECTION_GAP + 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const wrapped = doc.splitTextToSize(plainText, maxWidth);
      for (const wl of wrapped) {
        doc.text(wl, MARGIN, y);
        y += 5.5;
      }
      // Subtle underline
      doc.setDrawColor(220);
      doc.setLineWidth(0.15);
      doc.line(MARGIN, y - 1, PAGE_WIDTH - MARGIN, y - 1);
      y += 3;
    }

    // ── Heading 3: Patient blocks (e.g., "PACIENTE: BENJAMIN VITALIANO") ──
    else if (line.type === 'heading3') {
      checkPage(16);
      y += SECTION_GAP + 3;

      // Light background box for patient name
      doc.setFillColor(245, 245, 250);
      doc.setDrawColor(210, 210, 220);
      doc.setLineWidth(0.2);
      const boxH = 8;
      doc.roundedRect(MARGIN, y - 5, maxWidth, boxH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 80);
      doc.text(plainText, MARGIN + 4, y);
      doc.setTextColor(0);
      y += boxH + 2;
    }

    // ── Bullet points ──
    else if (line.type === 'bullet') {
      const bulletIndent = MARGIN + 4;
      const textX = bulletIndent + 4;
      const availWidth = PAGE_WIDTH - MARGIN - textX;

      checkPage(LINE_HEIGHT + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('•', bulletIndent, y);

      renderFormattedBlock(line.segments, textX, availWidth, 10);
      y += 1;
    }

    // ── Sub-bullet points ──
    else if (line.type === 'sub_bullet') {
      const bulletIndent = MARGIN + 10;
      const textX = bulletIndent + 4;
      const availWidth = PAGE_WIDTH - MARGIN - textX;

      checkPage(LINE_HEIGHT + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(80);
      doc.text('◦', bulletIndent, y);
      doc.setTextColor(0);

      renderFormattedBlock(line.segments, textX, availWidth, 9.5);
      y += 0.5;
    }

    // ── Regular paragraph ──
    else {
      checkPage(LINE_HEIGHT + 2);
      renderFormattedBlock(line.segments, MARGIN, maxWidth, 10);
      y += 1.5;
    }
  }

  doc.save(`${fileName}.pdf`);
}
