import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardCheck, Copy, Download, ScanLine, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { PROTOCOLO_RASTREIO } from './presets';
import { DigitalizarAvaliacaoDialog } from '@/modules/shared/DigitalizarAvaliacaoDialog';

interface Props { patientId: string; onSaved?: () => void; }

const AREA_LABEL: Record<string, string> = {
  leitura: 'Leitura',
  escrita: 'Escrita',
  matematica: 'Matemática',
  atencao: 'Atenção',
  memoria: 'Memória',
  linguagem: 'Linguagem',
  comportamento: 'Comportamento',
};

export function ProtocoloRastreioPanel({ patientId, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [digit, setDigit] = useState(false);
  const [marcados, setMarcados] = useState<Record<number, boolean>>({});

  const grupos = useMemo(() => {
    const map = new Map<string, { idx: number; pergunta: string }[]>();
    PROTOCOLO_RASTREIO.forEach((it, idx) => {
      if (!map.has(it.area)) map.set(it.area, []);
      map.get(it.area)!.push({ idx, pergunta: it.pergunta });
    });
    return Array.from(map.entries());
  }, []);

  function copiar() {
    const linhas = ['Protocolo de rastreio — dificuldades de aprendizagem', ''];
    grupos.forEach(([area, itens]) => {
      linhas.push(`# ${AREA_LABEL[area]?.toUpperCase() || area.toUpperCase()}`);
      itens.forEach((it) => linhas.push(`(${marcados[it.idx] ? 'X' : ' '}) ${it.pergunta}`));
      linhas.push('');
    });
    navigator.clipboard.writeText(linhas.join('\n'));
    toast.success('Checklist copiado');
  }

  function baixarWord() {
    const linhasHtml = grupos.map(([area, itens]) => `
      <h2 style="font-family:Arial;color:#5b21b6;font-size:13pt;margin:14pt 0 4pt 0;">${AREA_LABEL[area] || area}</h2>
      <table style="border-collapse:collapse;width:100%;font-family:Arial;font-size:11pt;">
        ${itens.map((it) => `
          <tr>
            <td style="width:24px;border:1px solid #999;text-align:center;padding:4px;">${marcados[it.idx] ? '☑' : '☐'}</td>
            <td style="border:1px solid #999;padding:4px;">${escapeHtml(it.pergunta)}</td>
          </tr>`).join('')}
      </table>
    `).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8" /><title>Protocolo de Rastreio</title></head>
        <body style="font-family:Arial;font-size:11pt;">
          <h1 style="font-family:Arial;color:#5b21b6;font-size:16pt;">Protocolo de Rastreio — Dificuldades de Aprendizagem</h1>
          <p style="color:#555;">Paciente: ____________________________ &nbsp;&nbsp; Data: ____/____/______</p>
          <p style="color:#555;">Aplicador: __________________________________________________________</p>
          ${linhasHtml}
          <h2 style="font-family:Arial;color:#5b21b6;font-size:13pt;margin-top:18pt;">Observações</h2>
          <p style="border:1px solid #999;min-height:80px;padding:8px;">&nbsp;</p>
        </body>
      </html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocolo-rastreio-${new Date().toISOString().slice(0, 10)}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Modelo baixado');
  }

  const marcadosCount = Object.values(marcados).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30 hover:bg-muted/50 transition"
      >
        <div className="flex items-center gap-2 text-left">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Protocolo de rastreio</h3>
            <p className="text-[11px] text-muted-foreground">
              {PROTOCOLO_RASTREIO.length} itens organizados por área · {marcadosCount} marcado{marcadosCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={copiar} className="gap-1.5 h-8 text-xs">
              <Copy className="w-3.5 h-3.5" /> Copiar checklist
            </Button>
            <Button size="sm" variant="outline" onClick={baixarWord} className="gap-1.5 h-8 text-xs">
              <Download className="w-3.5 h-3.5" /> Baixar em Word
            </Button>
            <Button size="sm" onClick={() => setDigit(true)} className="gap-1.5 h-8 text-xs">
              <ScanLine className="w-3.5 h-3.5" /> Anexar modelo preenchido (digitalizar)
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {grupos.map(([area, itens]) => (
              <div key={area} className="rounded-lg border border-border p-3 space-y-2 bg-background/50">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wide">
                  {AREA_LABEL[area] || area}
                </h4>
                <ul className="space-y-1.5">
                  {itens.map((it) => (
                    <li key={it.idx} className="flex items-start gap-2">
                      <Checkbox
                        id={`rastreio-${it.idx}`}
                        checked={!!marcados[it.idx]}
                        onCheckedChange={(v) => setMarcados((m) => ({ ...m, [it.idx]: !!v }))}
                        className="mt-0.5"
                      />
                      <label htmlFor={`rastreio-${it.idx}`} className="text-xs leading-relaxed cursor-pointer text-foreground">
                        {it.pergunta}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Use o botão <b>Baixar em Word</b> para imprimir/preencher e depois <b>Anexar modelo preenchido</b> para a IA gerar um relatório estruturado.
          </p>
        </div>
      )}

      <DigitalizarAvaliacaoDialog
        open={digit}
        onOpenChange={setDigit}
        patientId={patientId}
        kind="psico"
        onSaved={() => { onSaved?.(); }}
      />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}