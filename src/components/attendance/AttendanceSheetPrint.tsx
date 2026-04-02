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

function getMaxSessions(rows: GroupedPatientRow[]): number {
  return rows.reduce((max, r) => Math.max(max, r.sessions.length), 0);
}

function formatSessionCell(s: GroupedPatientRow['sessions'][0]): string {
  const dateStr = format(new Date(s.date + 'T00:00:00'), 'dd/MM', { locale: ptBR });
  const label = s.isFilled ? getStatusLabel(s.attendanceStatus) : 'Agend.';
  return `${dateStr}\n${label}`;
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
  const headRow = ['Paciente / Resp.', 'Terapeuta'];
  for (let i = 0; i < maxSessions; i++) headRow.push(`S${i + 1}`);
  headRow.push('Assinatura', 'Obs.');

  const tableData = rows.map(row => {
    const cells: string[] = [
      row.responsibleName ? `${row.patientName}\nResp.: ${row.responsibleName}` : row.patientName,
      row.professional || '—',
    ];
    for (let i = 0; i < maxSessions; i++) {
      cells.push(row.sessions[i] ? formatSessionCell(row.sessions[i]) : '');
    }
    cells.push('', '');
    return cells;
  });

  // Column widths: patient=40, therapist=28, sessions=auto, signature=35, obs=18
  const fixedWidth = 40 + 28 + 35 + 18;
  const sessionColW = maxSessions > 0 ? Math.min(22, (pageW - 20 - fixedWidth) / maxSessions) : 20;
  const colStyles: Record<number, any> = {
    0: { cellWidth: 40, halign: 'left' },
    1: { cellWidth: 28, halign: 'center' },
  };
  for (let i = 0; i < maxSessions; i++) {
    colStyles[2 + i] = { cellWidth: sessionColW, halign: 'center', fontSize: 6 };
  }
  colStyles[2 + maxSessions] = { cellWidth: 35, halign: 'center' };
  colStyles[3 + maxSessions] = { cellWidth: 18, halign: 'center' };

  autoTable(doc, {
    startY: 26,
    head: [headRow],
    body: tableData.length > 0
      ? tableData
      : [['Nenhum registro', '', ...Array(maxSessions + 2).fill('')]],
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

  // Footer signature section
  const finalY = (doc as any).lastAutoTable?.finalY || 180;
  const footerY = finalY + 12;
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.text('Terapeuta Responsável: ____________________________________________________', 14, footerY);
  doc.text('Assinatura / Carimbo: ____________________________________________________', 14, footerY + 8);

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
  rows: GroupedPatientRow[]
) {
  const monthLabel = `${MONTHS[month]} de ${year}`;
  const maxSessions = getMaxSessions(rows);

  // Landscape A4 content width with 0.5" margins: 15840 - 1440 = 14400 DXA
  const contentWidth = 14400;
  const patientW = 2600;
  const therapistW = 1800;
  const signatureW = 2000;
  const obsW = 1000;
  const fixedW = patientW + therapistW + signatureW + obsW;
  const sessionW = maxSessions > 0 ? Math.floor((contentWidth - fixedW) / maxSessions) : 1200;
  const totalW = fixedW + sessionW * maxSessions;

  const colWidths = [patientW, therapistW, ...Array(maxSessions).fill(sessionW), signatureW, obsW];

  const headerCells = [
    makeHeaderCell('Paciente / Resp.', patientW),
    makeHeaderCell('Terapeuta', therapistW),
    ...Array.from({ length: maxSessions }, (_, i) => makeHeaderCell(`S${i + 1}`, sessionW)),
    makeHeaderCell('Assinatura', signatureW),
    makeHeaderCell('Obs.', obsW),
  ];

  const headerRow = new TableRow({ children: headerCells });

  const dataRows = rows.length > 0
    ? rows.map(row => {
        const nameText = row.responsibleName
          ? `${row.patientName} — Resp.: ${row.responsibleName}`
          : row.patientName;
        const sessionCells = Array.from({ length: maxSessions }, (_, i) => {
          const s = row.sessions[i];
          if (!s) return makeEmptyCell(sessionW);
          const dateStr = format(new Date(s.date + 'T00:00:00'), 'dd/MM', { locale: ptBR });
          const label = s.isFilled ? getStatusLabel(s.attendanceStatus) : 'Agend.';
          return makeCell(`${dateStr}\n${label}`, sessionW, AlignmentType.CENTER);
        });
        return new TableRow({
          children: [
            makeCell(nameText, patientW),
            makeCell(row.professional || '—', therapistW, AlignmentType.CENTER),
            ...sessionCells,
            makeEmptyCell(signatureW),
            makeEmptyCell(obsW),
          ],
        });
      })
    : [new TableRow({
        children: [makeCell('Nenhum registro encontrado', totalW, AlignmentType.CENTER),
          ...Array(maxSessions + 3).fill(null).map(() => makeEmptyCell(0))],
      })];

  const table = new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  });

  const doc = new Document({
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
      children: [
        table,
        new Paragraph({ spacing: { before: 400 }, children: [] }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: 'Terapeuta Responsável: ____________________________________________________', size: 18, font: 'Arial' })],
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: 'Assinatura / Carimbo: ____________________________________________________', size: 18, font: 'Arial' })],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Frequencia_${clinicName.replace(/\s+/g, '_')}_${MONTHS[month]}_${year}.docx`);
}
