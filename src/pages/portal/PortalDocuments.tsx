import { useState, useEffect, useRef } from 'react';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, FileUp, Download, Trash2, File, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface PortalDocument {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  description: string | null;
  uploaded_by_type: string;
  created_at: string;
  portal_account_id: string;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortalDocuments() {
  const { portalAccount } = usePortal();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = async () => {
    if (!portalAccount) return;
    const { data } = await supabase
      .from('portal_documents')
      .select('*')
      .eq('portal_account_id', portalAccount.id)
      .order('created_at', { ascending: false });
    setDocuments((data || []) as PortalDocument[]);
    setLoading(false);
  };

  useEffect(() => {
    if (portalAccount) loadDocuments();
    else setLoading(false);
  }, [portalAccount]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !portalAccount || !user) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 20MB.'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      // File path: therapist_user_id/portal_account_id/timestamp.ext
      const filePath = `${portalAccount.therapist_user_id}/${portalAccount.id}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from('portal-documents')
        .upload(filePath, file);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from('portal_documents').insert({
        patient_id: portalAccount.patient_id,
        therapist_user_id: portalAccount.therapist_user_id,
        portal_account_id: portalAccount.id,
        name: file.name,
        file_path: filePath,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        description: description.trim() || null,
        uploaded_by_type: 'portal',
        uploaded_by_user_id: user.id,
      });
      if (dbError) throw dbError;

      toast.success('Documento enviado ao terapeuta! ✅');
      setDescription('');
      await loadDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar documento');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (doc: PortalDocument) => {
    const { data } = await supabase.storage
      .from('portal-documents')
      .createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast.error('Erro ao gerar link');
  };

  const handleDelete = async (doc: PortalDocument) => {
    if (doc.uploaded_by_type !== 'portal') {
      toast.error('Apenas documentos que você enviou podem ser removidos.');
      return;
    }
    await supabase.storage.from('portal-documents').remove([doc.file_path]);
    await supabase.from('portal_documents').delete().eq('id', doc.id);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    toast.success('Documento removido');
  };

  if (loading) return (
    <PortalLayout>
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    </PortalLayout>
  );

  const therapistDocs = documents.filter(d => d.uploaded_by_type === 'therapist');
  const myDocs = documents.filter(d => d.uploaded_by_type === 'portal');

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Documentos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Documentos e relatórios compartilhados pelo terapeuta e enviados por você</p>
        </div>

        {/* Upload section */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileUp className="w-4 h-4 text-primary" /> Enviar documento ao terapeuta
          </h2>
          <p className="text-xs text-muted-foreground">Envie comprovantes, laudos ou outros documentos. Apenas seu terapeuta verá esses arquivos.</p>
          <Input
            placeholder="Descrição (opcional, ex: Laudo médico)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="text-sm"
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xls,.xlsx"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full gap-2"
            variant="outline"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {uploading ? 'Enviando...' : 'Selecionar arquivo'}
          </Button>
        </div>

        {/* Documents from therapist */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-primary" /> Do terapeuta
          </h2>
          {therapistDocs.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-6 text-center">
              <FolderOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum documento enviado pelo terapeuta ainda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {therapistDocs.map(doc => (
                <div key={doc.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <File className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {doc.description && <p className="text-xs text-muted-foreground truncate">{doc.description}</p>}
                      <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                        {format(new Date(doc.created_at), "d/MM/yyyy", { locale: ptBR })}
                        {doc.file_size && ` • ${formatBytes(doc.file_size)}`}
                      </span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => handleDownload(doc)}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents uploaded by patient */}
        {myDocs.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileUp className="w-4 h-4 text-muted-foreground" /> Enviados por mim
            </h2>
            <div className="space-y-2">
              {myDocs.map(doc => (
                <div key={doc.id} className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <File className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {doc.description && <p className="text-xs text-muted-foreground truncate">{doc.description}</p>}
                      <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                        {format(new Date(doc.created_at), "d/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(doc)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
