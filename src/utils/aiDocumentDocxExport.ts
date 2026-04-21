import { asBlob } from 'html-docx-js-typescript';

interface DocxExportInput {
  title: string;
  bodyHtml: string; // rich HTML
  logoUrl?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  professionalName?: string | null;
  professionalRegistration?: string | null;
  cityLine?: string | null;
  stampUrl?: string | null;
  extraSignatures?: { label: string }[];
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Strip our hidden meta script so it doesn't show in the document body. */
function stripMetaScript(html: string): string {
  return html.replace(/<script[^>]*id=["']docia-meta["'][^>]*>[\s\S]*?<\/script>/gi, '');
}

/** Converts an external image URL into a base64 data URI so it embeds inside the .docx */
async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise(res => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result as string);
      reader.onerror = () => res(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Replace every <img src="http..."> with a data URI version so Word renders it. */
async function inlineImages(html: string): Promise<string> {
  const matches = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi));
  let out = html;
  for (const m of matches) {
    const src = m[1];
    if (src.startsWith('data:')) continue;
    const dataUrl = await urlToDataUrl(src);
    if (dataUrl) out = out.split(src).join(dataUrl);
  }
  return out;
}

/**
 * TipTap stores image size as a `width="400px"` attribute. html-docx-js / Word
 * ignore that attribute and either drop the image or render it at full natural
 * size. Convert width/height attributes into an inline style so Word respects
 * the size the user picked in the editor.
 */
function normalizeImageSizes(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const widthMatch = attrs.match(/\swidth=["']([^"']+)["']/i);
    const heightMatch = attrs.match(/\sheight=["']([^"']+)["']/i);
    const styleMatch = attrs.match(/\sstyle=["']([^"']*)["']/i);

    const toCss = (v: string) => (/^\d+$/.test(v.trim()) ? `${v.trim()}px` : v.trim());

    const styleParts: string[] = [];
    if (styleMatch) styleParts.push(styleMatch[1].replace(/;\s*$/, ''));
    if (widthMatch) styleParts.push(`width:${toCss(widthMatch[1])}`);
    if (heightMatch) styleParts.push(`height:${toCss(heightMatch[1])}`);
    if (!widthMatch && !heightMatch && !styleMatch) return full;

    let newAttrs = attrs
      .replace(/\sstyle=["'][^"']*["']/i, '')
      .replace(/\swidth=["'][^"']+["']/i, '')
      .replace(/\sheight=["'][^"']+["']/i, '');
    newAttrs += ` style="${styleParts.join('; ')}"`;
    // Keep explicit width/height attrs too — Word reads them when present.
    if (widthMatch) newAttrs += ` width="${parseInt(widthMatch[1], 10) || ''}"`;
    if (heightMatch) newAttrs += ` height="${parseInt(heightMatch[1], 10) || ''}"`;
    return `<img${newAttrs}>`;
  });
}

export async function generateAIDocumentDocx(input: DocxExportInput): Promise<Blob> {
  const {
    title, bodyHtml, logoUrl, headerText, footerText,
    professionalName, professionalRegistration, cityLine,
    stampUrl, extraSignatures = [],
  } = input;

  const cleanBody = stripMetaScript(bodyHtml);
  const sizedBody = normalizeImageSizes(cleanBody);
  const inlinedBody = await inlineImages(sizedBody);
  const inlinedLogo = logoUrl ? await urlToDataUrl(logoUrl) : null;
  const inlinedStamp = stampUrl ? await urlToDataUrl(stampUrl) : null;

  const headerBlock = `
    <div style="text-align:center; border-bottom:1px solid #ccc; padding-bottom:8px; margin-bottom:20px;">
      ${inlinedLogo ? `<img src="${inlinedLogo}" style="max-height:90px; max-width:280px;" /><br/>` : ''}
      ${headerText ? `<div style="font-size:11px; color:#333; white-space:pre-line;">${escape(headerText)}</div>` : ''}
    </div>`;

  const titleBlock = `
    <h1 style="text-align:center; font-size:18px; text-transform:uppercase; letter-spacing:1px; margin:0 0 20px 0;">
      ${escape(title)}
    </h1>`;

  const body = `<div style="text-align:justify; font-family:Georgia,serif; font-size:14px; line-height:1.8;">${inlinedBody}</div>`;

  const cityBlock = cityLine
    ? `<p style="text-align:center; margin-top:32px;">${escape(cityLine)}</p>`
    : '';

  // Stamp appears ABOVE the signature line (matches PDF layout)
  const stampBlock = inlinedStamp
    ? `<div style="text-align:center; margin-top:48px; margin-bottom:-8px;"><img src="${inlinedStamp}" style="max-height:80px; max-width:200px;" /></div>`
    : '';

  const signatureBlock = `
    <div style="margin-top:${inlinedStamp ? '4px' : '48px'}; text-align:center;">
      <div style="border-top:1px solid #000; width:320px; margin:0 auto; padding-top:4px;">
        <strong>${escape(professionalName || '')}</strong><br/>
        ${professionalRegistration ? `<span style="font-size:12px;">${escape(professionalRegistration)}</span>` : ''}
      </div>
    </div>`;

  const extraSigsBlock = extraSignatures.length
    ? extraSignatures.map(s => `
        <div style="margin-top:40px; text-align:center;">
          <div style="border-top:1px solid #000; width:320px; margin:0 auto; padding-top:4px; font-size:13px;">
            ${escape(s.label)}
          </div>
        </div>`).join('')
    : '';

  const footerBlock = footerText
    ? `<div style="margin-top:40px; border-top:1px solid #ccc; padding-top:8px; text-align:center; font-size:11px; color:#555; white-space:pre-line;">${escape(footerText)}</div>`
    : '';

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escape(title)}</title></head>
    <body>${headerBlock}${titleBlock}${body}${cityBlock}${stampBlock}${signatureBlock}${extraSigsBlock}${footerBlock}</body></html>`;

  const result = await asBlob(fullHtml, { orientation: 'portrait', margins: { top: 720, right: 720, bottom: 720, left: 720 } });
  return result instanceof Blob ? result : new Blob([result as any], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
