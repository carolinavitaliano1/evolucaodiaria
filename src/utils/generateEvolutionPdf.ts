import jsPDF from 'jspdf';
import { Evolution, Patient, Clinic } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LINE_HEIGHT = 6.5; // mm — comfortable reading line height (~1.5x at 10pt)
const PARA_SPACING = 4;  // mm — extra space between paragraphs

// Sanitize text: keep full Latin + extended Latin (accents, cedilla, etc.)
// Only remove actual emoji/symbols that jsPDF can't render
function sanitizeLine(text: string): string {
  return text
    .replace(/✅/g, '[x]')
    .replace(/[\u2600-\u27BF\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[^\u0000-\u024F\u2010-\u2027\u2030-\u205E\u2060-\u2FFF\u3000-\u303F ]/g, '');
}

// Reset font to body style — must be called after every addHeader() since it sets 16pt bold
function resetBodyFont(pdf: jsPDF) {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(0, 0, 0);
}

// Renders a justified line by distributing space evenly between words.
// Falls back to left-align for last lines or when gaps would be too large.
function drawJustifiedLine(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  isLastLine: boolean
) {
  const trimmed = text.trimEnd();
  if (isLastLine || trimmed === '') {
    pdf.text(trimmed, x, y);
    return;
  }
  const words = trimmed.split(' ').filter(w => w.length > 0);
  if (words.length <= 1) {
    pdf.text(trimmed, x, y);
    return;
  }
  const wordsWidth = words.reduce((acc, w) => acc + pdf.getTextWidth(w), 0);
  const normalSpace = pdf.getTextWidth(' ');
  const gaps = words.length - 1;
  const spaceWidth = (maxWidth - wordsWidth) / gaps;
  if (spaceWidth > normalSpace * 2.5) {
    pdf.text(trimmed, x, y);
    return;
  }
  let curX = x;
  for (let i = 0; i < words.length; i++) {
    pdf.text(words[i], curX, y);
    if (i < words.length - 1) curX += pdf.getTextWidth(words[i]) + spaceWidth;
  }
}

interface StampData {
  id: string;
  name: string;
  clinical_area: string;
  stamp_image: string | null;
  signature_image: string | null;
}

interface GenerateSinglePdfOptions {
  evolution: Evolution;
  patient: Patient;
  clinic?: Clinic;
  stamps?: StampData[];
}

interface GenerateMultiplePdfOptions {
  evolutions: Evolution[];
  patient: Patient;
  clinic?: Clinic;
  startDate?: Date;
  endDate?: Date;
  stamps?: StampData[];
}

export interface GenerateAllPatientsPdfOptions {
  items: { evolution: Evolution; patient: Patient }[];
  clinic?: Clinic;
  date: Date;
  stamps?: StampData[];
}

// ─── ALL PATIENTS DAILY PDF ──────────────────────────────────────────────────

export async function generateAllPatientsPdf({ items, clinic, date, stamps }: GenerateAllPatientsPdfOptions): Promise<void> {
  if (items.length === 0) return;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const textX = margin + 5;
  const textWidth = contentWidth - 10;
  const bottomSafe = 55;

  // addHeader RETURNS the new y position — does NOT use closure mutation
  const addHeader = async (): Promise<number> => {
    let hy = margin;
    if (clinic?.letterhead) {
      try {
        const img = await loadImage(clinic.letterhead);
        const finalHeight = Math.min((img.height / img.width) * contentWidth, 40);
        pdf.addImage(clinic.letterhead, 'PNG', margin, hy, contentWidth, finalHeight);
        hy += finalHeight + 10;
      } catch {}
    }
    if (clinic) {
      pdf.setFontSize(16); pdf.setFont('helvetica', 'bold');
      pdf.text(clinic.name, pageWidth / 2, hy, { align: 'center' });
      hy += 8;
      if (clinic.address) {
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
        pdf.text(clinic.address, pageWidth / 2, hy, { align: 'center' });
        hy += 6;
      }
    }
    hy += 5;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, hy, pageWidth - margin, hy);
    hy += 10;
    resetBodyFont(pdf); // always reset after header rendering
    return hy;
  };

  let y = await addHeader();

  pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
  pdf.text('EVOLUÇÕES DO DIA', pageWidth / 2, y, { align: 'center' });
  y += 6;
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
  pdf.text(format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), pageWidth / 2, y, { align: 'center' });
  y += 12;

  for (let pi = 0; pi < items.length; pi++) {
    const { evolution: evo, patient } = items[pi];

    if (y > pageHeight - 120) {
      pdf.addPage();
      y = await addHeader();
    }

    // Patient header bar
    pdf.setFillColor(240, 240, 255);
    pdf.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
    pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0, 0, 0);
    pdf.text(patient.name, textX, y + 8);
    if (patient.clinicalArea) {
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120, 120, 120);
      pdf.text(patient.clinicalArea, pageWidth - margin - 5, y + 8, { align: 'right' });
      pdf.setTextColor(0, 0, 0);
    }
    y += 16;

    // Attendance status
    const statusText = evo.attendanceStatus === 'presente' ? 'PRESENTE'
      : evo.attendanceStatus === 'falta_remunerada' ? 'FALTA REMUNERADA'
      : evo.attendanceStatus === 'reposicao' ? 'REPOSIÇÃO'
      : evo.attendanceStatus === 'feriado_remunerado' ? 'FERIADO REMUNERADO'
      : evo.attendanceStatus === 'feriado_nao_remunerado' ? 'FERIADO'
      : 'FALTA';
    const statusColor: [number, number, number] =
      ['presente', 'reposicao', 'feriado_remunerado'].includes(evo.attendanceStatus)
        ? [34, 197, 94]
        : evo.attendanceStatus === 'falta_remunerada' ? [234, 179, 8] : [239, 68, 68];
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...statusColor);
    pdf.text(statusText, textX, y);
    pdf.setTextColor(0, 0, 0); pdf.setFont('helvetica', 'normal');
    y += LINE_HEIGHT + 1;

    // Evolution text
    y = await renderEvolutionText(pdf, evo.text, textX, y, textWidth, pageHeight, bottomSafe, addHeader);

    // Mandatory gap before signature/stamp area
    y += 10;

    // Signature
    if (evo.signature) {
      try {
        if (y + 30 > pageHeight - bottomSafe) {
          pdf.addPage();
          y = await addHeader();
        }
        pdf.addImage(evo.signature, 'PNG', pageWidth - margin - 50, y, 45, 20);
        pdf.setFontSize(8); pdf.setTextColor(128, 128, 128);
        pdf.text('Assinatura digital', pageWidth - margin - 27.5, y + 23, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
        y += 28;
      } catch {}
    }

    // Per-evolution stamp
    if (evo.stampId && stamps) {
      y = await renderStamp(pdf, evo.stampId, stamps, pageWidth, pageHeight, margin, y, bottomSafe, addHeader);
    }

    if (pi < items.length - 1) {
      y += 5;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;
    }
  }

  addFooters(pdf, pageWidth, pageHeight, margin);
  pdf.save(`evolucoes_${format(date, 'dd-MM-yyyy')}.pdf`);
}

