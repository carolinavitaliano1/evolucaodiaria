import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';

interface ExportInput {
  titulo: string;
  paciente: string;
  audience: 'familiar' | 'escolar';
  content: string;
}

export async function exportOrientacoesDocx({ titulo, paciente, audience, content }: ExportInput) {
  const audienceLabel = audience === 'familiar' ? 'Família' : 'Escola';
  const today = new Date().toLocaleDateString('pt-BR');

  const paragraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: titulo, bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Orientações para a ${audienceLabel} — ${today}`, italics: true, size: 22 })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: `Paciente: ${paciente}`, bold: true, size: 24 })],
    }),
    ...content.split(/\n+/).map((line) =>
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: line.trim(), size: 24 })],
      }),
    ),
  ];

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orientacoes-${audience}-${paciente.replace(/\s+/g, '_')}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}