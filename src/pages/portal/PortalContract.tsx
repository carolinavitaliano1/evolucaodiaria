import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';
import { Loader2, FileText, CheckCircle2, PenLine, Download, User, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SignaturePad, type SignaturePadRef } from '@/components/ui/signature-pad';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
  created_at: string;
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
    <div style="margin-bottom:32px;">${contract.template_html}</div>
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
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [patientExtra, setPatientExtra] = useState<PatientExtra | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingContractId, setSigningContractId] = useState<string | null>(null);
  const [signatureData, setSignatureData] = useState('');
  const [signing, setSigning] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const signaturePadRef = useRef<SignaturePadRef>(null);

  // Legal validity fields
  const [signerNameInput, setSignerNameInput] = useState('');
  const [signerCpfInput, setSignerCpfInput] = useState('');
  const [signerCityInput, setSignerCityInput] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);

  useEffect(() => {
    if (!portalAccount) return;
    Promise.all([
      supabase
        .from('patient_contracts')
        .select('*')
        .eq('patient_id', portalAccount.patient_id)
        .in('status', ['sent', 'signed'])
        .order('created_at', { ascending: false }),
      supabase
        .from('patients')
        .select('cpf, responsible_name, responsible_cpf, is_minor')
        .eq('id', portalAccount.patient_id)
        .single(),
    ]).then(([{ data: cData }, { data: pData }]) => {
      setContracts((cData || []) as Contract[]);
      setPatientExtra(pData as PatientExtra | null);
      setLoading(false);
      // Auto-expand first pending
      const firstPending = (cData || []).find((c: any) => c.status === 'sent');
      if (firstPending) setExpandedId((firstPending as any).id);
    });
  }, [portalAccount]);

  const isMinor = patientExtra?.is_minor ?? false;
  const signerName = isMinor
    ? (patientExtra?.responsible_name || patient?.name || 'Responsável')
    : (patient?.name || 'Paciente');
  const signerCpf = isMinor
    ? (patientExtra?.responsible_cpf || null)
    : (patientExtra?.cpf || null);

  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length === 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    return cpf;
  };

  const handleSign = async (contract: Contract) => {
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
      await supabase
        .from('patients')
        .update({ contract_start_date: new Date().toISOString().split('T')[0] })
        .eq('id', portalAccount!.patient_id);

      toast.success('Contrato assinado com sucesso! ✅');
      setContracts(prev => prev.map(c =>
        c.id === contract.id
          ? { ...c, status: 'signed', signed_at: new Date().toISOString(), signature_data: finalSig }
          : c
      ));
      setSigningContractId(null);
      setSignatureData('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao assinar');
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadPDF = async (contract: Contract) => {
    if (!contract.signature_data) return;
    setDownloadingId(contract.id);
    try {
      await generateContractPDF(contract, signerName, signerCpf);
      toast.success('PDF gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const pendingContracts = contracts.filter(c => c.status === 'sent');
  const signedContracts = contracts.filter(c => c.status === 'signed');

  return (
    <PortalLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Contratos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Contratos terapêuticos para assinatura</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-sm text-foreground">Nenhum contrato disponível</p>
            <p className="text-xs text-muted-foreground mt-1">Seu terapeuta ainda não enviou contratos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Signer info card */}
            <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {isMinor ? <ShieldCheck className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
                <span>{isMinor ? 'Responsável Legal' : 'Assinante'}</span>
              </div>
              <div className="pl-6 space-y-1">
                <p className="text-sm text-foreground font-semibold">{signerName}</p>
                {signerCpf && <p className="text-xs text-muted-foreground">CPF: {formatCpf(signerCpf)}</p>}
                {isMinor && patient?.name && <p className="text-xs text-muted-foreground">Paciente: {patient.name}</p>}
              </div>
            </div>

            {/* Pending contracts */}
            {pendingContracts.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <PenLine className="w-3 h-3" /> Aguardando assinatura ({pendingContracts.length})
                </p>
                {pendingContracts.map(contract => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    expanded={expandedId === contract.id}
                    onToggleExpand={() => setExpandedId(expandedId === contract.id ? null : contract.id)}
                    signerName={signerName}
                    signerCpf={signerCpf}
                    isMinor={isMinor}
                    signingContractId={signingContractId}
                    signatureData={signatureData}
                    signaturePadRef={signaturePadRef}
                    signing={signing}
                    downloadingId={downloadingId}
                    formatCpf={formatCpf}
                    onStartSign={() => { setSigningContractId(contract.id); setSignatureData(''); }}
                    onCancelSign={() => { setSigningContractId(null); setSignatureData(''); }}
                    onSign={() => handleSign(contract)}
                    onSetSignatureData={setSignatureData}
                    onClearPad={() => signaturePadRef.current?.clear()}
                    onDownload={() => handleDownloadPDF(contract)}
                  />
                ))}
              </div>
            )}

            {/* Signed contracts */}
            {signedContracts.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3" /> Assinados ({signedContracts.length})
                </p>
                {signedContracts.map(contract => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    expanded={expandedId === contract.id}
                    onToggleExpand={() => setExpandedId(expandedId === contract.id ? null : contract.id)}
                    signerName={signerName}
                    signerCpf={signerCpf}
                    isMinor={isMinor}
                    signingContractId={signingContractId}
                    signatureData={signatureData}
                    signaturePadRef={signaturePadRef}
                    signing={signing}
                    downloadingId={downloadingId}
                    formatCpf={formatCpf}
                    onStartSign={() => {}}
                    onCancelSign={() => {}}
                    onSign={() => {}}
                    onSetSignatureData={setSignatureData}
                    onClearPad={() => {}}
                    onDownload={() => handleDownloadPDF(contract)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

// ─── Contract Card Component ─────────────────────────────────────────────────
function ContractCard({
  contract, expanded, onToggleExpand,
  signerName, signerCpf, isMinor,
  signingContractId, signatureData, signaturePadRef, signing, downloadingId, formatCpf,
  onStartSign, onCancelSign, onSign, onSetSignatureData, onClearPad, onDownload,
}: {
  contract: Contract;
  expanded: boolean;
  onToggleExpand: () => void;
  signerName: string;
  signerCpf: string | null;
  isMinor: boolean;
  signingContractId: string | null;
  signatureData: string;
  signaturePadRef: React.RefObject<SignaturePadRef>;
  signing: boolean;
  downloadingId: string | null;
  formatCpf: (cpf: string) => string;
  onStartSign: () => void;
  onCancelSign: () => void;
  onSign: () => void;
  onSetSignatureData: (v: string) => void;
  onClearPad: () => void;
  onDownload: () => void;
}) {
  const isSigned = contract.status === 'signed';
  const isPending = contract.status === 'sent';

  // Extract title from HTML
  const titleMatch = contract.template_html.match(/<h[12][^>]*>(.*?)<\/h[12]>/i);
  const contractTitle = titleMatch
    ? titleMatch[1].replace(/<[^>]*>/g, '').trim()
    : `Contrato de ${format(new Date(contract.created_at), "d MMM yyyy", { locale: ptBR })}`;

  return (
    <div className={cn(
      'bg-card rounded-2xl border overflow-hidden transition-colors',
      isPending ? 'border-warning/30' : 'border-border',
    )}>
      {/* Header - always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
          isSigned ? 'bg-green-500/10' : 'bg-warning/10',
        )}>
          {isSigned
            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
            : <PenLine className="w-4 h-4 text-warning" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{contractTitle}</p>
          <p className="text-xs text-muted-foreground">
            {isSigned
              ? `Assinado em ${format(new Date(contract.signed_at!), "d MMM yyyy", { locale: ptBR })}`
              : 'Aguardando assinatura'
            }
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 animate-fade-in">
          {/* Contract content */}
          <div className="overflow-auto max-h-[50vh] rounded-xl bg-background border border-border p-4">
            <div
              className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: contract.template_html }}
            />
          </div>

          {/* Signed state: show signatures + download */}
          {isSigned && (
            <div className="space-y-4">
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
              <Button className="w-full gap-2" variant="outline" onClick={onDownload} disabled={downloadingId === contract.id}>
                {downloadingId === contract.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Baixar contrato assinado (PDF)
              </Button>
            </div>
          )}

          {/* Pending state: signature flow */}
          {isPending && signingContractId === contract.id ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">
                {isMinor ? `Assinatura do responsável (${signerName}):` : 'Assine abaixo:'}
              </p>
              <SignaturePad
                ref={signaturePadRef}
                value={signatureData}
                onChange={onSetSignatureData}
                hideButtons
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => { onClearPad(); onCancelSign(); }} className="w-full sm:flex-1 gap-1">
                  Cancelar
                </Button>
                <Button variant="outline" onClick={onClearPad} className="w-full sm:flex-1 gap-1">
                  Limpar assinatura
                </Button>
                <Button onClick={onSign} disabled={signing} className="w-full sm:flex-1 gap-1">
                  {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                  Confirmar assinatura
                </Button>
              </div>
            </div>
          ) : isPending ? (
            <Button className="w-full gap-2" onClick={onStartSign}>
              <PenLine className="w-4 h-4" />
              {isMinor ? `Assinar como responsável (${signerName})` : 'Assinar contrato'}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
