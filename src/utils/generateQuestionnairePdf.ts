import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface QuestionnairePdfClinicInfo {
  name: string;
  address?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  email?: string | null;
  letterhead?: string | null;
}

export interface QuestionnairePdfPatientInfo {
  name: string;
  birthdate?: string | null;
  diagnosis?: string | null;
  clinicalArea?: string | null;
  isMinor?: boolean;
  guardianName?: string | null;
  guardianKinship?: string | null;
  cpf?: string | null;
}

export interface QuestionnairePdfTherapistInfo {
  name?: string | null;
  professionalId?: string | null;
}

export interface QuestionnairePdfSection {
  title: string;
  fields: Array<{ label: string; value: string | null | undefined }>;
}

export interface QuestionnairePdfStamp {
  name: string;
  clinicalArea: string;
  cbo?: string | null;
  stampImage?: string | null;
  signatureImage?: string | null;
}

export interface GenerateQuestionnairePdfOptions {
  title: string;
  sections: QuestionnairePdfSection[];
  clinicInfo?: QuestionnairePdfClinicInfo;
  patientInfo: QuestionnairePdfPatientInfo;
  therapistInfo?: QuestionnairePdfTherapistInfo;
  stamp?: QuestionnairePdfStamp | null;
  submittedAt?: string | null;
}

export async function generateQuestionnairePdf(options: GenerateQuestionnairePdfOptions) {
  const { title, sections, clinicInfo, patientInfo, therapistInfo, stamp, submittedAt } = options;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > pageH - 25) {
      doc.addPage();
      y = margin;
    }
  };

  // ─── Letterhead ─────────────────────────────────────────────
  if (clinicInfo?.letterhead) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = clinicInfo.letterhead!;
      });
      const ratio = img.width / img.height;
      const imgW = Math.min(contentW, 170);
      const imgH = imgW / ratio;
      doc.addImage(img, 'PNG', (pageW - imgW) / 2, y, imgW, Math.min(imgH, 35));
      y += Math.min(imgH, 35) + 4;
    } catch {
      // skip letterhead on error
    }
  }

  // ─── Clinic Header ──────────────────────────────────────────
  if (clinicInfo) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(clinicInfo.name, pageW / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    const infoParts: string[] = [];
    if (clinicInfo.address) infoParts.push(clinicInfo.address);
    if (clinicInfo.cnpj) infoParts.push(`CNPJ: ${clinicInfo.cnpj}`);
    if (clinicInfo.phone) infoParts.push(`Tel: ${clinicInfo.phone}`);
    if (clinicInfo.email) infoParts.push(clinicInfo.email);
    if (infoParts.length > 0) {
      const line1 = infoParts.slice(0, 2).join(' | ');
      const line2 = infoParts.slice(2).join(' | ');
      doc.text(line1, pageW / 2, y, { align: 'center' });
      y += 4;
      if (line2) {
        doc.text(line2, pageW / 2, y, { align: 'center' });
        y += 4;
      }
    }
    doc.setTextColor(0);
    // Separator line
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  }

  // ─── Document Title ─────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageW / 2, y, { align: 'center' });
  y += 8;

  // ─── Patient Info Box ───────────────────────────────────────
  const patientFields: [string, string][] = [];
  patientFields.push(['Paciente', patientInfo.name]);
  if (patientInfo.birthdate) {
    try {
      patientFields.push(['Data de Nascimento', format(new Date(patientInfo.birthdate + 'T12:00:00'), 'dd/MM/yyyy')]);
    } catch { /* skip */ }
  }
  if (patientInfo.cpf) patientFields.push(['CPF', patientInfo.cpf]);
  if (patientInfo.clinicalArea) patientFields.push(['Área Clínica', patientInfo.clinicalArea]);
  if (patientInfo.diagnosis) patientFields.push(['Diagnóstico', patientInfo.diagnosis]);
  if (patientInfo.isMinor && patientInfo.guardianName) {
    const guardianLabel = patientInfo.guardianKinship ? `Responsável (${patientInfo.guardianKinship})` : 'Responsável Legal';
    patientFields.push([guardianLabel, patientInfo.guardianName]);
  }
  if (therapistInfo?.name) {
    const tLabel = therapistInfo.professionalId ? `Terapeuta (${therapistInfo.professionalId})` : 'Terapeuta';
    patientFields.push([tLabel, therapistInfo.name]);
  }

  // Draw info box
  doc.setFillColor(245, 245, 250);
  const boxH = Math.ceil(patientFields.length / 2) * 10 + 6;
  checkPage(boxH + 4);
  doc.roundedRect(margin, y - 2, contentW, boxH, 2, 2, 'F');

  doc.setFontSize(8);
  let bx = margin + 4;
  let by = y + 2;
  const colW = (contentW - 8) / 2;
  patientFields.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const px = bx + col * colW;
    const py = by + row * 10;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120);
    doc.text(label.toUpperCase(), px, py);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40);
    doc.text(value || '—', px, py + 4);
  });
  y += boxH + 4;

  // ─── Sections (Q&A) ────────────────────────────────────────
  for (const section of sections) {
    checkPage(16);
    // Section title
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50);
    doc.text(section.title, margin, y);
    y += 7;

    for (const field of section.fields) {
      checkPage(14);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120);
      doc.text(field.label.toUpperCase(), margin, y);
      y += 4;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      const val = field.value || 'Não informado';
      const lines = doc.splitTextToSize(val, contentW);
      for (const line of lines) {
        checkPage(6);
        doc.text(line, margin, y);
        y += 5;
      }
      y += 2;
    }
  }

  // ─── Stamp / Signature ─────────────────────────────────────
  if (stamp) {
    checkPage(50);
    y += 8;
    doc.setDrawColor(200);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    const stampX = pageW / 2;
    if (stamp.signatureImage) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = stamp.signatureImage!;
        });
        doc.addImage(img, 'PNG', stampX - 20, y, 40, 15);
        y += 17;
      } catch { /* skip */ }
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(stamp.name, stampX, y, { align: 'center' });
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(stamp.clinicalArea, stampX, y, { align: 'center' });
    y += 4;
    if (stamp.cbo) {
      doc.text(`CBO: ${stamp.cbo}`, stampX, y, { align: 'center' });
      y += 4;
    }

    if (stamp.stampImage) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = stamp.stampImage!;
        });
        doc.addImage(img, 'PNG', stampX - 15, y, 30, 30);
        y += 32;
      } catch { /* skip */ }
    }
  }

  // ─── Footer ─────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160);
    const footerY = pageH - 10;
    if (submittedAt) {
      try {
        doc.text(`Preenchido em: ${format(new Date(submittedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, footerY);
      } catch { /* skip */ }
    }
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageW / 2, footerY, { align: 'center' });
    doc.text(`Página ${p}/${totalPages}`, pageW - margin, footerY, { align: 'right' });
  }

  return doc;
}
