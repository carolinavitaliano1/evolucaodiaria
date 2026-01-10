import jsPDF from 'jspdf';
import { Evolution, Patient, Clinic } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GeneratePdfOptions {
  evolution: Evolution;
  patient: Patient;
  clinic?: Clinic;
}

export async function generateEvolutionPdf({ evolution, patient, clinic }: GeneratePdfOptions): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Add letterhead if available
  if (clinic?.letterhead) {
    try {
      const img = await loadImage(clinic.letterhead);
      const imgWidth = contentWidth;
      const imgHeight = (img.height / img.width) * imgWidth;
      const maxHeaderHeight = 40;
      const finalHeight = Math.min(imgHeight, maxHeaderHeight);
      pdf.addImage(clinic.letterhead, 'PNG', margin, yPosition, imgWidth, finalHeight);
      yPosition += finalHeight + 10;
    } catch (error) {
      console.error('Error loading letterhead:', error);
    }
  }

  // Clinic name header
  if (clinic) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(clinic.name, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    if (clinic.address) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(clinic.address, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 6;
    }
  }

  // Divider line
  yPosition += 5;
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Title
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('EVOLUÇÃO DO PACIENTE', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Patient info box
  pdf.setFillColor(245, 245, 245);
  pdf.roundedRect(margin, yPosition, contentWidth, 25, 3, 3, 'F');
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Paciente:', margin + 5, yPosition + 8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(patient.name, margin + 30, yPosition + 8);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Data:', margin + 5, yPosition + 16);
  pdf.setFont('helvetica', 'normal');
  pdf.text(format(new Date(evolution.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), margin + 20, yPosition + 16);

  // Attendance status
  const statusText = evolution.attendanceStatus === 'presente' ? 'PRESENTE' : 'FALTA';
  const statusColor = evolution.attendanceStatus === 'presente' ? [34, 197, 94] : [239, 68, 68];
  pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  pdf.setFont('helvetica', 'bold');
  pdf.text(statusText, pageWidth - margin - 5, yPosition + 12, { align: 'right' });
  pdf.setTextColor(0, 0, 0);

  yPosition += 35;

  // Evolution content
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Evolução:', margin, yPosition);
  yPosition += 8;

  pdf.setFont('helvetica', 'normal');
  const textLines = pdf.splitTextToSize(evolution.text || 'Sem descrição.', contentWidth);
  
  // Check if we need a new page
  const textHeight = textLines.length * 6;
  if (yPosition + textHeight > pageHeight - 60) {
    pdf.addPage();
    yPosition = margin;
  }

  pdf.text(textLines, margin, yPosition);
  yPosition += textHeight + 20;

  // Add stamp at the bottom if available
  if (clinic?.stamp) {
    try {
      const stampImg = await loadImage(clinic.stamp);
      const maxStampWidth = 60;
      const maxStampHeight = 40;
      let stampWidth = maxStampWidth;
      let stampHeight = (stampImg.height / stampImg.width) * stampWidth;
      
      if (stampHeight > maxStampHeight) {
        stampHeight = maxStampHeight;
        stampWidth = (stampImg.width / stampImg.height) * stampHeight;
      }

      // Position stamp at bottom right
      const stampX = pageWidth - margin - stampWidth;
      const stampY = Math.min(yPosition + 10, pageHeight - margin - stampHeight - 10);
      
      pdf.addImage(clinic.stamp, 'PNG', stampX, stampY, stampWidth, stampHeight);
      
      // Add signature line below stamp
      pdf.setDrawColor(100, 100, 100);
      pdf.line(stampX, stampY + stampHeight + 5, stampX + stampWidth, stampY + stampHeight + 5);
      pdf.setFontSize(8);
      pdf.text('Assinatura/Carimbo', stampX + stampWidth / 2, stampY + stampHeight + 10, { align: 'center' });
    } catch (error) {
      console.error('Error loading stamp:', error);
    }
  }

  // Footer with date
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(
    `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Save the PDF
  const fileName = `evolucao_${patient.name.replace(/\s+/g, '_')}_${format(new Date(evolution.date), 'dd-MM-yyyy')}.pdf`;
  pdf.save(fileName);
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
