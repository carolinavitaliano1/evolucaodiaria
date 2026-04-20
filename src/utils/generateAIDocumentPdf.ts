import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface AIDocPdfInput {
  title: string;
  bodyText: string;
  logoUrl?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  professionalName?: string | null;
  professionalRegistration?: string | null;
  todayBR: string;
  cityLine?: string | null; // ex: "São Paulo, 20 de abril de 2026"
}

/**
 * Generates an A4 PDF for the AI Documents Hub.
 * Returns a Blob ready for upload + a base64 dataUrl for direct download.
 */
export async function generateAIDocumentPdf(input: AIDocPdfInput): Promise<{ blob: Blob; dataUrl: string }> {
  const {
    title,
    bodyText,
    logoUrl,
    headerText,
    footerText,
    professionalName,
    professionalRegistration,
    cityLine,
  } = input;

  // Build off-screen HTML container styled as A4
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 width @ 96dpi
  container.style.minHeight = '1123px';
  container.style.padding = '64px 72px';
  container.style.background = '#ffffff';
  container.style.color = '#111111';
  container.style.fontFamily = 'Georgia, "Times New Roman", serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '2'; // double spacing
  container.style.boxSizing = 'border-box';

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const paragraphs = (bodyText || '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 14px 0; text-align: justify; text-indent: 32px;">${escape(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  container.innerHTML = `
    <div style="text-align:center; border-bottom: 1px solid #cccccc; padding-bottom: 16px; margin-bottom: 28px;">
      ${logoUrl ? `<img src="${logoUrl}" crossorigin="anonymous" style="max-height:90px; max-width: 280px; object-fit: contain; margin: 0 auto 10px; display:block;" />` : ''}
      ${headerText ? `<div style="font-size:12px; line-height:1.4; color:#333; white-space: pre-line;">${escape(headerText)}</div>` : ''}
    </div>

    <h1 style="text-align:center; font-size:18px; font-weight:bold; text-transform: uppercase; margin: 0 0 28px 0; letter-spacing: 1px;">
      ${escape(title)}
    </h1>

    <div style="text-align: justify;">
      ${paragraphs}
    </div>

    ${cityLine ? `<p style="margin-top: 40px; text-align:center;">${escape(cityLine)}</p>` : ''}

    <div style="margin-top: 60px; text-align:center;">
      <div style="border-top: 1px solid #000; width: 320px; margin: 0 auto; padding-top: 6px;">
        <div style="font-weight:600;">${escape(professionalName || '')}</div>
        ${professionalRegistration ? `<div style="font-size:12px; color:#444;">${escape(professionalRegistration)}</div>` : ''}
      </div>
    </div>

    ${footerText ? `
      <div style="position: absolute; bottom: 32px; left: 72px; right: 72px; border-top: 1px solid #cccccc; padding-top: 10px; text-align:center; font-size:11px; color:#555; white-space: pre-line; line-height:1.4;">
        ${escape(footerText)}
      </div>
    ` : ''}
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const blob = pdf.output('blob');
    const dataUrl = pdf.output('datauristring');
    return { blob, dataUrl };
  } finally {
    document.body.removeChild(container);
  }
}
