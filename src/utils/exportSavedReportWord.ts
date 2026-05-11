export interface SavedReportWordOptions {
  title: string;
  content: string; // HTML
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
}

export async function exportSavedReportAsWord(opts: SavedReportWordOptions) {
  const { title, content, clinicName, clinicAddress, clinicPhone } = opts;
  const dateStr = new Date().toLocaleDateString('pt-BR');
  const headerHtml = clinicName
    ? `<h2 style="text-align:center;">${clinicName}</h2>${clinicAddress ? `<p style="text-align:center;">${clinicAddress}</p>` : ''}${clinicPhone ? `<p style="text-align:center;">Tel: ${clinicPhone}</p>` : ''}<hr/>`
    : '';
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; margin: 40px;">${headerHtml}<h1 style="text-align:center;">${title}</h1><p style="text-align:right; color:#666;">${dateStr}</p><hr/>${content}</body></html>`;
  const { asBlob } = await import('html-docx-js-typescript');
  const blob = await asBlob(fullHtml, { orientation: 'portrait', margins: { top: 720, bottom: 720, left: 1080, right: 1080 } });
  const url = URL.createObjectURL(blob as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
