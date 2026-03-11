import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { Loader2, FileText, CheckCircle2, PenLine, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SignaturePad } from '@/components/ui/signature-pad';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Contract {
  id: string;
  template_html: string;
  signed_at: string | null;
  signature_data: string | null;
  status: string;
}

interface IntakeData {
  responsible_name: string | null;
  responsible_cpf: string | null;
  submitted_at: string | null;
}

async function generateContractPDF(contract: Contract, signerName: string, signerCpf: string | null) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'width:794px;padding:48px;background:white;font-family:sans-serif;font-size:13px;color:#111;';
  wrapper.innerHTML = `
    <div style="margin-bottom:32px;">
      ${contract.template_html}
    </div>
    <div style="margin-top:40px;border-top:1px solid #ccc;padding-top:24px;">
      <p style="font-size:11px;color:#555;margin-bottom:4px;">Assinatura digital${signerName ? ` de ${signerName}` : ''}:</p>
      ${signerCpf ? `<p style="font-size:10px;color:#777;margin-bottom:8px;">CPF: ${signerCpf}</p>` : ''}
      <img src="${contract.signature_data}" style="max-height:80px;max-width:280px;border:1px solid #e5e7eb;border-radius:4px;" alt="Assinatura" />
      <p style="font-size:10px;color:#888;margin-top:8px;">
        Assinado em ${format(new Date(contract.signed_at!), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
      </p>
    </div>
  `;

  document.body.appendChild(wrapper);
  try {
    const canvas = await html2canvas(wrapper, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
    document.body.removeChild(wrapper);

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let yOffset = 0;
    while (yOffset < imgHeight) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -yOffset, imgWidth, imgHeight);
      yOffset += pageHeight;
    }

    pdf.save(`contrato-${signerName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  } catch (e) {
    document.body.removeChild(wrapper);
    throw e;
  }
}

export default function PortalContract() {
  const { portalAccount, patient } = usePortal();
  const [contract, setContract] = useState<Contract | null>(null);
  const [intakeData, setIntakeData] = useState<IntakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [signatureMode, setSignatureMode] = useState(false);
  const [signatureData, setSignatureData] = useState('');

  useEffect(() => {
    if (!portalAccount) return;
    Promise.all([
      supabase
        .from('patient_contracts')
        .select('*')
        .eq('patient_id', portalAccount.patient_id)
        .in('status', ['sent', 'signed'])
        .maybeSingle(),
      supabase
        .from('patient_intake_forms')
        .select('responsible_name, responsible_cpf, submitted_at')
        .eq('patient_id', portalAccount.patient_id)
        .maybeSingle(),
    ]).then(([{ data: c }, { data: intake }]) => {
      setContract(c as Contract | null);
      setIntakeData(intake as IntakeData | null);
      setLoading(false);
    });
  }, [portalAccount]);

  // Determine signer: if minor (has responsible_name), use responsible data
  const isMinor = !!intakeData?.responsible_name;
  const signerName = isMinor ? (intakeData?.responsible_name || patient?.name || 'paciente') : (patient?.name || 'paciente');
  const signerCpf = isMinor ? (intakeData?.responsible_cpf || null) : null;

  const handleSign = async () => {
    if (!contract || !signatureData) return;
    setSigning(true);
    try {
      const { error } = await supabase
        .from('patient_contracts')
        .update({
          signature_data: signatureData,
          signed_at: new Date().toISOString(),
          status: 'signed',
        })
        .eq('id', contract.id);
      if (error) throw error;
      toast.success('Contrato assinado com sucesso! ✅');
      const updated = { ...contract, status: 'signed', signed_at: new Date().toISOString(), signature_data: signatureData };
      setContract(updated);
      setSignatureMode(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao assinar');
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!contract || !contract.signature_data) return;
    setDownloading(true);
    try {
      await generateContractPDF(contract, signerName, signerCpf);
      toast.success('PDF gerado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Contrato</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Contrato terapêutico</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !contract ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-sm text-foreground">Nenhum contrato disponível</p>
            <p className="text-xs text-muted-foreground mt-1">Seu terapeuta ainda não enviou o contrato.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status */}
            {contract.status === 'signed' ? (
              <div className="flex items-center gap-2 bg-success/10 text-success border border-success/20 rounded-xl px-4 py-3 text-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Assinado em {format(new Date(contract.signed_at!), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-warning/10 text-warning border border-warning/20 rounded-xl px-4 py-3 text-sm">
                  <PenLine className="w-4 h-4 flex-shrink-0" />
                  <span>Aguardando assinatura</span>
                </div>
                {isMinor && (
                  <div className="flex items-center gap-2 bg-primary/5 text-primary border border-primary/15 rounded-xl px-4 py-3 text-xs">
                    <span>👤 Menor de idade — assinatura pelo responsável: <strong>{intakeData?.responsible_name}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Contract content */}
            <div className="bg-card rounded-2xl border border-border p-4 overflow-auto max-h-[50vh]">
              <div
                className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: contract.template_html }}
              />
            </div>

            {/* Signature section */}
            {contract.status === 'signed' && contract.signature_data && (
              <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Assinatura de <strong>{signerName}</strong>:</p>
                  {signerCpf && <p className="text-xs text-muted-foreground">CPF: {signerCpf}</p>}
                </div>
                <img src={contract.signature_data} alt="Assinatura" className="max-h-20 border border-border rounded" />
                <Button
                  className="w-full gap-2"
                  variant="outline"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                >
                  {downloading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Download className="w-4 h-4" />
                  }
                  Baixar contrato assinado (PDF)
                </Button>
              </div>
            )}

            {contract.status === 'sent' && (
              signatureMode ? (
                <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    {isMinor ? `Assinatura do responsável (${signerName}):` : 'Assine abaixo:'}
                  </p>
                  <SignaturePad
                    value={signatureData}
                    onChange={setSignatureData}
                    className="w-full h-32 border border-border rounded-xl bg-background"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSignatureMode(false)} className="flex-1 text-xs">
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSign} disabled={!signatureData || signing} className="flex-1 text-xs">
                      {signing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      Confirmar assinatura
                    </Button>
                  </div>
                </div>
              ) : (
                <Button className="w-full gap-2" onClick={() => setSignatureMode(true)}>
                  <PenLine className="w-4 h-4" />
                  {isMinor ? `Assinar como responsável (${signerName})` : 'Assinar contrato'}
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
