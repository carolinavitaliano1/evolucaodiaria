import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Supervisee, SupervisionSession } from './types';
import { HOUR_STATUSES } from './types';

function fmtDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('pt-BR');
}

interface Options {
  supervisee: Supervisee;
  sessions: SupervisionSession[];
  supervisorName: string;
  supervisorRegistration?: string;
  stampImage?: string | null;
  signatureImage?: string | null;
  city?: string;
}

/** Declaração/Certificado de horas de supervisão (A4, com detalhamento por sessão). */
export function generateSupervisionCertificate({
  supervisee,
  sessions,
  supervisorName,
  supervisorRegistration,
  stampImage,
  signatureImage,
  city,
}: Options) {
  const counted = sessions
    .filter((s) => HOUR_STATUSES.includes(s.attendance_status))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalMinutes = counted.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  const totalHours = totalMinutes / 60;
  const individual = counted
    .filter((s) => s.modality === 'individual')
    .reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / 60;
  const group = totalHours - individual;

  const first = counted[0]?.date;
  const last = counted[counted.length - 1]?.date;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 25;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DECLARAÇÃO DE SUPERVISÃO', pageW / 2, y, { align: 'center' });
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  const period =
    first && last ? `no período de ${fmtDate(first)} a ${fmtDate(last)}` : 'no período informado';
  const body =
    `Declaro, para os devidos fins, que ${supervisee.name}` +
    (supervisee.council_registration ? `, registro ${supervisee.council_registration},` : ',') +
    ` participou de supervisão profissional sob minha responsabilidade ${period}, ` +
    `totalizando ${totalHours.toFixed(1)} hora(s) de supervisão ` +
    `(${individual.toFixed(1)}h individual e ${group.toFixed(1)}h em grupo), ` +
    `distribuídas em ${counted.length} encontro(s), conforme detalhamento abaixo.`;

  const lines = doc.splitTextToSize(body, pageW - margin * 2);
  doc.text(lines, margin, y, { align: 'justify', maxWidth: pageW - margin * 2 });
  y += lines.length * 6 + 8;

  autoTable(doc, {
    startY: y,
    head: [['Data', 'Horário', 'Modalidade', 'Formato', 'Duração']],
    body: counted.map((s) => [
      fmtDate(s.date),
      s.start_time && s.end_time ? `${s.start_time} – ${s.end_time}` : '—',
      s.modality === 'grupo' ? 'Grupo' : 'Individual',
      s.format === 'presencial' ? 'Presencial' : 'Online',
      `${(s.duration_minutes / 60).toFixed(1)}h`,
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [124, 92, 200], textColor: 255 },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 14;
  if (y > 240) {
    doc.addPage();
    y = 30;
  }

  doc.setFontSize(11);
  doc.text(
    `${city ? `${city}, ` : ''}${new Date().toLocaleDateString('pt-BR')}`,
    pageW - margin,
    y,
    { align: 'right' },
  );
  y += 22;

  const lineY = y;

  // Carimbo e assinatura ficam ACIMA da linha, centralizados
  if (stampImage) {
    try {
      const size = 30;
      const offsetX = signatureImage ? 14 : 0;
      doc.addImage(stampImage, 'PNG', pageW / 2 - size / 2 + offsetX, lineY - size - 1, size, size);
    } catch {
      /* imagem inválida — ignora */
    }
  }
  if (signatureImage) {
    try {
      const w = 45;
      const offsetX = stampImage ? -16 : 0;
      doc.addImage(signatureImage, 'PNG', pageW / 2 - w / 2 + offsetX, lineY - 17, w, 16);
    } catch {
      /* imagem inválida — ignora */
    }
  }

  doc.line(pageW / 2 - 40, lineY, pageW / 2 + 40, lineY);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(supervisorName || 'Supervisor(a)', pageW / 2, y, { align: 'center' });
  if (supervisorRegistration) {
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(supervisorRegistration, pageW / 2, y, { align: 'center' });
  }

  doc.save(`declaracao-supervisao-${supervisee.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}