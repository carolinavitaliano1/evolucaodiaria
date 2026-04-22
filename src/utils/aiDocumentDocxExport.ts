import {
  Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType,
  HeadingLevel, PageOrientation, Header, Footer, BorderStyle, LevelFormat,
} from 'docx';

export interface DocxExtraSignature { label: string; }

interface DocxExportInput {
  title: string;
  bodyHtml: string;
  logoUrl?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  professionalName?: string | null;
  professionalRegistration?: string | null;
  cityLine?: string | null;
  stampUrl?: string | null;
  extraSignatures?: DocxExtraSignature[];
}

const PAGE_CONTENT_WIDTH_DXA = 9026; // A4 minus 1 inch margins on each side
const EMU_PER_PIXEL = 9525;
const MAX_BODY_IMG_WIDTH_PX = 600; // ~ matches A4 content width visually

type ImgInfo = { data: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp'; width: number; height: number };

function stripMetaScript(html: string): string {
  return html.replace(/<script[^>]*id=["']docia-meta["'][^>]*>[\s\S]*?<\/script>/gi, '');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function fetchImage(url: string): Promise<ImgInfo | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const buf = new Uint8Array(await blob.arrayBuffer());

    let type: ImgInfo['type'] = 'png';
    const mime = (blob.type || '').toLowerCase();
    if (mime.includes('jpeg') || mime.includes('jpg')) type = 'jpg';
    else if (mime.includes('gif')) type = 'gif';
    else if (mime.includes('bmp')) type = 'bmp';
    else if (mime.includes('png')) type = 'png';
    else if (url.match(/\.(jpe?g)(\?|$)/i)) type = 'jpg';
    else if (url.match(/\.gif(\?|$)/i)) type = 'gif';

    // Get natural dimensions via HTMLImageElement
    const dataUrl = await new Promise<string>(res => {
      const r = new FileReader();
      r.onloadend = () => res(r.result as string);
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>(res => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth || 400, h: img.naturalHeight || 300 });
      img.onerror = () => res({ w: 400, h: 300 });
      img.src = dataUrl;
    });

    return { data: buf, type, width: dims.w, height: dims.h };
  } catch {
    return null;
  }
}

/** Parse "400px" / "400" / "50%" → pixels (% resolved against MAX_BODY_IMG_WIDTH_PX). */
function parseSize(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const v = raw.trim();
  if (/%$/.test(v)) {
    const pct = parseFloat(v) / 100;
    return Math.round(MAX_BODY_IMG_WIDTH_PX * pct);
  }
  const n = parseFloat(v);
  return isFinite(n) ? Math.round(n) : null;
}

function extractAttr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}=["']([^"']+)["']`, 'i'));
  return m ? m[1] : null;
}

function extractStyleProp(style: string | null, prop: string): string | null {
  if (!style) return null;
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
}

/** Convert pixel size to docx ImageRun transformation. Caps width at content width. */
function sizeForImage(info: ImgInfo, requestedWidthPx: number | null, requestedHeightPx: number | null) {
  const ratio = info.width > 0 && info.height > 0 ? info.height / info.width : 0.75;
  let w = requestedWidthPx ?? info.width;
  let h = requestedHeightPx ?? Math.round(w * ratio);
  if (!requestedWidthPx && !requestedHeightPx) {
    // No explicit size – cap at sensible default but keep aspect.
    if (w > MAX_BODY_IMG_WIDTH_PX) {
      w = MAX_BODY_IMG_WIDTH_PX;
      h = Math.round(w * ratio);
    }
  }
  // Hard cap to content width.
  if (w > MAX_BODY_IMG_WIDTH_PX) {
    w = MAX_BODY_IMG_WIDTH_PX;
    h = Math.round(w * ratio);
  }
  return { width: Math.max(20, w), height: Math.max(20, h) };
}

/**
 * Walk through the body HTML and produce an array of docx Paragraphs.
 * Supports: <p>, <br>, <h1-3>, <strong>/<b>, <em>/<i>, <u>, <ul>/<ol>/<li>, <img>.
 * Inline <img> renders as its own centered paragraph (Word can't truly inline images mid-line easily without anchors).
 */
async function htmlToParagraphs(html: string): Promise<Paragraph[]> {
  // Normalize <br> to newline markers we'll split on later.
  const cleaned = html
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>(\s*)/gi, '\n');

  // Pre-fetch every image so paragraph build can be synchronous.
  const imgUrls = Array.from(cleaned.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)).map(m => m[1]);
  const imgCache = new Map<string, ImgInfo | null>();
  await Promise.all(
    Array.from(new Set(imgUrls)).map(async u => {
      imgCache.set(u, await fetchImage(u));
    })
  );

  // Split on block boundaries while preserving structure.
  // Tokenize by walking with a regex over recognized block tags.
  const blockRegex = /<(p|h1|h2|h3|ul|ol|div)([^>]*)>([\s\S]*?)<\/\1>|<img[^>]+>/gi;
  const out: Paragraph[] = [];

  // If the html has no block tags, treat the whole thing as one paragraph.
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pushFreeText = (chunk: string) => {
    const text = decodeEntities(chunk.replace(/<[^>]+>/g, '')).trim();
    if (text) out.push(new Paragraph({ children: [new TextRun({ text, font: 'Georgia', size: 24 })], alignment: AlignmentType.JUSTIFIED }));
  };

  while ((match = blockRegex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      pushFreeText(cleaned.slice(lastIndex, match.index));
    }
    const full = match[0];
    const tag = (match[1] || '').toLowerCase();

    if (full.toLowerCase().startsWith('<img')) {
      const src = extractAttr(full, 'src');
      if (src && imgCache.get(src)) {
        const info = imgCache.get(src)!;
        const style = extractAttr(full, 'style');
        const wRaw = extractAttr(full, 'width') || extractStyleProp(style, 'width');
        const hRaw = extractAttr(full, 'height') || extractStyleProp(style, 'height');
        const wPx = parseSize(wRaw);
        const hPx = parseSize(hRaw);
        const { width, height } = sizeForImage(info, wPx, hPx);
        out.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
          children: [new ImageRun({
            type: info.type as any,
            data: info.data,
            transformation: { width, height },
          } as any)],
        }));
      }
      lastIndex = blockRegex.lastIndex;
      continue;
    }

    const inner = match[3] || '';

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const text = decodeEntities(inner.replace(/<[^>]+>/g, '')).trim();
      if (text) {
        const heading = tag === 'h1' ? HeadingLevel.HEADING_1 : tag === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
        out.push(new Paragraph({
          heading,
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text, bold: true, font: 'Georgia', size: tag === 'h1' ? 32 : tag === 'h2' ? 28 : 26 })],
        }));
      }
    } else if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
      for (const li of items) {
        await pushInlineParagraphs(li[1], out, imgCache, {
          bullet: tag === 'ul' ? { level: 0 } : undefined,
          numbering: tag === 'ol' ? { reference: 'docia-numbers', level: 0 } : undefined,
        });
      }
    } else {
      // p / div – may contain inline imgs and formatting + newlines from <br>.
      await pushInlineParagraphs(inner, out, imgCache, {});
    }

    lastIndex = blockRegex.lastIndex;
  }

  if (lastIndex < cleaned.length) {
    pushFreeText(cleaned.slice(lastIndex));
  }

  if (out.length === 0) {
    out.push(new Paragraph({ children: [new TextRun('')] }));
  }
  return out;
}

async function pushInlineParagraphs(
  html: string,
  out: Paragraph[],
  imgCache: Map<string, ImgInfo | null>,
  opts: { bullet?: { level: number }; numbering?: { reference: string; level: number } },
) {
  // Split by inline <img> – each image becomes its own paragraph; surrounding text becomes paragraphs too.
  const parts = html.split(/(<img[^>]+>)/gi);
  // Then split text by newlines (from <br>).
  for (const part of parts) {
    if (!part) continue;
    if (/^<img/i.test(part)) {
      const src = extractAttr(part, 'src');
      const info = src ? imgCache.get(src) : null;
      if (src && info) {
        const style = extractAttr(part, 'style');
        const wRaw = extractAttr(part, 'width') || extractStyleProp(style, 'width');
        const hRaw = extractAttr(part, 'height') || extractStyleProp(style, 'height');
        const { width, height } = sizeForImage(info, parseSize(wRaw), parseSize(hRaw));
        out.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
          children: [new ImageRun({
            type: info.type as any,
            data: info.data,
            transformation: { width, height },
          } as any)],
        }));
      }
      continue;
    }
    // Text segment with inline formatting.
    const segments = part.split('\n');
    for (const seg of segments) {
      const runs = inlineRuns(seg);
      if (runs.length === 0) continue;
      out.push(new Paragraph({
        alignment: opts.bullet || opts.numbering ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
        spacing: { line: 360, after: 120 },
        bullet: opts.bullet,
        numbering: opts.numbering,
        children: runs,
      }));
    }
  }
}

/** Convert a fragment with <strong>/<em>/<u> to TextRuns. */
function inlineRuns(html: string): TextRun[] {
  const runs: TextRun[] = [];
  // Tokenize by tag boundaries while tracking active formatting.
  const re = /<\/?(strong|b|em|i|u|span)[^>]*>|[^<]+/gi;
  let bold = false, italic = false, underline = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tok = m[0];
    if (tok.startsWith('<')) {
      const close = tok.startsWith('</');
      const name = (m[1] || '').toLowerCase();
      if (name === 'strong' || name === 'b') bold = !close;
      else if (name === 'em' || name === 'i') italic = !close;
      else if (name === 'u') underline = !close;
      // span ignored
      continue;
    }
    const text = decodeEntities(tok);
    if (!text) continue;
    runs.push(new TextRun({
      text, bold, italics: italic, underline: underline ? {} : undefined,
      font: 'Georgia', size: 24,
    }));
  }
  // Trim leading/trailing empty
  return runs.filter(r => (r as any).options?.text !== '');
}

export async function generateAIDocumentDocx(input: DocxExportInput): Promise<Blob> {
  const {
    title, bodyHtml, logoUrl, headerText, footerText,
    professionalName, professionalRegistration, cityLine,
    stampUrl, extraSignatures = [],
  } = input;

  const cleanBody = stripMetaScript(bodyHtml);
  const bodyParagraphs = await htmlToParagraphs(cleanBody);

  // Header (logo + clinic header text)
  const logoInfo = logoUrl ? await fetchImage(logoUrl) : null;
  const headerChildren: Paragraph[] = [];
  if (logoInfo) {
    const ratio = logoInfo.height / logoInfo.width;
    const w = Math.min(280, logoInfo.width);
    headerChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({
        type: logoInfo.type as any,
        data: logoInfo.data,
        transformation: { width: w, height: Math.round(w * ratio) },
      } as any)],
    }));
  }
  if (headerText) {
    for (const line of headerText.split('\n')) {
      headerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: line, font: 'Georgia', size: 20, color: '333333' })],
      }));
    }
  }
  // Bottom rule on header
  if (headerChildren.length) {
    headerChildren.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 4 } },
      children: [new TextRun({ text: '' })],
    }));
  }

  // Footer
  const footerChildren: Paragraph[] = [];
  if (footerText) {
    footerChildren.push(new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 4 } },
      children: [new TextRun({ text: '' })],
    }));
    for (const line of footerText.split('\n')) {
      footerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: line, font: 'Georgia', size: 18, color: '555555' })],
      }));
    }
  }

  // Title
  const titleP = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 360 },
    children: [new TextRun({ text: title.toUpperCase(), bold: true, font: 'Georgia', size: 32 })],
  });

  // City line
  const cityP = cityLine
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 0 },
        children: [new TextRun({ text: cityLine, font: 'Georgia', size: 24 })],
      })
    : null;

  // Stamp (centered above signature line)
  const stampInfo = stampUrl ? await fetchImage(stampUrl) : null;
  const stampP = stampInfo
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 720, after: 0 },
        children: [new ImageRun({
          type: stampInfo.type as any,
          data: stampInfo.data,
          transformation: (() => {
            const ratio = stampInfo.height / stampInfo.width;
            const w = Math.min(180, stampInfo.width);
            return { width: w, height: Math.round(w * ratio) };
          })(),
        } as any)],
      })
    : null;

  // Signature line + name + registration
  const signatureChildren: Paragraph[] = [];
  signatureChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: stampP ? 0 : 720, after: 0 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
    children: [new TextRun({ text: professionalName || '', bold: true, font: 'Georgia', size: 24 })],
  }));
  if (professionalRegistration) {
    signatureChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: professionalRegistration, font: 'Georgia', size: 22, color: '444444' })],
    }));
  }

  // Extra signatures
  const extraSigParagraphs: Paragraph[] = [];
  for (const s of extraSignatures) {
    extraSigParagraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 0 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
      children: [new TextRun({ text: s.label, font: 'Georgia', size: 22 })],
    }));
  }

  const doc = new Document({
    creator: professionalName || 'CliniPro',
    title,
    numbering: {
      config: [{
        reference: 'docia-numbers',
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: {
      default: { document: { run: { font: 'Georgia', size: 24 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: headerChildren.length ? { default: new Header({ children: headerChildren }) } : undefined,
      footers: footerChildren.length ? { default: new Footer({ children: footerChildren }) } : undefined,
      children: [
        titleP,
        ...bodyParagraphs,
        ...(cityP ? [cityP] : []),
        ...(stampP ? [stampP] : []),
        ...signatureChildren,
        ...extraSigParagraphs,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}
