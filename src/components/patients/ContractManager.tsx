import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, FilePenLine, CheckCircle2, Send, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Contract {
  id: string;
  template_html: string;
  signed_at: string | null;
  signature_data: string | null;
  status: string;
  created_at: string;
}

interface ContractManagerProps {
  patientId: string;
  patientName: string;
}

const DEFAULT_TEMPLATE = `<h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS TERAPÊUTICOS</h2>

<p>Entre as partes abaixo identificadas:</p>

<p><strong>TERAPEUTA:</strong> [Nome do Terapeuta]<br/>
Registro: [CRP/CRP número]</p>

<p><strong>PACIENTE/RESPONSÁVEL:</strong> {{patient_name}}</p>

<h3>CLÁUSULA 1 — DO OBJETO</h3>
<p>O presente contrato tem por objeto a prestação de serviços de psicoterapia/terapia, conforme acordado entre as partes.</p>

<h3>CLÁUSULA 2 — DAS SESSÕES</h3>
<p>As sessões terão duração de 50 (cinquenta) minutos, realizadas semanalmente, em dia e horário a ser definido.</p>

<h3>CLÁUSULA 3 — DOS HONORÁRIOS</h3>
<p>O valor por sessão será definido em acordo entre as partes, com pagamento até o dia [dia] de cada mês.</p>

<h3>CLÁUSULA 4 — DO SIGILO</h3>
<p>O terapeuta compromete-se a manter sigilo sobre as informações obtidas durante as sessões, respeitando o Código de Ética Profissional.</p>

<h3>CLÁUSULA 5 — DO CANCELAMENTO</h3>
<p>Cancelamentos devem ser informados com mínimo de 24 horas de antecedência. Sessões não canceladas dentro do prazo serão cobradas integralmente.</p>

<p style="margin-top: 40px;">Ao assinar este contrato, o paciente declara ter lido e concordado com todos os termos acima.</p>`;

export function ContractManager({ patientId, patientName }: ContractManagerProps) {
  const { user } = useAuth();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateHtml, setTemplateHtml] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadContract = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('patient_contracts')
      .select('*')
      .eq('patient_id', patientId)
      .maybeSingle();
    setContract(data as Contract | null);
    setTemplateHtml(data?.template_html || DEFAULT_TEMPLATE);
    setLoading(false);
  };

  useEffect(() => { loadContract(); }, [patientId]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        patient_id: patientId,
        therapist_user_id: user.id,
        template_html: templateHtml.replace(/\{\{patient_name\}\}/g, patientName),
        status: contract?.status || 'pending',
        updated_at: new Date().toISOString(),
      };
      if (contract) {
        const { error } = await supabase.from('patient_contracts').update(payload).eq('id', contract.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('patient_contracts').insert(payload);
        if (error) throw error;
      }
      toast.success('Contrato salvo!');
      setEditMode(false);
      await loadContract();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar contrato');
    } finally {
      setSaving(false);
    }
  };

  const handleSendToPatient = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      await supabase.from('patient_contracts').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', contract.id);
      toast.success('Contrato enviado ao paciente! O paciente pode assinar pelo portal.');
      await loadContract();
    } catch (err: any) {
      toast.error(err.message || 'Erro');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const previewHtml = templateHtml.replace(/\{\{patient_name\}\}/g, patientName);

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <FilePenLine className="w-4 h-4 text-primary" />
              Contrato Terapêutico
            </h3>
            {contract ? (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {contract.status === 'signed' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-success/10 text-success border-success/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Assinado em {format(new Date(contract.signed_at!), "d 'de' MMMM", { locale: ptBR })}
                  </span>
                ) : contract.status === 'sent' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-warning/10 text-warning border-warning/20">
                    ⏳ Aguardando assinatura do paciente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                    📝 Rascunho
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Nenhum contrato criado ainda</p>
            )}
          </div>
          <div className="flex gap-2">
            {contract && (
              <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                    <Eye className="w-3 h-3" /> Ver
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Contrato — {patientName}</DialogTitle>
                  </DialogHeader>
                  <div
                    className="prose prose-sm max-w-none text-foreground"
                    dangerouslySetInnerHTML={{ __html: contract.template_html }}
                  />
                  {contract.signature_data && (
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground mb-2">Assinatura do paciente:</p>
                      <img src={contract.signature_data} alt="Assinatura" className="max-h-24 border border-border rounded" />
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            )}
            <Button
              size="sm" variant={editMode ? 'default' : 'outline'}
              onClick={() => setEditMode(!editMode)}
              className="gap-1.5 text-xs h-8"
            >
              <FilePenLine className="w-3 h-3" />
              {editMode ? 'Cancelar' : contract ? 'Editar' : 'Criar contrato'}
            </Button>
          </div>
        </div>
      </div>

      {/* Editor */}
      {editMode && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Use <code className="bg-muted px-1 rounded">{'{{patient_name}}'}</code> para inserir o nome do paciente automaticamente. HTML básico é suportado.
          </p>
          <Textarea
            value={templateHtml}
            onChange={e => setTemplateHtml(e.target.value)}
            className="min-h-[300px] font-mono text-xs resize-none"
            placeholder="Conteúdo do contrato (HTML)..."
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={loadContract}>Resetar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 text-xs">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Send to patient */}
      {contract && contract.status === 'pending' && !editMode && (
        <Button
          onClick={handleSendToPatient}
          disabled={saving}
          className="w-full gap-2 text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar para assinatura do paciente
        </Button>
      )}
    </div>
  );
}
