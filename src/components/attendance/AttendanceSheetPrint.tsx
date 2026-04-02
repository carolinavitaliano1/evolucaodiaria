import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface AttendanceRow {
  patientName: string;
  specialty: string;
  professional: string;
  date: string;
  time: string;
  isFilled: boolean;
  attendanceStatus?: string;
}

const STATUS_LABELS: Record<string, string> = {
  presente: 'Presente',
  falta: 'Falta',
  falta_remunerada: 'Falta Rem.',
  reposicao: 'Reposição',
  feriado_remunerado: 'Feriado Rem.',
  feriado_nao_remunerado: 'Feriado',
};

export function printAttendanceSheet(
  clinicName: string,
  month: number,
  year: number,
  rows: AttendanceRow[]
) {
  const monthLabel = format(new Date(year, month, 1), "MMMM 'de' yyyy", { locale: ptBR });
  const nowLabel = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

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
          <td style="padding:14px 6px"></td>
          <td></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="8" style="text-align:center;padding:16px;color:#999">Nenhum registro encontrado.</td></tr>';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Lista de Frequência - ${clinicName}</title>
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
        <span>Documento gerado em ${nowLabel}</span>
        <span>Total de registros: ${rows.length}</span>
      </div>
      <script>window.onload = function() { window.print(); }<\/script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=1000,height=700');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
}
