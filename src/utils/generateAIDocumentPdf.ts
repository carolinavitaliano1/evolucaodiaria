import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  AI_DOC_LAYOUT,
  inlineExportImagesInHtml,
  normalizeRichTextImageSizes,
} from '@/utils/aiDocumentExportShared';

export interface ExtraSignature {
  label: string;
}

interface AIDocPdfInput {
  title: string;
  bodyText: string;
  logoUrl?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  professionalName?: string | null;
  professionalRegistration?: string | null;
  todayBR: string;
  cityLine?: string | null;
  stampUrl?: string | null;
  extraSignatures?: ExtraSignature[];
}

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
  container.style.width = `${AI_DOC_LAYOUT.pageWidthPx}px`;
  container.style.background = '#ffffff';
  container.style.color = '#111111';
  container.style.fontFamily = AI_DOC_LAYOUT.fontFamily;
  container.style.fontSize = `${AI_DOC_LAYOUT.baseFontPt}pt`;
  container.style.lineHeight = '1.5';
  container.style.boxSizing = 'border-box';

  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const isHtml = /<[a-z][\s\S]*>/i.test(bodyText);
  const normalizedBodyHtml = isHtml
    ? await inlineExportImagesInHtml(bodyText)
    : (bodyText || '')
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map(
          (paragraph) =>
            `<p class="doc-paragraph">${escape(paragraph).replace(/\n/g, '<br/>')}</p>`,
        )
        .join('');

  const extraSignaturesHtml = extraSignatures.length
    ? `<div class="extra-signatures">
        ${extraSignatures
          .map(
            (signature) => `
              <div class="signature-block extra-signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">${escape(signature.label)}</div>
              </div>`,
          )
          .join('')}
      </div>`
    : '';

  const preparedHtml = isHtml ? normalizeRichTextImageSizes(normalizedBodyHtml) : normalizedBodyHtml;

  container.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .doc-page {
        width: ${AI_DOC_LAYOUT.pageWidthPx}px;
        min-height: ${AI_DOC_LAYOUT.pageHeightPx}px;
        padding: ${AI_DOC_LAYOUT.pagePaddingPx}px;
        background: #ffffff;
        color: #111111;
        font-family: ${AI_DOC_LAYOUT.fontFamily};
        font-size: ${AI_DOC_LAYOUT.baseFontPt}pt;
        line-height: 1.5;
      }
      .doc-header {
        text-align: center;
        border-bottom: 1px solid #cccccc;
        padding-bottom: 12px;
        margin-bottom: 24px;
      }
      .doc-logo {
        max-height: 80px;
        max-width: 280px;
        object-fit: contain;
        display: block;
        margin: 0 auto 8px;
      }
      .doc-header-text {
        font-size: ${AI_DOC_LAYOUT.headerFontPt}pt;
        line-height: 1.4;
        color: #333333;
        white-space: pre-line;
      }
      .doc-title {
        text-align: center;
        font-size: ${AI_DOC_LAYOUT.titleFontPt}pt;
        font-weight: 700;
        text-transform: uppercase;
        margin: 0 0 24px 0;
        letter-spacing: 0;
      }
      .doc-body {
        width: 100%;
      }
      .doc-body p,
      .doc-paragraph {
        margin: 0 0 12px 0;
        text-align: justify;
        text-indent: 32px;
        font-size: ${AI_DOC_LAYOUT.baseFontPt}pt;
        line-height: 1.5;
      }
      .doc-body h1,
      .doc-body h2,
      .doc-body h3 {
        margin: 16px 0 8px;
        font-family: ${AI_DOC_LAYOUT.fontFamily};
        line-height: 1.35;
      }
      .doc-body h1 { font-size: ${AI_DOC_LAYOUT.heading1Pt}pt; }
      .doc-body h2 { font-size: ${AI_DOC_LAYOUT.heading2Pt}pt; }
      .doc-body h3 { font-size: ${AI_DOC_LAYOUT.heading3Pt}pt; }
      .doc-body ul,
      .doc-body ol {
        margin: 8px 0 12px 24px;
        padding: 0;
      }
      .doc-body li {
        margin: 0 0 6px 0;
        font-size: ${AI_DOC_LAYOUT.baseFontPt}pt;
        line-height: 1.5;
      }
      .doc-body img {
        max-width: 100%;
        height: auto;
        object-fit: contain;
        display: block;
        margin: 12px auto;
        break-inside: avoid;
      }
      .city-line {
        margin-top: 32px;
        text-align: center;
        font-size: ${AI_DOC_LAYOUT.baseFontPt}pt;
      }
      .signature-wrap {
        margin-top: 48px;
        text-align: center;
      }
      .stamp-image {
        max-height: 80px;
        max-width: 180px;
        object-fit: contain;
        opacity: 0.95;
        display: block;
        margin: 0 auto 4px;
      }
      .signature-block {
        width: 280px;
        margin: 0 auto;
        text-align: center;
      }
      .signature-line {
        border-top: 1px solid #000000;
        width: 100%;
        margin: 0 auto;
      }
      .signature-name {
        padding-top: 6px;
        font-weight: 600;
        font-size: ${AI_DOC_LAYOUT.signatureNamePt}pt;
      }
      .signature-reg {
        font-size: ${AI_DOC_LAYOUT.signatureRegPt}pt;
        color: #444444;
      }
      .extra-signatures {
        margin-top: 50px;
        display: flex;
        flex-direction: column;
        gap: 48px;
        align-items: center;
      }
      .extra-signature-block {
        width: 320px;
      }
      .signature-label {
        padding-top: 6px;
        text-align: center;
        font-size: ${AI_DOC_LAYOUT.signatureRegPt}pt;
      }
      .doc-footer {
        margin-top: 48px;
        border-top: 1px solid #cccccc;
        padding-top: 8px;
        text-align: center;
        font-size: ${AI_DOC_LAYOUT.footerFontPt}pt;
        color: #555555;
        white-space: pre-line;
        line-height: 1.4;
      }
    </style>
    <div class="doc-page">
      <div class="doc-header">
        ${logoUrl ? `<img src="${logoUrl}" class="doc-logo" crossorigin="anonymous" />` : ''}
        ${headerText ? `<div class="doc-header-text">${escape(headerText)}</div>` : ''}
      </div>

      <h1 class="doc-title">${escape(title)}</h1>

      <div class="doc-body">${preparedHtml}</div>

      ${cityLine ? `<p class="city-line">${escape(cityLine)}</p>` : ''}

      <div class="signature-wrap">
        ${stampUrl ? `<img src="${stampUrl}" class="stamp-image" crossorigin="anonymous" />` : ''}
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">${escape(professionalName || '')}</div>
          ${professionalRegistration ? `<div class="signature-reg">${escape(professionalRegistration)}</div>` : ''}
        </div>
      </div>

      ${extraSignaturesHtml}

      ${footerText ? `<div class="doc-footer">${escape(footerText)}</div>` : ''}
    </div>
  `;

  document.body.appendChild(container);

  try {
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(() => resolve(), 5000);
              }),
      ),
    );

    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      foreignObjectRendering: true,
      imageTimeout: 15000,
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 1) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const blob = pdf.output('blob');
    const dataUrl = pdf.output('datauristring');
    return { blob, dataUrl };
  } finally {
    document.body.removeChild(container);
  }
}
