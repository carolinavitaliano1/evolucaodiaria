import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  PageOrientation,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import {
  AI_DOC_CONTENT_WIDTH_PX,
  AI_DOC_LAYOUT,
  decodeEntities,
  extractAttr,
  extractStyleProp,
  inlineExportImagesInHtml,
  parseSize,
  resolveImageForExport,
  stripMetaScript,
  type ExportImageInfo,
} from '@/utils/aiDocumentExportShared';

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

type RunStyleState = {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  fontFamily?: string;
  fontSizePx?: number;
};

type ParagraphOptions = {
  alignment?: AlignmentType;
  spacingAfter?: number;
  spacingBefore?: number;
  firstLine?: number;
  bullet?: { level: number };
  numbering?: { reference: string; level: number };
};

const DEFAULT_FONT_PX = 16;
const DEFAULT_TEXT_SIZE = 24;
const INDENT_FIRST_LINE_DXA = 480;
const BODY_SPACING_LINE = 360;
const BODY_SPACING_AFTER = 120;

function pxToHalfPoints(px?: number | null) {
  const safePx = px && Number.isFinite(px) ? px : DEFAULT_FONT_PX;
  return Math.max(16, Math.round(safePx * 1.5));
}

function alignmentFromValue(value?: string | null): AlignmentType | undefined {
  switch ((value || '').trim().toLowerCase()) {
    case 'left':
      return AlignmentType.LEFT;
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    default:
      return undefined;
  }
}

function extractAlignment(element?: Element | null): AlignmentType | undefined {
  if (!element) return undefined;
  return alignmentFromValue(
    extractStyleProp(element.getAttribute('style'), 'text-align') || element.getAttribute('align'),
  );
}

function extendRunState(element: Element, state: RunStyleState): RunStyleState {
  const next: RunStyleState = { ...state };
  const tag = element.tagName.toLowerCase();
  if (tag === 'strong' || tag === 'b') next.bold = true;
  if (tag === 'em' || tag === 'i') next.italics = true;
  if (tag === 'u') next.underline = true;

  const style = element.getAttribute('style');
  const fontFamily = extractStyleProp(style, 'font-family');
  const fontSize = parseSize(extractStyleProp(style, 'font-size'));

  if (fontFamily) next.fontFamily = fontFamily.split(',')[0]?.replace(/["']/g, '').trim() || state.fontFamily;
  if (fontSize) next.fontSizePx = fontSize;

  return next;
}

function textRun(text: string, state: RunStyleState) {
  return new TextRun({
    text,
    bold: state.bold,
    italics: state.italics,
    underline: state.underline ? {} : undefined,
    font: state.fontFamily || 'Georgia',
    size: pxToHalfPoints(state.fontSizePx),
  });
}

function sizeForImage(info: ExportImageInfo, requestedWidthPx: number | null, requestedHeightPx: number | null, maxWidthPx = AI_DOC_CONTENT_WIDTH_PX) {
  const ratio = info.width > 0 && info.height > 0 ? info.height / info.width : 0.75;
  let width = requestedWidthPx ?? info.width;
  let height = requestedHeightPx ?? (requestedWidthPx ? Math.round(requestedWidthPx * ratio) : info.height);

  if (requestedWidthPx && !requestedHeightPx) {
    height = Math.round(requestedWidthPx * ratio);
  }
  if (!requestedWidthPx && requestedHeightPx) {
    width = Math.round(requestedHeightPx / ratio);
  }

  if (width > maxWidthPx) {
    width = maxWidthPx;
    height = Math.round(width * ratio);
  }

  return {
    width: Math.max(24, width),
    height: Math.max(24, height),
  };
}

async function imageParagraphFromElement(
  element: Element,
  imgCache: Map<string, ExportImageInfo | null>,
  options?: { spacingBefore?: number; spacingAfter?: number; maxWidthPx?: number },
) {
  const src = element.getAttribute('src');
  if (!src) return null;

  const info = imgCache.get(src) ?? null;
  if (!info) return null;

  const style = element.getAttribute('style');
  const width = parseSize(element.getAttribute('width') || extractStyleProp(style, 'width'));
  const height = parseSize(element.getAttribute('height') || extractStyleProp(style, 'height'));
  const transformed = sizeForImage(info, width, height, options?.maxWidthPx);

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: options?.spacingBefore ?? 120, after: options?.spacingAfter ?? 120 },
    children: [new ImageRun({ type: info.type, data: info.data, transformation: transformed })],
  });
}

