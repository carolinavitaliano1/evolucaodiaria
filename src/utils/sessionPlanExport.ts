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
  let y = MARGIN;

  const checkPage = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // ─ Header ─
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleText = `Planejamento - ${title}`;
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, (PAGE_WIDTH - titleWidth) / 2, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  const sub1 = `Sessão: ${sessionTitle}`;
  doc.text(sub1, (PAGE_WIDTH - doc.getTextWidth(sub1)) / 2, y);
  y += 5;
  const sub2 = `Data: ${dateStr}`;
  doc.text(sub2, (PAGE_WIDTH - doc.getTextWidth(sub2)) / 2, y);
  y += 3;

  // Separator line
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;
  doc.setTextColor(0);

  const lines = parseMarkdown(notes);

  for (const line of lines) {
    if (line.type === 'empty') {
      y += 3;
      continue;
    }

    const plainText = line.segments.map(s => s.text).join('');

    if (line.type === 'heading1') {
      checkPage(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const w = doc.getTextWidth(plainText);
      doc.text(plainText, (PAGE_WIDTH - w) / 2, y);
      y += 8;
    } else if (line.type === 'heading2') {
      checkPage(10);
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(plainText, MARGIN, y);
      y += 6;
    } else if (line.type === 'heading3') {
      checkPage(12);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(plainText, MARGIN, y);
      y += 1;
      doc.setDrawColor(180);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
      y += 5;
    } else if (line.type === 'bullet' || line.type === 'sub_bullet') {
      const indent = line.type === 'sub_bullet' ? MARGIN + 8 : MARGIN + 3;
      const bulletChar = line.type === 'sub_bullet' ? '◦' : '•';
      const textX = indent + 4;
      const availWidth = PAGE_WIDTH - MARGIN - textX;

      // Render segments with inline bold/italic
      checkPage(6);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(bulletChar, indent, y);

      // Use splitTextToSize for wrapping, render segments
      const fullText = line.segments.map(s => s.text).join('');
      const wrapped = doc.splitTextToSize(fullText, availWidth);

      for (let wi = 0; wi < wrapped.length; wi++) {
        checkPage(5);
        // For first line, render segments with formatting
        if (wi === 0) {
          renderSegmentsOnLine(doc, line.segments, textX, y, availWidth);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text(wrapped[wi], textX, y);
        }
        y += 4.5;
      }
      y += 0.5;
    } else {
      // Paragraph
      checkPage(6);
      doc.setFontSize(10);

      const fullText = line.segments.map(s => s.text).join('');
      const wrapped = doc.splitTextToSize(fullText, maxWidth);

      for (let wi = 0; wi < wrapped.length; wi++) {
        checkPage(5);
        if (wi === 0) {
          renderSegmentsOnLine(doc, line.segments, MARGIN, y, maxWidth);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.text(wrapped[wi], MARGIN, y);
        }
        y += 4.5;
      }
      y += 1;
    }
  }

  doc.save(`${fileName}.pdf`);
}

// Render inline segments (bold/italic) on a single line
function renderSegmentsOnLine(doc: jsPDF, segments: TextSegment[], x: number, y: number, _maxWidth: number) {
  let currentX = x;
  for (const seg of segments) {
    if (!seg.text) continue;
    const fontStyle = seg.bold && seg.italic ? 'bolditalic' : seg.bold ? 'bold' : seg.italic ? 'italic' : 'normal';
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(10);
    doc.text(seg.text, currentX, y);
    currentX += doc.getTextWidth(seg.text);
  }
}
