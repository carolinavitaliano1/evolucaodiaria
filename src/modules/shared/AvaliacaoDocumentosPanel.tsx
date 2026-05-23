import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Upload, Loader2, Trash2, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DocItem {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
}

interface Props {
  patientId: string;
  /** Tipo de módulo, usado como discriminador no parent_type */
  kind: 'psico' | 'psicom';
}

export function AvaliacaoDocumentosPanel({ patientId, kind }: Props) {
  const parentType = kind === 'psico' ? 'psico_avaliacoes_tab' : 'psicom_avaliacoes_tab';
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('attachments')
      .select('id, name, file_path, file_type, file_size, created_at')
      .eq('parent_type', parentType)
      .eq('parent_id', patientId)
      .order('created_at', { ascending: false });
    if (error) { toast.error('Erro ao carregar documentos'); return; }
    setDocs((data || []) as DocItem[]);
  }, [patientId, parentType]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error('Não autenticado');

      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'bin';
        const path = `${uid}/${parentType}/${patientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('attachments').upload(path, file);
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from('attachments').insert({
          user_id: uid,
          parent_id: patientId,
          parent_type: parentType,
          name: file.name,
          file_path: path,
          file_type: file.type || ext,
          file_size: file.size,
        });
        if (insErr) throw insErr;
      }
      toast.success(files.length === 1 ? 'Documento anexado' : `${files.length} documentos anexados`);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro no upload');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function abrir(d: DocItem) {
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(d.file_path, 300);
    if (error || !data?.signedUrl) {
      const { data: pub } = supabase.storage.from('attachments').getPublicUrl(d.file_path);
      window.open(pub.publicUrl, '_blank');
      return;
    }
    window.open(data.signedUrl, '_blank');
  }

  async function remover(d: DocItem) {
    if (!confirm(`Excluir "${d.name}"?`)) return;
    await supabase.storage.from('attachments').remove([d.file_path]);
    const { error } = await supabase.from('attachments').delete().eq('id', d.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Documento excluído');
    load();
  }

  function fmtSize(b: number | null) {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Documentos anexados</h3>
            <p className="text-[11px] text-muted-foreground">
              Laudos, exames, relatórios externos e protocolos relacionados às avaliações.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Anexar documentos
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {docs.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground">
          Nenhum documento anexado ainda. Use o botão acima para enviar PDFs, imagens ou Word.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground truncate">{d.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(d.created_at).toLocaleDateString('pt-BR')} · {fmtSize(d.file_size)}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrir(d)} title="Abrir / baixar">
                <Download className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remover(d)} title="Excluir">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}