async function appendInlineContent(
  node: Node,
  out: Paragraph[],
  imgCache: Map<string, ExportImageInfo | null>,
  state: RunStyleState,
  paragraphOptions: ParagraphOptions,
  currentRunsRef: { value: TextRun[] },
) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = decodeEntities(node.textContent || '');
    if (text) currentRunsRef.value.push(textRun(text, state));
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as Element;
  const tag = element.tagName.toLowerCase();

  const flushParagraph = () => {
    if (!currentRunsRef.value.length) return;
    out.push(new Paragraph({
      alignment: paragraphOptions.alignment ?? AlignmentType.JUSTIFIED,
      spacing: { line: BODY_SPACING_LINE, before: paragraphOptions.spacingBefore ?? 0, after: paragraphOptions.spacingAfter ?? BODY_SPACING_AFTER },
      indent: paragraphOptions.firstLine ? { firstLine: paragraphOptions.firstLine } : undefined,
      bullet: paragraphOptions.bullet,
      numbering: paragraphOptions.numbering,
      children: currentRunsRef.value,
    }));
    currentRunsRef.value = [];
  };

  if (tag === 'br') {
    flushParagraph();
    return;
  }

  if (tag === 'img') {
    flushParagraph();
    const paragraph = await imageParagraphFromElement(element, imgCache);
    if (paragraph) out.push(paragraph);
    return;
  }

  const nextState = extendRunState(element, state);
  for (const child of Array.from(element.childNodes)) {
    await appendInlineContent(child, out, imgCache, nextState, paragraphOptions, currentRunsRef);
  }
}

async function richBlockToParagraphs(
  element: Element,
  out: Paragraph[],
  imgCache: Map<string, ExportImageInfo | null>,
  options?: Partial<ParagraphOptions>,
) {
  const currentRunsRef = { value: [] as TextRun[] };
  const paragraphOptions: ParagraphOptions = {
    alignment: options?.alignment ?? extractAlignment(element) ?? AlignmentType.JUSTIFIED,
    spacingBefore: options?.spacingBefore ?? 0,
    spacingAfter: options?.spacingAfter ?? BODY_SPACING_AFTER,
    firstLine: options?.firstLine,
    bullet: options?.bullet,
    numbering: options?.numbering,
  };

  for (const child of Array.from(element.childNodes)) {
    await appendInlineContent(child, out, imgCache, { fontFamily: 'Georgia', fontSizePx: DEFAULT_FONT_PX }, paragraphOptions, currentRunsRef);
  }

  if (currentRunsRef.value.length) {
    out.push(new Paragraph({
      alignment: paragraphOptions.alignment ?? AlignmentType.JUSTIFIED,
      spacing: { line: BODY_SPACING_LINE, before: paragraphOptions.spacingBefore ?? 0, after: paragraphOptions.spacingAfter ?? BODY_SPACING_AFTER },
      indent: paragraphOptions.firstLine ? { firstLine: paragraphOptions.firstLine } : undefined,
      bullet: paragraphOptions.bullet,
      numbering: paragraphOptions.numbering,
      children: currentRunsRef.value,
    }));
  }
}

async function htmlToParagraphs(html: string): Promise<Paragraph[]> {
  const preparedHtml = await inlineExportImagesInHtml(stripMetaScript(html));
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(`<div id="docia-root">${preparedHtml}</div>`, 'text/html');
  const root = documentNode.getElementById('docia-root');
  const out: Paragraph[] = [];

  if (!root) return [new Paragraph({ children: [new TextRun('')] })];

  const imageSources = Array.from(root.querySelectorAll('img'))
    .map((img) => img.getAttribute('src'))
    .filter((src): src is string => Boolean(src));

  const imgCache = new Map<string, ExportImageInfo | null>();
  await Promise.all(
    Array.from(new Set(imageSources)).map(async (src) => {
      imgCache.set(src, await resolveImageForExport(src));
    }),
  );

  const processNode = async (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = decodeEntities(node.textContent || '').trim();
      if (!text) return;
      out.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: BODY_SPACING_LINE, after: BODY_SPACING_AFTER },
        indent: { firstLine: INDENT_FIRST_LINE_DXA },
        children: [textRun(text, { fontFamily: 'Georgia', fontSizePx: DEFAULT_FONT_PX })],
      }));
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    const tag = element.tagName.toLowerCase();

    if (tag === 'img') {
      const paragraph = await imageParagraphFromElement(element, imgCache);
      if (paragraph) out.push(paragraph);
      return;
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const headingAlignment = extractAlignment(element) ?? AlignmentType.LEFT;
      const headingText = decodeEntities(element.textContent || '').trim();
      if (!headingText) return;
      const heading = tag === 'h1' ? HeadingLevel.HEADING_1 : tag === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      const fontSizePx = tag === 'h1' ? 21 : tag === 'h2' ? 19 : 17;
      out.push(new Paragraph({
        heading,
        alignment: headingAlignment,
        spacing: { before: 200, after: 120 },
        children: [new TextRun({ text: headingText, bold: true, font: 'Georgia', size: pxToHalfPoints(fontSizePx) })],
      }));
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === 'li');
      for (const item of items) {
        await richBlockToParagraphs(item, out, imgCache, {
          alignment: extractAlignment(item) ?? AlignmentType.LEFT,
          firstLine: 0,
          bullet: tag === 'ul' ? { level: 0 } : undefined,
          numbering: tag === 'ol' ? { reference: 'docia-numbers', level: 0 } : undefined,
        });
      }
      return;
    }

    if (tag === 'p' || tag === 'div' || tag === 'blockquote') {
      await richBlockToParagraphs(element, out, imgCache, {
        alignment: extractAlignment(element) ?? AlignmentType.JUSTIFIED,
        firstLine: tag === 'p' ? INDENT_FIRST_LINE_DXA : 0,
      });
      return;
    }

    for (const child of Array.from(element.childNodes)) {
      await processNode(child);
    }
  };

  for (const child of Array.from(root.childNodes)) {
    await processNode(child);
  }

  return out.length ? out : [new Paragraph({ children: [new TextRun('')] })];
}