// ─── SINGLE / MULTIPLE EVOLUTIONS PDF ────────────────────────────────────────

export async function generateEvolutionPdf({ evolution, patient, clinic, stamps }: GenerateSinglePdfOptions): Promise<void> {
  return generateMultipleEvolutionsPdf({ evolutions: [evolution], patient, clinic, stamps });
}

export async function generateMultipleEvolutionsPdf({
  evolutions,
  patient,
  clinic,
  startDate,
  endDate,
  stamps,
}: GenerateMultiplePdfOptions): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const textX = margin + 5;
  const textWidth = contentWidth - 10;
  const bottomSafe = 55;

  // addHeader RETURNS the new y position — does NOT use closure mutation
  const addHeader = async (): Promise<number> => {
    let hy = margin;
    if (clinic?.letterhead) {
      try {
        const img = await loadImage(clinic.letterhead);
        const finalHeight = Math.min((img.height / img.width) * contentWidth, 40);
        pdf.addImage(clinic.letterhead, 'PNG', margin, hy, contentWidth, finalHeight);
        hy += finalHeight + 10;
      } catch {}
    }
    if (clinic) {
      pdf.setFontSize(16); pdf.setFont('helvetica', 'bold');
      pdf.text(clinic.name, pageWidth / 2, hy, { align: 'center' });
      hy += 8;
      if (clinic.address) {
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
        pdf.text(clinic.address, pageWidth / 2, hy, { align: 'center' });
        hy += 6;
      }
    }
    hy += 5;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, hy, pageWidth - margin, hy);
    hy += 10;
    resetBodyFont(pdf);
    return hy;
  };

  let y = await addHeader();

  // Title
  pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
  pdf.text(
    evolutions.length > 1 ? 'RELATÓRIO DE EVOLUÇÕES' : 'EVOLUÇÃO DO PACIENTE',
    pageWidth / 2, y, { align: 'center' }
  );
  y += 10;

  if (evolutions.length > 1 && startDate && endDate) {
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
    pdf.text(
      `Período: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`,
      pageWidth / 2, y, { align: 'center' }
    );
    y += 8;
  }
  y += 5;

  // Patient info box
  pdf.setFillColor(245, 245, 245);
  pdf.roundedRect(margin, y, contentWidth, 18, 3, 3, 'F');
  pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
  pdf.text('Paciente:', textX, y + 8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(patient.name, margin + 30, y + 8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Total de sessões:', textX, y + 14);
  pdf.setFont('helvetica', 'normal');
  const presentes = evolutions.filter(e => e.attendanceStatus === 'presente').length;
  const faltas = evolutions.filter(e => e.attendanceStatus === 'falta').length;
  const faltasRem = evolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
  const summaryParts = [`${presentes} presenças`, `${faltas} faltas`];
  if (faltasRem > 0) summaryParts.push(`${faltasRem} faltas remuneradas`);
  pdf.text(summaryParts.join(', '), margin + 48, y + 14);
  y += 28;

  // Each evolution
  for (let i = 0; i < evolutions.length; i++) {
    const evo = evolutions[i];

    if (y > pageHeight - 120) {
      pdf.addPage();
      y = await addHeader();
    }

    // Date header bar
    pdf.setFillColor(250, 250, 250);
    pdf.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
    const [yr, mo, da] = evo.date.split('-').map(Number);
    pdf.text(format(new Date(yr, mo - 1, da), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), textX, y + 7);

    const statusText = evo.attendanceStatus === 'presente' ? 'PRESENTE'
      : evo.attendanceStatus === 'falta_remunerada' ? 'FALTA REMUNERADA'
      : evo.attendanceStatus === 'reposicao' ? 'REPOSIÇÃO'
      : evo.attendanceStatus === 'feriado_remunerado' ? 'FERIADO REMUNERADO'
      : evo.attendanceStatus === 'feriado_nao_remunerado' ? 'FERIADO'
      : 'FALTA';
    const sc = evo.attendanceStatus === 'presente' ? [34, 197, 94]
      : evo.attendanceStatus === 'falta_remunerada' ? [234, 179, 8] : [239, 68, 68];
    pdf.setTextColor(sc[0], sc[1], sc[2]);
    pdf.text(statusText, pageWidth - margin - 5, y + 7, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
    y += 15;

    // Evolution text
    y = await renderEvolutionText(pdf, evo.text, textX, y, textWidth, pageHeight, bottomSafe, addHeader);

    // Mandatory gap before signature/stamp area
    y += 12;

    // Signature (digital pad)
    if (evo.signature) {
      try {
        if (y + 30 > pageHeight - bottomSafe) {
          pdf.addPage();
          y = await addHeader();
        }
        pdf.addImage(evo.signature, 'PNG', pageWidth - margin - 50, y, 45, 20);
        pdf.setFontSize(8); pdf.setTextColor(128, 128, 128);
        pdf.text('Assinatura digital', pageWidth - margin - 27.5, y + 23, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
        y += 30;
      } catch {}
    }

    // Per-evolution stamp
    if (evo.stampId && stamps) {
      y = await renderStamp(pdf, evo.stampId, stamps, pageWidth, pageHeight, margin, y, bottomSafe, addHeader);
    }

    // Separator
    if (i < evolutions.length - 1) {
      y += 5;
      pdf.setDrawColor(220, 220, 220);
      pdf.line(margin + 20, y, pageWidth - margin - 20, y);
      y += 10;
    }
  }

  // Final clinic stamp (if stored on clinic object)
  if (clinic?.stamp) {
    try {
      const stampImg = await loadImage(clinic.stamp);
      const maxW = 60; const maxH = 40;
      let sw = maxW;
      let sh = (stampImg.height / stampImg.width) * sw;
      if (sh > maxH) { sh = maxH; sw = (stampImg.width / stampImg.height) * sh; }
      if (y + sh + 20 > pageHeight - 20) {
        pdf.addPage();
        y = await addHeader();
      }
      y += 15;
      const sx = pageWidth - margin - sw;
      pdf.addImage(clinic.stamp, 'PNG', sx, y, sw, sh);
      pdf.setDrawColor(100, 100, 100);
      pdf.line(sx, y + sh + 5, sx + sw, y + sh + 5);
      pdf.setFontSize(8); pdf.setTextColor(80, 80, 80);
      pdf.text('Carimbo da Clínica', sx + sw / 2, y + sh + 10, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
    } catch {}
  }

  addFooters(pdf, pageWidth, pageHeight, margin);

  const dateRange = evolutions.length > 1 && startDate && endDate
    ? `${format(startDate, 'dd-MM-yyyy')}_a_${format(endDate, 'dd-MM-yyyy')}`
    : (() => {
        const [y2, m2, d2] = evolutions[0].date.split('-').map(Number);
        return format(new Date(y2, m2 - 1, d2), 'dd-MM-yyyy');
      })();
  pdf.save(`evolucoes_${patient.name.replace(/\s+/g, '_')}_${dateRange}.pdf`);
}

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

/**
 * Renders evolution text with proper justification and line-height.
 * addHeader now returns the new y — this function uses the returned value after page breaks.
 */
async function renderEvolutionText(
  pdf: jsPDF,
  rawText: string,
  textX: number,
  startY: number,
  textWidth: number,
  pageHeight: number,
  bottomSafe: number,
  addHeader: () => Promise<number>
): Promise<number> {
  let y = startY;
  const lines = (rawText || 'Sem descrição.').split('\n');

  // Page break helper: adds new page, draws header, resets font, returns correct y
  const breakPage = async (): Promise<number> => {
    pdf.addPage();
    const newY = await addHeader();
    return newY;
  };

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const cleanLine = sanitizeLine(raw);

    // Empty line = paragraph break
    if (cleanLine.trim() === '') {
      y += PARA_SPACING;
      continue;
    }

    // Skip template model title line entirely (don't show template name)
    if (cleanLine.startsWith('[MODELO] ')) {
      continue;
    }

    // Horizontal rule
    if (cleanLine.trim() === '---') {
      pdf.setDrawColor(220, 220, 220);
      pdf.line(textX, y - 1, textX + textWidth, y - 1);
      y += 4;
      continue;
    }

    // Label: Value pattern (bold label, e.g. "Aspecto emocional: Bom")
    const colonIdx = cleanLine.indexOf(': ');
    const hasLabel = colonIdx > 0 && colonIdx < 50 && !cleanLine.startsWith(' ');
    if (hasLabel) {
      const label = cleanLine.slice(0, colonIdx + 2);
      const value = cleanLine.slice(colonIdx + 2);

      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
      const labelW = pdf.getTextWidth(label);

      if (value.trim() === '') {
        if (y + LINE_HEIGHT > pageHeight - bottomSafe) { y = await breakPage(); }
        pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
        pdf.text(label, textX, y);
        pdf.setFont('helvetica', 'normal');
        y += LINE_HEIGHT;
        continue;
      }

      pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
      const valueW = pdf.getTextWidth(value);

      if (y + LINE_HEIGHT > pageHeight - bottomSafe) { y = await breakPage(); }

      if (labelW + valueW <= textWidth) {
        // Single line: bold label + normal value inline
        pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
        pdf.text(label, textX, y);
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
        pdf.text(value, textX + labelW, y);
        y += LINE_HEIGHT;
      } else {
        // Multi-line: bold label inline on first line, then value continues at full textWidth
        pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
        pdf.text(label, textX, y);
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');

        // Split only the first segment to remainWidth (space after label on same line)
        const remainWidth = textWidth - labelW;
        const firstLineParts = pdf.splitTextToSize(value, remainWidth);
        const firstLineText = firstLineParts[0] as string;

        // Reconstruct the "rest" of the value after the first line
        const firstLineWords = firstLineText.trim().split(/\s+/);
        const allWords = value.trim().split(/\s+/);
        const restWords = allWords.slice(firstLineWords.length);
        const restText = restWords.join(' ');

        // Render first line inline after label (always last-line style = left-align if short)
        drawJustifiedLine(pdf, firstLineText, textX + labelW, y, remainWidth, restText === '');
        y += LINE_HEIGHT;

        // Render remaining lines at full textWidth with proper justification
        if (restText) {
          const restLines = pdf.splitTextToSize(restText, textWidth);
          for (let rl = 0; rl < restLines.length; rl++) {
            if (y + LINE_HEIGHT > pageHeight - bottomSafe) { y = await breakPage(); }
            pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
            drawJustifiedLine(pdf, restLines[rl], textX, y, textWidth, rl === restLines.length - 1);
            y += LINE_HEIGHT;
          }
        }
      }
      continue;
    }

    // Plain paragraph text — wrap and justify
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
    const wrapped = pdf.splitTextToSize(cleanLine, textWidth);
    for (let wl = 0; wl < wrapped.length; wl++) {
      if (y + LINE_HEIGHT > pageHeight - bottomSafe) {
        y = await breakPage();
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal');
      }
      drawJustifiedLine(pdf, wrapped[wl], textX, y, textWidth, wl === wrapped.length - 1);
      y += LINE_HEIGHT;
    }
  }

  return y;
}

/**
 * Renders stamp image + name below for a given evolution stamp.
 * Returns updated yPosition.
 */
async function renderStamp(
  pdf: jsPDF,
  stampId: string,
  stamps: StampData[],
  pageWidth: number,
  pageHeight: number,
  margin: number,
  startY: number,
  bottomSafe: number,
  addHeader: () => Promise<number>
): Promise<number> {
  const stamp = stamps.find(s => s.id === stampId);
  if (!stamp) return startY;

  let y = startY;
  const maxW = 50;
  const maxH = 28;

  // Estimate total stamp block height
  const estimatedH = maxH + 18 + 14; // stamp + sig + name lines
  if (y + estimatedH > pageHeight - bottomSafe) {
    pdf.addPage();
    y = await addHeader(); // get correct y from returned value
  }

  // Stamp image
  if (stamp.stamp_image) {
    try {
      const si = await loadImage(stamp.stamp_image);
      let sw = maxW;
      let sh = (si.height / si.width) * sw;
      if (sh > maxH) { sh = maxH; sw = (si.width / si.height) * sh; }
      pdf.addImage(stamp.stamp_image, 'PNG', pageWidth - margin - sw, y, sw, sh);
      y += sh + 2;
    } catch {}
  }

  // Signature image from stamp
  if (stamp.signature_image) {
    try {
      const si = await loadImage(stamp.signature_image);
      let sw = 42;
      let sh = (si.height / si.width) * sw;
      if (sh > 18) { sh = 18; sw = (si.width / si.height) * sh; }
      pdf.addImage(stamp.signature_image, 'PNG', pageWidth - margin - sw, y, sw, sh);
      y += sh + 2;
    } catch {}
  }

  // Name below stamp — always shown
  pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(60, 60, 60);
  pdf.text(stamp.name, pageWidth - margin - 5, y, { align: 'right' });
  y += 4;
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120, 120, 120);
  pdf.text(stamp.clinical_area, pageWidth - margin - 5, y, { align: 'right' });
  pdf.setTextColor(0, 0, 0);
  y += 6;

  return y;
}

function addFooters(pdf: jsPDF, pageWidth: number, pageHeight: number, margin: number) {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8); pdf.setTextColor(128, 128, 128); pdf.setFont('helvetica', 'normal');
    pdf.text(
      `Página ${i} de ${total} | Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2, pageHeight - 10, { align: 'center' }
    );
    pdf.setFontSize(6); pdf.setTextColor(190, 190, 190); pdf.setFont('helvetica', 'bold');
    pdf.text('Plataforma Clínica - Evolução Diária', margin, pageHeight - 5);
    pdf.setFont('helvetica', 'normal');
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
