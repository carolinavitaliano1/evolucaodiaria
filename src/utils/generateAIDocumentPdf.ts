import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ExtraSignature {
  label: string; // e.g. "Assinatura do Paciente"
}

interface AIDocPdfInput {
  title: string;
  /** Either plain text (legacy) or HTML from rich editor. If contains '<' it's treated as HTML. */
  bodyText: string;
  logoUrl?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  professionalName?: string | null;
  professionalRegistration?: string | null;
  todayBR: string;
  cityLine?: string | null;
  /** URL of the professional's stamp image to render right after signature */
  stampUrl?: string | null;
  /** Extra signature lines (patient, guardian, etc.) */
  extraSignatures?: ExtraSignature[];
}

/**
 * Generates an A4 PDF for the AI Documents Hub.
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
    stampUrl,
    extraSignatures = [],
  } = input;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.height = 'auto';
  // A4 at 96 DPI ≈ 794×1123 px. 1 inch margin (96px) on every side mirrors the DOCX export.
  container.style.padding = '96px 96px';
  container.style.background = '#ffffff';
  container.style.color = '#111111';
  container.style.fontFamily = 'Georgia, "Times New Roman", serif';
  container.style.fontSize = '12px';
  container.style.lineHeight = '1.5';
  container.style.boxSizing = 'border-box';

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const isHtml = /<[a-z][\s\S]*>/i.test(bodyText);

  // TipTap stores image size as `width="400px"` attribute; html2canvas honors
  // inline styles more reliably. Mirror the width/height attrs into inline CSS
  // so the rendered size matches what the user picked in the editor.
  const normalizeImageSizes = (html: string) =>
    html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
      const widthMatch = attrs.match(/\swidth=["']([^"']+)["']/i);
      const heightMatch = attrs.match(/\sheight=["']([^"']+)["']/i);
      if (!widthMatch && !heightMatch) return full;
      const toCss = (v: string) => (/^\d+$/.test(v.trim()) ? `${v.trim()}px` : v.trim());
      const styleMatch = attrs.match(/\sstyle=["']([^"']*)["']/i);
      const parts: string[] = [];
      if (styleMatch) parts.push(styleMatch[1].replace(/;\s*$/, ''));
      if (widthMatch) parts.push(`width:${toCss(widthMatch[1])}`);
      if (heightMatch) parts.push(`height:${toCss(heightMatch[1])}`);
      // Override max-width from the .rich-body img rule so user size wins.
      parts.push('max-width:100%');
      let newAttrs = attrs.replace(/\sstyle=["'][^"']*["']/i, '');
      newAttrs += ` style="${parts.join('; ')}"`;
      // Add crossorigin so html2canvas can render remote images.
      if (!/\scrossorigin=/i.test(newAttrs)) newAttrs += ' crossorigin="anonymous"';
      return `<img${newAttrs}>`;
    });

  let bodyHtml: string;
  if (isHtml) {
    bodyHtml = `<div class="rich-body" style="text-align: justify;">${normalizeImageSizes(bodyText)}</div>`;
  } else {
    bodyHtml = (bodyText || '')
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p style="margin:0 0 14px 0; text-align: justify; text-indent: 32px;">${escape(p).replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }

  const extraSigsHtml = extraSignatures.length
    ? `<div style="margin-top: 50px; display:flex; flex-direction:column; gap:48px; align-items:center;">
        ${extraSignatures.map(s => `
          <div style="border-top:1px solid #000; width:320px; padding-top:6px; text-align:center; font-size:13px;">
            ${escape(s.label)}
          </div>`).join('')}
      </div>`
    : '';

  const stampHtml = stampUrl
    ? `<img src="${stampUrl}" crossorigin="anonymous" style="max-height:80px; max-width:200px; object-fit:contain; opacity:0.95; display:block; margin: 0 auto 4px auto;" />`
    : '';

  container.innerHTML = `
    <style>
      .rich-body p { margin: 0 0 12px 0; }
      .rich-body h1, .rich-body h2, .rich-body h3 { margin: 16px 0 8px; }
      .rich-body img { max-width: 100%; height: auto; }
      .rich-body ul, .rich-body ol { margin: 8px 0 12px 24px; }
    </style>
    <div style="text-align:center; border-bottom: 1px solid #cccccc; padding-bottom: 12px; margin-bottom: 24px;">
      ${logoUrl ? `<img src="${logoUrl}" crossorigin="anonymous" style="max-height:80px; max-width: 280px; object-fit: contain; margin: 0 auto 8px; display:block;" />` : ''}
      ${headerText ? `<div style="font-size:10px; line-height:1.4; color:#333; white-space: pre-line;">${escape(headerText)}</div>` : ''}
    </div>

    <h1 style="text-align:center; font-size:16px; font-weight:bold; text-transform: uppercase; margin: 0 0 24px 0; letter-spacing: 1px; font-family: Georgia, serif;">
      ${escape(title)}
    </h1>

    ${bodyHtml}

    ${cityLine ? `<p style="margin-top: 32px; text-align:center; font-size:12px;">${escape(cityLine)}</p>` : ''}

    <div style="margin-top: 48px; text-align:center;">
      ${stampHtml}
      <div style="border-top: 1px solid #000; width: 280px; margin: 0 auto; padding-top: 6px; position: relative; z-index: 1;">
        <div style="font-weight:600; font-size:12px;">${escape(professionalName || '')}</div>
        ${professionalRegistration ? `<div style="font-size:11px; color:#444;">${escape(professionalRegistration)}</div>` : ''}
      </div>
    </div>

    ${extraSigsHtml}

    ${footerText ? `
      <div style="margin-top: 48px; border-top: 1px solid #cccccc; padding-top: 8px; text-align:center; font-size:9px; color:#555; white-space: pre-line; line-height:1.4;">
        ${escape(footerText)}
      </div>
    ` : ''}
  `;

  document.body.appendChild(container);

  try {
    // Wait for all images inside the offscreen container to actually load,
    // otherwise html2canvas snapshots them as empty/broken and they disappear from the PDF.
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      imgs.map(img =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>(res => {
              img.onload = () => res();
              img.onerror = () => res();
              setTimeout(() => res(), 5000);
            })
      )
    );

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

    while (heightLeft > 1) {
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
