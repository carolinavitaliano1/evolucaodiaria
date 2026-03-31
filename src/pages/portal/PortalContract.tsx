import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';
import { Loader2, FileText, CheckCircle2, PenLine, Download, User, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SignaturePad, type SignaturePadRef } from '@/components/ui/signature-pad';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Contract {
  id: string;
  template_html: string;
  signed_at: string | null;
  signature_data: string | null;
  therapist_signature_data: string | null;
  therapist_signed_at: string | null;
  status: string;
}

interface PatientExtra {
  cpf: string | null;
  responsible_name: string | null;
  responsible_cpf: string | null;
  is_minor: boolean;
}

async function generateContractPDF(contract: Contract, signerName: string, signerCpf: string | null) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'width:794px;padding:48px;background:white;font-family:sans-serif;font-size:13px;color:#111;';

  const therapistSigBlock = contract.therapist_signature_data
    ? `<div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="font-size:11px;color:#555;margin-bottom:4px;">Assinatura do terapeuta:</p>
        <img src="${contract.therapist_signature_data}" style="max-height:70px;max-width:260px;border:1px solid #e5e7eb;border-radius:4px;" alt="Assinatura do terapeuta" />
        ${contract.therapist_signed_at ? `<p style="font-size:10px;color:#888;margin-top:6px;">${format(new Date(contract.therapist_signed_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>` : ''}
      </div>` : '';

  wrapper.innerHTML = `
    <div style="margin-bottom:32px;">
      ${contract.template_html}
    </div>
    ${therapistSigBlock}
    <div style="margin-top:32px;border-top:1px solid #ccc;padding-top:24px;">
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
  const [patientExtra, setPatientExtra] = useState<PatientExtra | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [signatureMode, setSignatureMode] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const signaturePadRef = useRef<SignaturePadRef>(null);

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
        .from('patients')
        .select('cpf, responsible_name, responsible_cpf, is_minor')
        .eq('id', portalAccount.patient_id)
        .single(),
    ]).then(([{ data: c }, { data: pData }]) => {
      setContract(c as Contract | null);
      setPatientExtra(pData as PatientExtra | null);
      setLoading(false);
    });
  }, [portalAccount]);

  const isMinor = patientExtra?.is_minor ?? false;
  const signerName = isMinor
    ? (patientExtra?.responsible_name || patient?.name || 'Responsável')
    : (patient?.name || 'Paciente');
  const signerCpf = isMinor
    ? (patientExtra?.responsible_cpf || null)
    : (patientExtra?.cpf || null);

  const handleSign = async () => {
    if (!contract) return;
    // Save from pad if not yet saved
    let finalSig = signatureData;
    if (!finalSig && signaturePadRef.current) {
      finalSig = signaturePadRef.current.save();
    }
    if (!finalSig) {
      toast.error('Por favor, assine antes de confirmar.');
      return;
    }
    setSigning(true);
    try {
      const { error } = await supabase
        .from('patient_contracts')
        .update({
          signature_data: finalSig,
          signed_at: new Date().toISOString(),
          status: 'signed',
        })
        .eq('id', contract.id);
      if (error) throw error;
      toast.success('Contrato assinado com sucesso! ✅');
      const updated = { ...contract, status: 'signed', signed_at: new Date().toISOString(), signature_data: finalSig };
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
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setDownloading(false);
    }
  };

  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return cpf;
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
              <div className="flex items-center gap-2 bg-warning/10 text-warning border border-warning/20 rounded-xl px-4 py-3 text-sm">
                <PenLine className="w-4 h-4 flex-shrink-0" />
                <span>Aguardando assinatura</span>
              </div>
            )}

            {/* Signer info card */}
            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {isMinor ? <ShieldCheck className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
                <span>{isMinor ? 'Responsável Legal' : 'Assinante'}</span>
              </div>
              <div className="pl-6 space-y-1">
                <p className="text-sm text-foreground font-semibold">{signerName}</p>
                {signerCpf && (
                  <p className="text-xs text-muted-foreground">CPF: {formatCpf(signerCpf)}</p>
                )}
                {isMinor && patient?.name && (
                  <p className="text-xs text-muted-foreground">Paciente: {patient.name}</p>
                )}
              </div>
            </div>

            {/* Contract content */}
            <div className="bg-card rounded-2xl border border-border p-4 overflow-auto max-h-[50vh]">
              <div
                className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: contract.template_html }}
              />
            </div>

            {/* Signature section — signed */}
            {contract.status === 'signed' && (
              <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
                {contract.therapist_signature_data && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Assinatura do terapeuta:</p>
                    <img src={contract.therapist_signature_data} alt="Assinatura do terapeuta"
                      className="max-h-16 border border-border rounded" />
                    {contract.therapist_signed_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(contract.therapist_signed_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                )}
                {contract.signature_data && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">
                      Assinatura de <strong>{signerName}</strong>:
                    </p>
                    {signerCpf && <p className="text-xs text-muted-foreground">CPF: {formatCpf(signerCpf)}</p>}
                    <img src={contract.signature_data} alt="Assinatura" className="max-h-16 border border-border rounded" />
                    {contract.signed_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(contract.signed_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                )}
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

            {/* Signature section — pending */}
            {contract.status === 'sent' && (
              signatureMode ? (
                <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
                  <p className="text-sm font-medium text-foreground">
                    {isMinor ? `Assinatura do responsável (${signerName}):` : 'Assine abaixo:'}
                  </p>
                  <SignaturePad
                    ref={signaturePadRef}
                    value={signatureData}
                    onChange={setSignatureData}
                    hideButtons
                  />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        signaturePadRef.current?.clear();
                        setSignatureMode(false);
                        setSignatureData('');
                      }}
                      className="w-full sm:flex-1 gap-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => signaturePadRef.current?.clear()}
                      className="w-full sm:flex-1 gap-1"
                    >
                      Limpar assinatura
                    </Button>
                    <Button
                      onClick={handleSign}
                      disabled={signing}
                      className="w-full sm:flex-1 gap-1"
                    >
                      {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
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
