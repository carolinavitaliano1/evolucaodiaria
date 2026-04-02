import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, PageOrientation,
  Header, ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { GroupedPatientRow, getStatusLabel, getProfessionalTitle } from './attendanceUtils';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export interface ExportOptions {
  showSignatureCol: boolean;
  showObsCol: boolean;
  therapistName: string;
  therapistTitle: string;
  stampImageBase64: string | null;
}

function getMaxSessions(rows: GroupedPatientRow[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sessions.length), 0);
}

function formatSessionCell(s: GroupedPatientRow['sessions'][0]): string {
  const dateStr = format(new Date(s.date + 'T00:00:00'), 'dd/MM', { locale: ptBR });
  const label = s.isFilled ? getStatusLabel(s.attendanceStatus) : 'Agend.';
  return `${dateStr}\n${label}`;
}

function base64ToUint8Array(dataUrl: string): { bytes: Uint8Array; type: string } {
  const match = dataUrl.match(/^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i);
  if (!match) return { bytes: new Uint8Array(), type: 'png' };
  const type = match[1].toLowerCase().replace('jpeg', 'jpg');
  const raw = atob(match[2]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return { bytes, type };
}

// ──────────── PDF EXPORT ────────────

export function downloadAttendancePDF(
  clinicName: string,
  month: number,
  year: number,
  rows: GroupedPatientRow[],
  options: ExportOptions
) {
  const monthLabel = `${MONTHS[month]} de ${year}`;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxSessions = getMaxSessions(rows);

  // Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(clinicName.toUpperCase(), pageW / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Controle de Frequência Mensal', pageW / 2, 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(monthLabel, pageW / 2, 22, { align: 'center' });

  // Build columns
  const headRow: string[] = ['Paciente', 'Terapia'];
  for (let i = 0; i < maxSessions; i++) headRow.push(`S${i + 1}`);
  if (options.showSignatureCol) headRow.push('Assinatura');
  if (options.showObsCol) headRow.push('Obs.');

  const tableData = rows.map(row => {
    const cells: string[] = [
      row.patientName,
      row.specialty || '—',
    ];
    for (let i = 0; i < maxSessions; i++) {
      cells.push(row.sessions[i] ? formatSessionCell(row.sessions[i]) : '');
    }
    if (options.showSignatureCol) cells.push('');
    if (options.showObsCol) cells.push('');
    return cells;
  });

  const patientW = 40;
  const therapyW = 22;
  const sigW = options.showSignatureCol ? 35 : 0;
  const obsW = options.showObsCol ? 18 : 0;
  const fixedWidth = patientW + therapyW + sigW + obsW;
  const sessionColW = maxSessions > 0 ? Math.min(22, (pageW - 20 - fixedWidth) / maxSessions) : 20;

  const colStyles: Record<number, any> = {
    0: { cellWidth: patientW, halign: 'left' },
    1: { cellWidth: therapyW, halign: 'center' },
  };
  for (let i = 0; i < maxSessions; i++) {
    colStyles[2 + i] = { cellWidth: sessionColW, halign: 'center', fontSize: 6 };
  }
  let colIdx = 2 + maxSessions;
  if (options.showSignatureCol) { colStyles[colIdx] = { cellWidth: 35, halign: 'center' }; colIdx++; }
  if (options.showObsCol) { colStyles[colIdx] = { cellWidth: 18, halign: 'center' }; }

  // Calculate total table width and center margin
  let totalTableW = patientW + therapyW + (maxSessions * sessionColW);
  if (options.showSignatureCol) totalTableW += 35;
  if (options.showObsCol) totalTableW += 18;
  const marginLeft = (pageW - totalTableW) / 2;

  autoTable(doc, {
    startY: 26,
    margin: { left: marginLeft, right: marginLeft },
    head: [headRow],
    body: tableData.length > 0
      ? tableData
      : [['Nenhum registro', '', ...Array(headRow.length - 2).fill('')]],
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 6,
      halign: 'center',
      cellPadding: 1,
    },
    columnStyles: colStyles,
    didDrawPage: (data: any) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150);
      const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      doc.text(`Gerado em ${now}`, 10, pageH - 5);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageW - 10, pageH - 5,
        { align: 'right' }
      );
    },
  });

  // Centered vertical signature block
  const finalY = (doc as any).lastAutoTable?.finalY || 180;
  const centerX = pageW / 2;
  let footerY = finalY + 15;

  // Stamp image or blank space
  if (options.stampImageBase64) {
    try {
      doc.addImage(options.stampImageBase64, 'PNG', centerX - 20, footerY, 40, 20);
      footerY += 22;
    } catch {
      footerY += 15;
    }
  } else {
    footerY += 15; // blank space for manual stamp
  }

  // Horizontal line
  const lineHalfW = 40;
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(centerX - lineHalfW, footerY, centerX + lineHalfW, footerY);
  footerY += 4;

  // Therapist name
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  const nameLabel = options.therapistName || '________________________';
  doc.text(nameLabel, centerX, footerY, { align: 'center' });

  // Therapist title on next line
  if (options.therapistTitle) {
    footerY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(options.therapistTitle, centerX, footerY, { align: 'center' });
  }

  doc.save(`Frequencia_${clinicName.replace(/\s+/g, '_')}_${MONTHS[month]}_${year}.pdf`);
}

