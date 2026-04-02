import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface AttendanceRow {
  patientName: string;
  specialty: string;
  professional: string;
  date: string;
  time: string;
  isFilled: boolean; // true = has evolution, false = future/blank
  attendanceStatus?: string;
}

interface AttendanceSheetPrintProps {
  clinicName: string;
  month: number; // 0-indexed
  year: number;
  rows: AttendanceRow[];
}

const STATUS_LABELS: Record<string, string> = {
  presente: 'Presente',
  falta: 'Falta',
  falta_remunerada: 'Falta Rem.',
  reposicao: 'Reposição',
  feriado_remunerado: 'Feriado Rem.',
  feriado_nao_remunerado: 'Feriado',
};

export function AttendanceSheetPrint({ clinicName, month, year, rows }: AttendanceSheetPrintProps) {
  const monthLabel = format(new Date(year, month, 1), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="p-6 font-sans text-xs leading-tight">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-base font-bold uppercase tracking-wide">{clinicName}</h1>
        <h2 className="text-sm font-semibold mt-1">Controle de Frequência Mensal</h2>
        <p className="text-xs mt-0.5 capitalize">{monthLabel}</p>
      </div>

      {/* Table */}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1.5 text-left font-semibold bg-gray-100 print:bg-gray-100">Paciente</th>
            <th className="border border-black px-2 py-1.5 text-left font-semibold bg-gray-100 print:bg-gray-100">Terapia / Especialidade</th>
            <th className="border border-black px-2 py-1.5 text-left font-semibold bg-gray-100 print:bg-gray-100">Profissional</th>
            <th className="border border-black px-2 py-1.5 text-center font-semibold bg-gray-100 print:bg-gray-100 w-20">Data</th>
            <th className="border border-black px-2 py-1.5 text-center font-semibold bg-gray-100 print:bg-gray-100 w-16">Horário</th>
            <th className="border border-black px-2 py-1.5 text-center font-semibold bg-gray-100 print:bg-gray-100 w-14">Status</th>
            <th className="border border-black px-2 py-1.5 text-center font-semibold bg-gray-100 print:bg-gray-100" style={{ minWidth: '160px' }}>Assinatura</th>
            <th className="border border-black px-2 py-1.5 text-center font-semibold bg-gray-100 print:bg-gray-100" style={{ minWidth: '100px' }}>Observação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ breakInside: 'avoid' }}>
              <td className="border border-black px-2 py-2 text-left">{row.patientName}</td>
              <td className="border border-black px-2 py-2 text-left">{row.specialty || '—'}</td>
              <td className="border border-black px-2 py-2 text-left">{row.professional || '—'}</td>
              <td className="border border-black px-2 py-2 text-center">
                {row.date ? format(new Date(row.date + 'T00:00:00'), 'dd/MM', { locale: ptBR }) : ''}
              </td>
              <td className="border border-black px-2 py-2 text-center">{row.time || '—'}</td>
              <td className="border border-black px-2 py-2 text-center text-[10px]">
                {row.isFilled && row.attendanceStatus ? STATUS_LABELS[row.attendanceStatus] || '' : ''}
              </td>
              <td className="border border-black px-2 py-6">{/* blank for signature */}</td>
              <td className="border border-black px-2 py-2">{/* blank for notes */}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="border border-black px-2 py-4 text-center text-gray-500">
                Nenhum registro encontrado para o período selecionado.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-8 flex justify-between text-[10px] text-gray-500">
        <span>Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
        <span>Total de registros: {rows.length}</span>
      </div>
    </div>
  );
}

export function printAttendanceSheet(contentHtml: string) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Lista de Frequência</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; padding: 10mm; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 4px 6px; }
        th { background: #f0f0f0; font-weight: 600; font-size: 10px; }
        td { font-size: 10px; }
        tr { break-inside: avoid; }
        h1 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
        h2 { font-size: 12px; }
        .header { text-align: center; margin-bottom: 20px; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 9px; color: #666; }
        @media print {
          body { padding: 5mm; }
          @page { margin: 8mm; size: landscape; }
        }
      </style>
    </head>
    <body>
      ${contentHtml}
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

export function generateAttendanceHtml(
  clinicName: string,
  month: number,
  year: number,
  rows: AttendanceRow[]
): string {
  const { format } = require('date-fns');
  const { ptBR } = require('date-fns/locale');
  const monthLabel = format(new Date(year, month, 1), "MMMM 'de' yyyy", { locale: ptBR });

  const rowsHtml = rows.length > 0
    ? rows.map(row => {
        const dateStr = row.date ? format(new Date(row.date + 'T00:00:00'), 'dd/MM', { locale: ptBR }) : '';
        const statusLabel = row.isFilled && row.attendanceStatus ? (STATUS_LABELS[row.attendanceStatus] || '') : '';
        return `<tr>
          <td style="text-align:left">${row.patientName}</td>
          <td style="text-align:left">${row.specialty || '—'}</td>
          <td style="text-align:left">${row.professional || '—'}</td>
          <td style="text-align:center">${dateStr}</td>
          <td style="text-align:center">${row.time || '—'}</td>
          <td style="text-align:center;font-size:9px">${statusLabel}</td>
          <td style="padding:12px 6px"></td>
          <td></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="8" style="text-align:center;padding:16px;color:#999">Nenhum registro encontrado.</td></tr>';

  return `
    <div class="header">
      <h1>${clinicName}</h1>
      <h2>Controle de Frequência Mensal</h2>
      <p style="margin-top:4px;text-transform:capitalize">${monthLabel}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left">Paciente</th>
          <th style="text-align:left">Terapia / Especialidade</th>
          <th style="text-align:left">Profissional</th>
          <th style="text-align:center;width:60px">Data</th>
          <th style="text-align:center;width:50px">Horário</th>
          <th style="text-align:center;width:50px">Status</th>
          <th style="text-align:center;min-width:140px">Assinatura</th>
          <th style="text-align:center;min-width:90px">Observação</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <div class="footer">
      <span>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
      <span>Total de registros: ${rows.length}</span>
    </div>
  `;
}
