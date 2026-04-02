import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, PageOrientation,
  Header,
} from 'docx';
import { saveAs } from 'file-saver';
import { GroupedPatientRow, getStatusLabel } from './attendanceUtils';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatSessionsText(sessions: GroupedPatientRow['sessions']): string {
  return sessions.map(s => {
    const dateStr = format(new Date(s.date + 'T00:00:00'), 'dd/MM', { locale: ptBR });
    const label = s.isFilled ? getStatusLabel(s.attendanceStatus) : 'Agendado';
    return `${dateStr} (${label})`;
  }).join('  |  ');
}

// ──────────── PDF EXPORT ────────────

export function downloadAttendancePDF(
  clinicName: string,
  month: number,
  year: number,
  rows: GroupedPatientRow[]
) {
  const monthLabel = `${MONTHS[month]} de ${year}`;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(clinicName.toUpperCase(), doc.internal.pageSize.getWidth() / 2, 14, { align: 'center' });
  doc.setFontSize(11);
  doc.text('Controle de Frequência Mensal', doc.internal.pageSize.getWidth() / 2, 21, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(monthLabel, doc.internal.pageSize.getWidth() / 2, 27, { align: 'center' });

  const tableData = rows.map(row => [
    `${row.patientName}${row.responsibleName ? `\nResp.: ${row.responsibleName}` : ''}`,
    row.professional || '—',
    formatSessionsText(row.sessions),
    '', // Assinatura
    '', // Observações
  ]);

  autoTable(doc, {
    startY: 32,
    head: [['Paciente / Responsável', 'Terapeuta', 'Datas e Status', 'Assinatura do Responsável', 'Observações']],
    body: tableData.length > 0
      ? tableData
      : [['Nenhum registro encontrado', '', '', '', '']],
    styles: {
      fontSize: 8,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      textColor: [0, 0, 0],
      minCellHeight: 18,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 50, halign: 'left' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'left', fontSize: 7 },
      3: { cellWidth: 45, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' },
    },
    didDrawPage: (data: any) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150);
      const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      doc.text(`Gerado em ${now}`, 14, doc.internal.pageSize.getHeight() - 6);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        doc.internal.pageSize.getWidth() - 14,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'right' }
      );
    },
  });

  doc.save(`Frequencia_${clinicName.replace(/\s+/g, '_')}_${MONTHS[month]}_${year}.pdf`);
}

// ──────────── DOCX EXPORT ────────────

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const cellMargins = { top: 60, bottom: 60, left: 80, right: 80 };

function makeHeaderCell(text: string, width: number) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: 'center' as any,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 18, font: 'Arial' })],
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
      children: [new TextRun({ text, size: 16, font: 'Arial' })],
    })],
  });
}

function makeEmptyCell(width: number) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text: ' ', size: 16 })] })],
  });
}

export async function downloadAttendanceDOCX(
  clinicName: string,
  month: number,
  year: number,
  rows: GroupedPatientRow[]
) {
  const monthLabel = `${MONTHS[month]} de ${year}`;
  
  // Landscape A4: width ~15840, height ~11906 (swapped)
  // Content width with 1" margins: 15840 - 2880 = 12960 DXA
  const colWidths = [3200, 2200, 4360, 2000, 1200];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  const headerRow = new TableRow({
    children: [
      makeHeaderCell('Paciente / Responsável', colWidths[0]),
      makeHeaderCell('Terapeuta', colWidths[1]),
      makeHeaderCell('Datas e Status', colWidths[2]),
      makeHeaderCell('Assinatura', colWidths[3]),
      makeHeaderCell('Obs.', colWidths[4]),
    ],
  });

  const dataRows = rows.length > 0
    ? rows.map(row => {
        const nameText = row.responsibleName
          ? `${row.patientName} — Resp.: ${row.responsibleName}`
          : row.patientName;
        return new TableRow({
          children: [
            makeCell(nameText, colWidths[0]),
            makeCell(row.professional || '—', colWidths[1], AlignmentType.CENTER),
            makeCell(formatSessionsText(row.sessions), colWidths[2]),
            makeEmptyCell(colWidths[3]),
            makeEmptyCell(colWidths[4]),
          ],
        });
      })
    : [new TableRow({
        children: [makeCell('Nenhum registro encontrado', tableWidth, AlignmentType.CENTER),
          ...[0,0,0,0].map(() => makeEmptyCell(0))],
      })];

  const table = new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 40 },
              children: [new TextRun({ text: clinicName.toUpperCase(), bold: true, size: 28, font: 'Arial' })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 40 },
              children: [new TextRun({ text: 'Controle de Frequência Mensal', bold: true, size: 22, font: 'Arial' })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 120 },
              children: [new TextRun({ text: monthLabel, size: 20, font: 'Arial' })],
            }),
          ],
        }),
      },
      children: [table],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Frequencia_${clinicName.replace(/\s+/g, '_')}_${MONTHS[month]}_${year}.docx`);
}
