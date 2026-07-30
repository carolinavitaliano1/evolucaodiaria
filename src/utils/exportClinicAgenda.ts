import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface AgendaExportRow {
  date: string;        // yyyy-MM-dd
  time: string;        // HH:mm
  endTime?: string | null;
  patient: string;
  therapist?: string | null;
  status: string;      // label já traduzido
  room?: string | null;
  convenio?: string | null;
  notes?: string | null;
}

export interface AgendaExportMeta {
  clinicName: string;
  periodLabel: string;
  filtersLabel?: string;
  rows: AgendaExportRow[];
}

const BRAND: [number, number, number] = [124, 92, 214];   // lilás
const BRAND_SOFT: [number, number, number] = [238, 233, 252];
const INK: [number, number, number] = [40, 36, 56];
const MUTED: [number, number, number] = [120, 116, 134];

const STATUS_COLOR: Record<string, [number, number, number]> = {
  'Agendado': [124, 92, 214],
  'Confirmado': [22, 145, 92],
  'Atendido': [16, 122, 78],
  'Faltou': [200, 52, 52],
  'Cancelado': [140, 140, 150],
  'Remarcar': [200, 140, 20],
};

function dayLabel(dateStr: string) {
  try {
    const d = parseISO(dateStr + 'T12:00:00');
    return format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      .replace(/^\w/, c => c.toUpperCase());
  } catch {
    return dateStr;
  }
}

function groupByDay(rows: AgendaExportRow[]) {
  const map = new Map<string, AgendaExportRow[]>();
  [...rows]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .forEach(r => {
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date)!.push(r);
    });
  return map;
}

function statusSummary(rows: AgendaExportRow[]) {
  const counts: Record<string, number> = {};
  rows.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export function exportClinicAgendaPdf(meta: AgendaExportMeta) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // ---- Cabeçalho ----
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(meta.clinicName, 12, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Agenda de atendimentos', 12, 18.5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(meta.periodLabel, W - 12, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, W - 12, 19, { align: 'right' });

  // ---- Faixa de resumo ----
  let y = 32;
  doc.setFillColor(...BRAND_SOFT);
  doc.roundedRect(12, y - 6, W - 24, 12, 2, 2, 'F');
  doc.setTextColor(...INK);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`${meta.rows.length} agendamento(s)`, 16, y + 1);
  const summary = statusSummary(meta.rows).map(([s, n]) => `${s}: ${n}`).join('   •   ');
  doc.setFont('helvetica', 'normal');
  if (summary) doc.text(summary, 60, y + 1);
  if (meta.filtersLabel) {
    doc.setTextColor(...MUTED);
    doc.text(`Filtros: ${meta.filtersLabel}`, W - 16, y + 1, { align: 'right' });
  }
  y += 12;

  // ---- Corpo: uma tabela por dia ----
  const grouped = groupByDay(meta.rows);

  if (grouped.size === 0) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(11);
    doc.text('Nenhum agendamento no período selecionado.', W / 2, y + 20, { align: 'center' });
  }

  grouped.forEach((dayRows, dateStr) => {
    autoTable(doc, {
      startY: y,
      head: [[
        { content: `${dayLabel(dateStr)}   —   ${dayRows.length} atendimento(s)`, colSpan: 7 },
      ]],
      body: [],
      theme: 'plain',
      headStyles: {
        fillColor: BRAND,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      },
      margin: { left: 12, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
      startY: y,
      head: [['Horário', 'Paciente', 'Profissional', 'Status', 'Sala', 'Convênio', 'Observações']],
      body: dayRows.map(r => [
        r.endTime ? `${r.time} – ${r.endTime}` : r.time,
        r.patient,
        r.therapist || '—',
        r.status,
        r.room || '—',
        r.convenio || '—',
        r.notes || '',
      ]),
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        textColor: INK,
        lineColor: [225, 220, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: BRAND_SOFT,
        textColor: BRAND,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [250, 249, 254] },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 58 },
        2: { cellWidth: 45 },
        3: { cellWidth: 26, fontStyle: 'bold' },
        4: { cellWidth: 22 },
        5: { cellWidth: 30 },
        6: { cellWidth: 'auto' },
      },
      margin: { left: 12, right: 12 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const c = STATUS_COLOR[String(data.cell.raw)];
          if (c) data.cell.styles.textColor = c;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  });

  // ---- Rodapé ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...BRAND_SOFT);
    doc.setLineWidth(0.4);
    doc.line(12, H - 12, W - 12, H - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(`${meta.clinicName} • Agenda • ${meta.periodLabel}`, 12, H - 7.5);
    doc.text(`Página ${i} de ${pages}`, W - 12, H - 7.5, { align: 'right' });
  }

  const safe = meta.clinicName.replace(/[^\w\-]+/g, '_');
  doc.save(`Agenda_${safe}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function exportClinicAgendaExcel(meta: AgendaExportMeta) {
  const aoa: (string | number)[][] = [];
  aoa.push([meta.clinicName]);
  aoa.push([`Agenda de atendimentos — ${meta.periodLabel}`]);
  aoa.push([`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}${meta.filtersLabel ? ` — Filtros: ${meta.filtersLabel}` : ''}`]);
  aoa.push([]);
  aoa.push(['Data', 'Dia da semana', 'Início', 'Fim', 'Paciente', 'Profissional', 'Status', 'Sala', 'Convênio', 'Observações']);

  const grouped = groupByDay(meta.rows);
  grouped.forEach((dayRows, dateStr) => {
    dayRows.forEach(r => {
      let dia = '';
      try { dia = format(parseISO(dateStr + 'T12:00:00'), 'EEEE', { locale: ptBR }); } catch {}
      aoa.push([
        format(parseISO(dateStr + 'T12:00:00'), 'dd/MM/yyyy'),
        dia,
        r.time,
        r.endTime || '',
        r.patient,
        r.therapist || '',
        r.status,
        r.room || '',
        r.convenio || '',
        r.notes || '',
      ]);
    });
  });

  aoa.push([]);
  aoa.push(['Total de agendamentos', meta.rows.length]);
  statusSummary(meta.rows).forEach(([s, n]) => aoa.push([s, n]));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 30 },
    { wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 40 },
  ];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Agenda');
  const safe = meta.clinicName.replace(/[^\w\-]+/g, '_');
  XLSX.writeFile(wb, `Agenda_${safe}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}