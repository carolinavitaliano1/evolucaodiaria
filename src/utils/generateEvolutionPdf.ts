import jsPDF from 'jspdf';
import { Evolution, Patient, Clinic } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GenerateSinglePdfOptions {
  evolution: Evolution;
  patient: Patient;
  clinic?: Clinic;
}

interface GenerateMultiplePdfOptions {
  evolutions: Evolution[];
  patient: Patient;
  clinic?: Clinic;
  startDate?: Date;
  endDate?: Date;
}

export async function generateEvolutionPdf({ evolution, patient, clinic }: GenerateSinglePdfOptions): Promise<void> {
  return generateMultipleEvolutionsPdf({ evolutions: [evolution], patient, clinic });
}

export async function generateMultipleEvolutionsPdf({ 
  evolutions, 
  patient, 
  clinic,
  startDate,
  endDate 
}: GenerateMultiplePdfOptions): Promise<void> {
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

  const addHeader = async () => {
    yPosition = margin;
    
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
  };

  await addHeader();

  // Title
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  const title = evolutions.length > 1 ? 'RELATÓRIO DE EVOLUÇÕES' : 'EVOLUÇÃO DO PACIENTE';
  pdf.text(title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  // Period info if multiple evolutions
  if (evolutions.length > 1 && startDate && endDate) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      `Período: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );
    yPosition += 8;
  }
  yPosition += 5;

  // Patient info box
  pdf.setFillColor(245, 245, 245);
  pdf.roundedRect(margin, yPosition, contentWidth, 18, 3, 3, 'F');
  
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Paciente:', margin + 5, yPosition + 8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(patient.name, margin + 30, yPosition + 8);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Total de sessões:', margin + 5, yPosition + 14);
  pdf.setFont('helvetica', 'normal');
  const presentes = evolutions.filter(e => e.attendanceStatus === 'presente').length;
  const faltas = evolutions.filter(e => e.attendanceStatus === 'falta').length;
  pdf.text(`${presentes} presenças, ${faltas} faltas`, margin + 48, yPosition + 14);

  yPosition += 28;

  // Evolutions
  for (let i = 0; i < evolutions.length; i++) {
    const evo = evolutions[i];
    
    // Check if we need a new page
    if (yPosition > pageHeight - 80) {
      pdf.addPage();
      await addHeader();
    }

    // Evolution header
    pdf.setFillColor(250, 250, 250);
    pdf.roundedRect(margin, yPosition, contentWidth, 10, 2, 2, 'F');
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(
      format(new Date(evo.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
      margin + 5,
      yPosition + 7
    );

    // Attendance status
    const statusText = evo.attendanceStatus === 'presente' ? 'PRESENTE' : 'FALTA';
    const statusColor = evo.attendanceStatus === 'presente' ? [34, 197, 94] : [239, 68, 68];
    pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.text(statusText, pageWidth - margin - 5, yPosition + 7, { align: 'right' });
    pdf.setTextColor(0, 0, 0);

    yPosition += 15;

    // Evolution text
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const text = evo.text || 'Sem descrição.';
    const textLines = pdf.splitTextToSize(text, contentWidth - 10);
    
    // Check if text fits on current page
    const textHeight = textLines.length * 5;
    if (yPosition + textHeight > pageHeight - 60) {
      pdf.addPage();
      await addHeader();
    }

    pdf.text(textLines, margin + 5, yPosition);
    yPosition += textHeight + 5;

    // Add signature if available
    if (evo.signature) {
      try {
        const signatureHeight = 20;
        if (yPosition + signatureHeight > pageHeight - 40) {
          pdf.addPage();
          await addHeader();
        }
        
        pdf.addImage(evo.signature, 'PNG', pageWidth - margin - 50, yPosition, 45, signatureHeight);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text('Assinatura digital', pageWidth - margin - 27.5, yPosition + signatureHeight + 3, { align: 'center' });
        pdf.setTextColor(0, 0, 0);
        yPosition += signatureHeight + 8;
      } catch (error) {
        console.error('Error loading signature:', error);
      }
    }

    // Separator between evolutions
    if (i < evolutions.length - 1) {
      yPosition += 3;
      pdf.setDrawColor(230, 230, 230);
      pdf.line(margin + 20, yPosition, pageWidth - margin - 20, yPosition);
      yPosition += 8;
    }
  }

  // Add stamp at the end if available
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

      // Check if stamp fits on current page
      if (yPosition + stampHeight + 20 > pageHeight - 20) {
        pdf.addPage();
        await addHeader();
      }

      yPosition += 15;
      
      // Position stamp at bottom right
      const stampX = pageWidth - margin - stampWidth;
      
      pdf.addImage(clinic.stamp, 'PNG', stampX, yPosition, stampWidth, stampHeight);
      
      // Add signature line below stamp
      pdf.setDrawColor(100, 100, 100);
      pdf.line(stampX, yPosition + stampHeight + 5, stampX + stampWidth, yPosition + stampHeight + 5);
      pdf.setFontSize(8);
      pdf.text('Carimbo da Clínica', stampX + stampWidth / 2, yPosition + stampHeight + 10, { align: 'center' });
    } catch (error) {
      console.error('Error loading stamp:', error);
    }
  }

  // Footer with date and app branding
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Página ${i} de ${totalPages} | Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    // Discrete app branding
    pdf.setFontSize(6);
    pdf.setTextColor(190, 190, 190);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Plataforma Clínica - Evolução Diária', margin, pageHeight - 5);
    pdf.setFont('helvetica', 'normal');
  }

  // Save the PDF
  const dateRange = evolutions.length > 1 && startDate && endDate
    ? `${format(startDate, 'dd-MM-yyyy')}_a_${format(endDate, 'dd-MM-yyyy')}`
    : format(new Date(evolutions[0].date), 'dd-MM-yyyy');
  
  const fileName = `evolucoes_${patient.name.replace(/\s+/g, '_')}_${dateRange}.pdf`;
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
