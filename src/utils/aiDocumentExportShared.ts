export const AI_DOC_LAYOUT = {
  pageWidthPx: 794,
  pageHeightPx: 1123,
  pagePaddingPx: 96,
  pageWidthDxa: 11906,
  pageHeightDxa: 16838,
  pageMarginDxa: 1440,
  fontFamily: 'Georgia, "Times New Roman", serif',
  baseFontPt: 12,
  headerFontPt: 10,
  footerFontPt: 9,
  titleFontPt: 16,
  heading1Pt: 16,
  heading2Pt: 14,
  heading3Pt: 13,
  signatureNamePt: 12,
  signatureRegPt: 11,
} as const;

export const AI_DOC_CONTENT_WIDTH_PX = AI_DOC_LAYOUT.pageWidthPx - AI_DOC_LAYOUT.pagePaddingPx * 2;

export type ExportImageInfo = {
  data: Uint8Array;
  dataUrl: string;
  type: 'png';
  width: number;
  height: number;
};

export function stripMetaScript(html: string): string {
  return html.replace(/<script[^>]*id=["']docia-meta["'][^>]*>[\s\S]*?<\/script>/gi, '');
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export function parseSize(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (/%$/.test(value)) {
    const pct = parseFloat(value);
    return Number.isFinite(pct) ? Math.round((AI_DOC_CONTENT_WIDTH_PX * pct) / 100) : null;
  }
  if (/pt$/i.test(value)) {
    const pt = parseFloat(value);
    return Number.isFinite(pt) ? Math.round(pt * (96 / 72)) : null;
  }
  const numeric = parseFloat(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
}

export function extractAttr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}=["']([^"']+)["']`, 'i'));
  return match ? match[1] : null;
}

export function extractStyleProp(style: string | null | undefined, prop: string): string | null {
  if (!style) return null;
  const match = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return match ? match[1].trim() : null;
}

export function normalizeRichTextImageSizes(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const widthMatch = attrs.match(/\swidth=["']([^"']+)["']/i);
    const heightMatch = attrs.match(/\sheight=["']([^"']+)["']/i);
    const styleMatch = attrs.match(/\sstyle=["']([^"']*)["']/i);

    const styles = new Map<string, string>();
    if (styleMatch?.[1]) {
      styleMatch[1]
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          const [key, ...rest] = part.split(':');
          if (!key || rest.length === 0) return;
          styles.set(key.trim().toLowerCase(), rest.join(':').trim());
        });
    }

    if (widthMatch?.[1]) styles.set('width', /^\d+$/.test(widthMatch[1].trim()) ? `${widthMatch[1].trim()}px` : widthMatch[1].trim());
    if (heightMatch?.[1]) styles.set('height', /^\d+$/.test(heightMatch[1].trim()) ? `${heightMatch[1].trim()}px` : heightMatch[1].trim());

    if (!styles.has('height') && styles.has('width')) styles.set('height', 'auto');
    styles.set('max-width', `${AI_DOC_CONTENT_WIDTH_PX}px`);
    styles.set('object-fit', 'contain');
    styles.set('display', 'block');
    styles.set('margin', '12pt auto');

    let newAttrs = attrs.replace(/\sstyle=["'][^"']*["']/i, '');
    if (!/\scrossorigin=/i.test(newAttrs)) newAttrs += ' crossorigin="anonymous"';

    const styleValue = Array.from(styles.entries())
      .map(([key, value]) => `${key}:${value}`)
      .join('; ');

    return `<img${newAttrs} style="${styleValue}" />`;
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const [, base64 = ''] = dataUrl.split(',', 2);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function sourceToDataUrl(src: string): Promise<string | null> {
  if (!src) return null;
  if (/^data:/i.test(src)) return src;

  try {
    const response = await fetch(src, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = dataUrl;
  });
}

export async function resolveImageForExport(src: string | null | undefined): Promise<ExportImageInfo | null> {
  if (!src) return null;

  try {
    const sourceDataUrl = await sourceToDataUrl(src);
    if (!sourceDataUrl) return null;

    const img = await loadImage(sourceDataUrl);
    const width = img.naturalWidth || 400;
    const height = img.naturalHeight || 300;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        data: dataUrlToBytes(sourceDataUrl),
        dataUrl: sourceDataUrl,
        type: 'png',
        width,
        height,
      };
    }

    ctx.drawImage(img, 0, 0, width, height);
    const pngDataUrl = canvas.toDataURL('image/png');

    return {
      data: dataUrlToBytes(pngDataUrl),
      dataUrl: pngDataUrl,
      type: 'png',
      width,
      height,
    };
  } catch {
    return null;
  }
}

export async function inlineExportImagesInHtml(html: string): Promise<string> {
  const normalized = normalizeRichTextImageSizes(stripMetaScript(html));
  const matches = Array.from(normalized.matchAll(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi));
  if (matches.length === 0) return normalized;

  const replacements = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(matches.map((match) => match[1]))).map(async (src) => {
      const info = await resolveImageForExport(src);
      if (info?.dataUrl) replacements.set(src, info.dataUrl);
    }),
  );

  if (replacements.size === 0) return normalized;

  return normalized.replace(/(<img\b[^>]*src=["'])([^"']+)(["'][^>]*>)/gi, (full, start, src, end) => {
    const nextSrc = replacements.get(src);
    return nextSrc ? `${start}${nextSrc}${end}` : full;
  });
}
