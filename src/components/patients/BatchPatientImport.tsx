import { useState, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface ClinicOption {
  id: string;
  name: string;
}

interface BatchPatientImportProps {
  open: boolean;
  onClose: () => void;
  clinics: ClinicOption[];
  defaultClinicId?: string;
  onSuccess: () => void;
}

interface RawRow {
  nome?: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
  cpf?: string;
  [key: string]: string | undefined;
}

interface ParsedPatient {
  name: string;
  email: string | null;
  phone: string | null;
  birthdate: string;
  cpf: string | null;
  valid: boolean;
  error?: string;
}

function normalizeDateStr(raw: string | undefined): string {
  if (!raw?.trim()) return '';
  const trimmed = raw.trim();

  // dd/mm/yyyy or dd-mm-yyyy
  const brMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // yyyy-mm-dd already ISO
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  return '';
}

function downloadTemplate() {
  const header = 'nome,email,telefone,data_nascimento,cpf';
  const example = 'João Silva,joao@email.com,(11) 99999-0000,15/03/1990,123.456.789-00';
  const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo_importacao_pacientes.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BatchPatientImport({ open, onClose, clinics, defaultClinicId, onSuccess }: BatchPatientImportProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedClinicId, setSelectedClinicId] = useState(defaultClinicId || '');
  const [parsed, setParsed] = useState<ParsedPatient[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  const selectedClinic = clinics.find(c => c.id === selectedClinicId);

  function reset() {
    setParsed([]);
    setFileName('');
    setDone(false);
    setResultCount(0);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo .csv');
      return;
    }
    setFileName(file.name);
    setDone(false);

    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_'),
      complete: (results) => {
        const rows: ParsedPatient[] = results.data.map((row) => {
          const name = (row.nome || '').trim();
          const email = (row.email || '').trim() || null;
          const phone = (row.telefone || '').trim() || null;
          const birthRaw = normalizeDateStr(row.data_nascimento);
          const cpf = (row.cpf || '').trim() || null;

          if (!name) {
            return { name: '', email, phone, birthdate: '', cpf, valid: false, error: 'Nome obrigatório' };
          }
          if (!birthRaw) {
            return { name, email, phone, birthdate: '', cpf, valid: false, error: 'Data de nascimento inválida' };
          }

          return { name, email, phone, birthdate: birthRaw, cpf, valid: true };
        });

        setParsed(rows);

        const validCount = rows.filter(r => r.valid).length;
        const invalidCount = rows.length - validCount;
        if (invalidCount > 0) {
          toast.warning(`${invalidCount} linha(s) com problemas encontradas`);
        }
        if (validCount === 0 && rows.length > 0) {
          toast.error('Nenhuma linha válida encontrada no CSV');
        }
      },
      error: () => {
        toast.error('Erro ao ler o arquivo CSV');
      },
    });
  }

  async function handleImport() {
    if (!user || !selectedClinicId) return;
    const valid = parsed.filter(p => p.valid);
    if (valid.length === 0) return;

    setImporting(true);
    try {
      const rows = valid.map(p => ({
        name: p.name,
        email: p.email,
        phone: p.phone,
        birthdate: p.birthdate,
        cpf: p.cpf,
        clinic_id: selectedClinicId,
        user_id: user.id,
        status: 'ativo',
      }));

      const { error, data } = await supabase.from('patients').insert(rows).select('id');

      if (error) {
        toast.error(`Erro na importação: ${error.message}`);
        return;
      }

      const count = data?.length ?? 0;
      setResultCount(count);
      setDone(true);
      toast.success(`${count} paciente(s) importado(s) com sucesso!`);
      onSuccess();
    } catch (err: any) {
      toast.error('Erro inesperado na importação');
    } finally {
      setImporting(false);
    }
  }

  const validCount = parsed.filter(p => p.valid).length;
  const invalidCount = parsed.length - validCount;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg w-full p-0 gap-0 flex flex-col" style={{ maxHeight: '88vh' }}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Importar Pacientes via CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Clinic info */}
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Os pacientes serão importados para: <span className="font-medium text-foreground">{clinicName}</span>
          </div>

          {/* Download template */}
          <Button variant="outline" size="sm" className="gap-2 text-xs w-full" onClick={downloadTemplate}>
            <Download className="w-3.5 h-3.5" />
            Descarregar Modelo CSV
          </Button>

          {/* Upload area */}
          {!done && (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                fileName ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-accent/30'
              )}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              {fileName ? (
                <p className="text-sm font-medium text-foreground">{fileName}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Clique ou arraste um arquivo .csv</p>
                  <p className="text-xs text-muted-foreground mt-1">Colunas esperadas: nome, email, telefone, data_nascimento, cpf</p>
                </>
              )}
            </div>
          )}

          {/* Preview */}
          {parsed.length > 0 && !done && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Prévia ({parsed.length} linha{parsed.length !== 1 ? 's' : ''})
                </p>
                <div className="flex gap-2 text-xs">
                  {validCount > 0 && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" /> {validCount} válido{validCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="w-3 h-3" /> {invalidCount} com erro
                    </span>
                  )}
                </div>
              </div>

              <ScrollArea className="h-48 border border-border rounded-lg">
                <div className="divide-y divide-border">
                  {parsed.map((p, i) => (
                    <div key={i} className={cn('px-3 py-2 text-xs', !p.valid && 'bg-destructive/5')}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{p.name || '(sem nome)'}</span>
                        {!p.valid && (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {p.error}
                          </span>
                        )}
                        {p.valid && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        {[p.email, p.phone, p.birthdate, p.cpf].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Done */}
          {done && (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
              <p className="text-lg font-semibold text-foreground">{resultCount} paciente(s) importado(s)!</p>
              <p className="text-sm text-muted-foreground mt-1">Eles já estão disponíveis na sua lista de pacientes.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0 flex gap-2 justify-end">
          {done ? (
            <Button size="sm" onClick={() => { reset(); onClose(); }}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
              <Button
                size="sm"
                className="gap-2"
                disabled={validCount === 0 || importing}
                onClick={handleImport}
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Importar {validCount > 0 ? `${validCount} paciente${validCount !== 1 ? 's' : ''}` : ''}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