export async function generateAIDocumentDocx(input: DocxExportInput): Promise<Blob> {
  const {
    title,
    bodyHtml,
    logoUrl,
    headerText,
    footerText,
    professionalName,
    professionalRegistration,
    cityLine,
    stampUrl,
    extraSignatures = [],
  } = input;

  const bodyParagraphs = await htmlToParagraphs(bodyHtml);
  const logoInfo = logoUrl ? await resolveImageForExport(logoUrl) : null;
  const stampInfo = stampUrl ? await resolveImageForExport(stampUrl) : null;

  const headerChildren: Paragraph[] = [];
  if (logoInfo) {
    const size = sizeForImage(logoInfo, Math.min(280, logoInfo.width), null, 280);
    headerChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new ImageRun({ type: logoInfo.type, data: logoInfo.data, transformation: size })],
    }));
  }
  if (headerText) {
    for (const line of headerText.split('\n').filter(Boolean)) {
      headerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [new TextRun({ text: line, font: 'Georgia', size: 20, color: '333333' })],
      }));
    }
  }
  if (headerChildren.length) {
    headerChildren.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 4 } },
      spacing: { after: 240 },
      children: [new TextRun({ text: '' })],
    }));
  }

  const footerChildren: Paragraph[] = [];
  if (footerText) {
    footerChildren.push(new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 4 } },
      spacing: { before: 120 },
      children: [new TextRun({ text: '' })],
    }));
    for (const line of footerText.split('\n').filter(Boolean)) {
      footerChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [new TextRun({ text: line, font: 'Georgia', size: 18, color: '555555' })],
      }));
    }
  }

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, font: 'Georgia', size: 32 })],
    }),
    ...bodyParagraphs,
  ];

  if (cityLine) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 360, after: 0 },
      children: [new TextRun({ text: cityLine, font: 'Georgia', size: 24 })],
    }));
  }

  if (stampInfo) {
    const size = sizeForImage(stampInfo, Math.min(180, stampInfo.width), null, 180);
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 40 },
      children: [new ImageRun({ type: stampInfo.type, data: stampInfo.data, transformation: size })],
    }));
  }

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: stampInfo ? 0 : 720, after: 0 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
    children: [new TextRun({ text: professionalName || '', bold: true, font: 'Georgia', size: 24 })],
  }));

  if (professionalRegistration) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: professionalRegistration, font: 'Georgia', size: 22, color: '444444' })],
    }));
  }

  for (const signature of extraSignatures) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 720, after: 0 },
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 4 } },
      children: [new TextRun({ text: signature.label, font: 'Georgia', size: 22 })],
    }));
  }

  const doc = new Document({
    creator: professionalName || 'CliniPro',
    title,
    numbering: {
      config: [{
        reference: 'docia-numbers',
        levels: [{
          level: 0,
          format: LevelFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: {
      default: { document: { run: { font: 'Georgia', size: DEFAULT_TEXT_SIZE } } },
    },
    sections: [{
      properties: {
        page: {
          size: {
            width: AI_DOC_LAYOUT.pageWidthDxa,
            height: AI_DOC_LAYOUT.pageHeightDxa,
            orientation: PageOrientation.PORTRAIT,
          },
          margin: {
            top: AI_DOC_LAYOUT.pageMarginDxa,
            right: AI_DOC_LAYOUT.pageMarginDxa,
            bottom: AI_DOC_LAYOUT.pageMarginDxa,
            left: AI_DOC_LAYOUT.pageMarginDxa,
          },
        },
      },
      headers: headerChildren.length ? { default: new Header({ children: headerChildren }) } : undefined,
      footers: footerChildren.length ? { default: new Footer({ children: footerChildren }) } : undefined,
      children,
    }],
  });

  return Packer.toBlob(doc);
}