// ──────────── DOCX EXPORT ────────────

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 30, bottom: 30, left: 50, right: 50 };

function makeHeaderCell(text: string, width: number) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: 'center' as any,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 14, font: 'Arial' })],
    })],
  });
}

function makeCell(text: string, width: number, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    children: [new Paragraph({
      alignment,
      children: [new TextRun({ text, size: 14, font: 'Arial' })],
    })],
  });
}

function makeEmptyCell(width: number) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text: ' ', size: 14 })] })],
  });
}

export async function downloadAttendanceDOCX(
  clinicName: string,
  month: number,
  year: number,
  rows: GroupedPatientRow[],
  options: ExportOptions
) {
  const monthLabel = `${MONTHS[month]} de ${year}`;
  const maxSessions = getMaxSessions(rows);

  const contentWidth = 14400;
  const patientW = 2600;
  const therapyW = 1400;
  const signatureW = options.showSignatureCol ? 2000 : 0;
  const obsW = options.showObsCol ? 1000 : 0;
  const fixedW = patientW + therapyW + signatureW + obsW;
  const sessionW = maxSessions > 0 ? Math.floor((contentWidth - fixedW) / maxSessions) : 1200;
  const totalW = fixedW + sessionW * maxSessions;

  const colWidths = [patientW, therapyW, ...Array(maxSessions).fill(sessionW)];
  if (options.showSignatureCol) colWidths.push(signatureW);
  if (options.showObsCol) colWidths.push(obsW);

  const headerCells = [
    makeHeaderCell('Paciente', patientW),
    makeHeaderCell('Terapia', therapyW),
    ...Array.from({ length: maxSessions }, (_, i) => makeHeaderCell(`S${i + 1}`, sessionW)),
  ];
  if (options.showSignatureCol) headerCells.push(makeHeaderCell('Assinatura', signatureW));
  if (options.showObsCol) headerCells.push(makeHeaderCell('Obs.', obsW));

  const headerRow = new TableRow({ children: headerCells });

  const dataRows = rows.length > 0
    ? rows.map(row => {
        const nameText = row.patientName;
        const sessionCells = Array.from({ length: maxSessions }, (_, i) => {
          const s = row.sessions[i];
          if (!s) return makeEmptyCell(sessionW);
          const dateStr = format(new Date(s.date + 'T00:00:00'), 'dd/MM', { locale: ptBR });
          const label = s.isFilled ? getStatusLabel(s.attendanceStatus) : 'Agend.';
          return makeCell(`${dateStr}\n${label}`, sessionW, AlignmentType.CENTER);
        });
        const cells = [
          makeCell(nameText, patientW),
          makeCell(row.specialty || '—', therapyW, AlignmentType.CENTER),
          ...sessionCells,
        ];
        if (options.showSignatureCol) cells.push(makeEmptyCell(signatureW));
        if (options.showObsCol) cells.push(makeEmptyCell(obsW));
        return new TableRow({ children: cells });
      })
    : [new TableRow({
        children: [makeCell('Nenhum registro encontrado', totalW, AlignmentType.CENTER),
          ...Array(colWidths.length - 1).fill(null).map(() => makeEmptyCell(0))],
      })];

  const table = new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
    alignment: AlignmentType.CENTER,
  });

  // Footer: centered vertical signature block
  const footerChildren: Paragraph[] = [
    new Paragraph({ spacing: { before: 600 }, children: [] }),
  ];

  // Stamp image or blank space
  if (options.stampImageBase64) {
    const { bytes, type } = base64ToUint8Array(options.stampImageBase64);
    if (bytes.length > 0) {
      footerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100 },
        children: [new ImageRun({
          type: type as any,
          data: bytes,
          transformation: { width: 150, height: 75 },
          altText: { title: 'Carimbo', description: 'Carimbo do profissional', name: 'stamp' },
        })],
      }));
    }
  } else {
    // Blank space for manual stamp
    footerChildren.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  }

  // Horizontal line via border-bottom on a paragraph
  footerChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 },
    },
    indent: { left: 4000, right: 4000 },
    children: [new TextRun({ text: ' ', size: 14 })],
  }));

  // Therapist name
  const nameLabel = options.therapistName || '________________________';
  footerChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60 },
    children: [new TextRun({ text: nameLabel, size: 18, bold: true, font: 'Arial' })],
  }));

  // Therapist title on next line
  if (options.therapistTitle) {
    footerChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40 },
      children: [new TextRun({ text: options.therapistTitle, size: 16, font: 'Arial' })],
    }));
  }

  const docx = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 500, right: 720, bottom: 500, left: 720 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 20 },
              children: [new TextRun({ text: clinicName.toUpperCase(), bold: true, size: 24, font: 'Arial' })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 20 },
              children: [new TextRun({ text: 'Controle de Frequência Mensal', bold: true, size: 20, font: 'Arial' })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 },
              children: [new TextRun({ text: monthLabel, size: 18, font: 'Arial' })],
            }),
          ],
        }),
      },
      children: [table, ...footerChildren],
    }],
  });

  const blob = await Packer.toBlob(docx);
  saveAs(blob, `Frequencia_${clinicName.replace(/\s+/g, '_')}_${MONTHS[month]}_${year}.docx`);
}
