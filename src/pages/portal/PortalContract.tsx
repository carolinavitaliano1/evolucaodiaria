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
import { cleanContractHtml } from '@/utils/contractHtmlUtils';

interface Contract {
  id: string;
  template_html: string;
  signed_at: string | null;
  signature_data: string | null;
  therapist_signature_data: string | null;
  therapist_signed_at: string | null;
  status: string;
  created_at: string;
  signer_name: string | null;
  signer_cpf: string | null;
  signer_city: string | null;
  agreed_terms: boolean;
}

interface PatientExtra {
  cpf: string | null;
  responsible_name: string | null;
  responsible_cpf: string | null;
  is_minor: boolean;
}

function createPdfBlockFromHtml(html: string) {
  const temp = document.createElement('div');
  temp.innerHTML = html.trim();
  return temp.firstElementChild as HTMLElement | null;
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];

  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.onload = done;
        img.onerror = done;
      });
    })
  );
}

function createPdfPageElement(contentWidthPx: number, host: HTMLElement) {
  const page = document.createElement('div');
  page.className = 'contract-pdf-wrap contract-pdf-page';
  page.style.width = `${contentWidthPx}px`;
  page.style.background = '#ffffff';
  page.style.display = 'flow-root';
  host.appendChild(page);
  return page;
}

function buildPaginatedPdfPages({
  cleanHtml,
  signatureBlock,
  contentWidthPx,
  maxPageHeightPx,
  host,
}: {
  cleanHtml: string;
  signatureBlock: string;
  contentWidthPx: number;
  maxPageHeightPx: number;
  host: HTMLElement;
}) {
  const sourceBody = document.createElement('div');
  sourceBody.className = 'contract-body';
  sourceBody.innerHTML = cleanHtml;

  const groups: HTMLElement[][] = [];
  const sourceChildren = Array.from(sourceBody.children) as HTMLElement[];

  for (let i = 0; i < sourceChildren.length; i++) {
    const current = sourceChildren[i];
    const currentTag = current.tagName.toUpperCase();

    if ((currentTag === 'H2' || currentTag === 'H3') && i < sourceChildren.length - 1) {
      const next = sourceChildren[i + 1];
      const nextTag = next.tagName.toUpperCase();

      if (nextTag !== 'H2' && nextTag !== 'H3') {
        groups.push([current, next]);
        i += 1;
        continue;
      }
    }

    groups.push([current]);
  }

  const sigNode = createPdfBlockFromHtml(signatureBlock);
  if (sigNode) groups.push([sigNode]);

  const pages: HTMLDivElement[] = [];
  let currentPage = createPdfPageElement(contentWidthPx, host);
  pages.push(currentPage);

  for (const group of groups) {
    const clones = group.map((node) => node.cloneNode(true) as HTMLElement);
    clones.forEach((node) => currentPage.appendChild(node));

    if (currentPage.scrollHeight > maxPageHeightPx && currentPage.childElementCount > clones.length) {
      clones.forEach((node) => node.remove());
      currentPage = createPdfPageElement(contentWidthPx, host);
      pages.push(currentPage);
      clones.forEach((node) => currentPage.appendChild(node));
    }
  }

  return pages;
}

/**
 * Gera PDF em páginas A4 reais, evitando cortes no meio do texto e preservando o bloco do carimbo/assinaturas.
 */
async function generateContractPDF(contract: Contract, signerName: string, signerCpf: string | null) {
  const A4_W_MM = 210;
  const A4_H_MM = 297;
  const MARGIN_MM = 15;
  const CONTENT_W_MM = A4_W_MM - MARGIN_MM * 2;
  const CONTENT_H_MM = A4_H_MM - MARGIN_MM * 2;
  const SCALE = 2;
  const PX_PER_MM = 96 / 25.4;
  const contentWidthPx = Math.round(CONTENT_W_MM * PX_PER_MM);
  const maxPageHeightPx = Math.floor(CONTENT_H_MM * PX_PER_MM);

  const cleanHtml = cleanContractHtml(contract.template_html);

  const displayName = contract.signer_name || signerName;
  const displayCpf = contract.signer_cpf || (signerCpf ? signerCpf.replace(/\D/g, '') : null);
  const displayCity = contract.signer_city || '';

  const formatCpfStr = (cpf: string) => {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return cpf;
  };

  // Parse therapist stamp data — supports both JSON format (new) and base64 image (legacy)
  let therapistSigBlock = '';
  if (contract.therapist_signature_data) {
    let stampData: { stamp_image?: string; name?: string; clinical_area?: string; cbo?: string; professional_id?: string } | null = null;
    try {
      stampData = JSON.parse(contract.therapist_signature_data);
    } catch {
      // Legacy: therapist_signature_data is a base64 image
      stampData = { stamp_image: contract.therapist_signature_data };
    }

    const stampImgHtml = stampData?.stamp_image
      ? `<img class="therapist-mark-img" src="${stampData.stamp_image}" style="max-height:120px;max-width:280px;margin:0 auto 12px;display:block;object-fit:contain;" />`
      : '';
    const lineHtml = `<div style="width:260px;margin:0 auto;border-bottom:1.5px solid #333;"></div>`;
    const nameHtml = stampData?.name ? `<p style="font-size:11px;font-weight:bold;color:#111;margin:8px 0 2px;text-align:center;">${stampData.name}</p>` : '';
    const areaHtml = stampData?.clinical_area ? `<p style="font-size:10px;color:#555;margin:0 0 2px;text-align:center;">${stampData.clinical_area}</p>` : '';
    const cboHtml = stampData?.cbo ? `<p style="font-size:10px;color:#555;margin:0 0 2px;text-align:center;">CBO: ${stampData.cbo}</p>` : '';
    const regHtml = stampData?.professional_id ? `<p style="font-size:10px;color:#555;margin:0 0 2px;text-align:center;">Registro: ${stampData.professional_id}</p>` : '';
    const dateHtml = contract.therapist_signed_at
      ? `<p style="font-size:9px;color:#888;margin-top:8px;text-align:center;">${format(new Date(contract.therapist_signed_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>`
      : '';

    therapistSigBlock = `<div class="pdf-keep-together pdf-signature-block" style="margin-top:40px;padding-top:24px;border-top:2px solid #333;text-align:center;">
      ${stampImgHtml}
      ${lineHtml}
      ${nameHtml}
      ${areaHtml}
      ${cboHtml}
      ${regHtml}
      ${dateHtml}
    </div>`;
  }

  const patientSigBlock = contract.signature_data
    ? `<div class="pdf-keep-together pdf-signature-block" style="margin-top:48px;border-top:2px solid #333;padding-top:28px;">
        <p style="font-size:13px;font-weight:bold;color:#111;margin-bottom:16px;text-align:center;text-transform:uppercase;letter-spacing:0.5px;">
          Dados do Assinante
        </p>
        <table style="width:100%;border-collapse:collapse;margin:0 auto 20px;max-width:500px;">
          <tr>
            <td style="border:1px solid #bbb;padding:8px 12px;font-size:12px;font-weight:bold;width:120px;background:#f9f9f9;">Nome:</td>
            <td style="border:1px solid #bbb;padding:8px 12px;font-size:12px;">${displayName}</td>
          </tr>
          ${displayCpf ? `<tr>
            <td style="border:1px solid #bbb;padding:8px 12px;font-size:12px;font-weight:bold;background:#f9f9f9;">CPF:</td>
            <td style="border:1px solid #bbb;padding:8px 12px;font-size:12px;">${formatCpfStr(displayCpf)}</td>
          </tr>` : ''}
          ${displayCity ? `<tr>
            <td style="border:1px solid #bbb;padding:8px 12px;font-size:12px;font-weight:bold;background:#f9f9f9;">Cidade:</td>
            <td style="border:1px solid #bbb;padding:8px 12px;font-size:12px;">${displayCity}</td>
          </tr>` : ''}
        </table>
        <div style="text-align:center;margin-top:20px;">
          <p style="font-size:11px;color:#555;margin-bottom:8px;">Assinatura digital:</p>
          <img class="patient-signature-img" src="${contract.signature_data}" style="max-height:80px;max-width:280px;border:1px solid #ddd;border-radius:2px;margin:0 auto;display:block;" />
          <p style="font-size:11px;color:#333;margin-top:14px;font-weight:bold;">
            Assinado em ${format(new Date(contract.signed_at!), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          <p style="font-size:10px;color:#888;margin-top:6px;font-style:italic;">
            O assinante declarou ter lido e concordado com todos os termos deste contrato.
          </p>
        </div>
      </div>`
    : '';

  const renderRoot = document.createElement('div');
  renderRoot.style.cssText = `
    position: fixed;
    left: -100000px;
    top: 0;
    width: ${contentWidthPx}px;
    opacity: 0;
    pointer-events: none;
    background: #ffffff;
    font-family: 'Times New Roman', 'Georgia', serif;
    font-size: 13px;
    color: #111;
    line-height: 1.65;
    box-sizing: border-box;
    z-index: -1;
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .contract-pdf-wrap,
    .contract-pdf-wrap * { box-sizing: border-box; }
    .contract-pdf-wrap { width: ${contentWidthPx}px; color: #111; }
    .contract-pdf-wrap h2 {
      font-size: 16px; font-weight: bold; text-align: center;
      margin: 28px 0 20px; color: #111; text-transform: uppercase;
      letter-spacing: 0.5px; line-height: 1.4;
    }
    .contract-pdf-wrap h3 {
      font-size: 13px; font-weight: bold; margin: 24px 0 10px; color: #111;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .contract-pdf-wrap p {
      margin: 0 0 12px; text-align: justify; line-height: 1.65;
      text-indent: 0; orphans: 3; widows: 3;
    }
    .contract-pdf-wrap ul, .contract-pdf-wrap ol {
      margin: 8px 0 12px; padding-left: 28px;
    }
    .contract-pdf-wrap li { margin-bottom: 4px; line-height: 1.5; }
    .contract-pdf-wrap strong { font-weight: bold; }
    .contract-pdf-wrap em { font-style: italic; }
    .contract-pdf-wrap u { text-decoration: underline; }
    .contract-pdf-wrap hr {
      border: none; border-top: 1px solid #999; margin: 20px 0;
    }
    .contract-pdf-wrap table {
      width: 100%; border-collapse: collapse; margin: 14px 0;
    }
    .contract-pdf-wrap td, .contract-pdf-wrap th {
      border: 1px solid #bbb; padding: 6px 10px; font-size: 12px;
      text-align: left; vertical-align: top;
    }
    .contract-pdf-wrap th {
      background: #f5f5f5; font-weight: bold;
    }
    .contract-pdf-wrap img:not(.therapist-mark-img):not(.patient-signature-img) {
      max-width: 100%; height: auto; display: block; margin: 8px auto;
    }
    .contract-pdf-wrap .therapist-mark-img,
    .contract-pdf-wrap .patient-signature-img {
      object-fit: contain;
    }
    .contract-pdf-wrap > :first-child { margin-top: 0 !important; }
    .contract-pdf-wrap > :last-child { margin-bottom: 0 !important; }
  `;

  const pagesHost = document.createElement('div');
  pagesHost.style.width = `${contentWidthPx}px`;

  renderRoot.appendChild(styleEl);
  renderRoot.appendChild(pagesHost);
  document.body.appendChild(renderRoot);

  try {
    const pages = buildPaginatedPdfPages({
      cleanHtml,
      therapistSigBlock,
      patientSigBlock,
      contentWidthPx,
      maxPageHeightPx,
      host: pagesHost,
    });

    await waitForImages(renderRoot);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      const canvas = await html2canvas(page, {
        scale: SCALE,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: contentWidthPx,
        windowWidth: contentWidthPx,
      });

      const renderedHeightMm = canvas.height / (canvas.width / CONTENT_W_MM);

      if (index > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        MARGIN_MM,
        MARGIN_MM,
        CONTENT_W_MM,
        Math.min(renderedHeightMm, CONTENT_H_MM)
      );
    }

    pdf.save(`contrato-${displayName.toLowerCase().replace(/\s+/g, '-')}.pdf`);
  } finally {
    document.body.removeChild(renderRoot);
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

  const formatCpfInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const validateCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, '');
    return digits.length === 11;
  };

  const handleSign = async (contract: Contract) => {
    let finalSig = signatureData;
    if (!finalSig && signaturePadRef.current) {
      finalSig = signaturePadRef.current.save();
    }
    if (!signerNameInput.trim()) {
      toast.error('Preencha o nome completo do assinante.');
      return;
    }
    if (!signerCpfInput.trim() || !validateCpf(signerCpfInput)) {
      toast.error('Preencha um CPF válido (11 dígitos).');
      return;
    }
    if (!signerCityInput.trim()) {
      toast.error('Preencha a cidade.');
      return;
    }
    if (!agreedTerms) {
      toast.error('Você precisa concordar com os termos do contrato.');
      return;
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
          signer_name: signerNameInput.trim(),
          signer_cpf: signerCpfInput.replace(/\D/g, ''),
          signer_city: signerCityInput.trim(),
          agreed_terms: true,
        } as any)
        .eq('id', contract.id);
      if (error) throw error;
      await supabase
        .from('patients')
        .update({ contract_start_date: new Date().toISOString().split('T')[0] })
        .eq('id', portalAccount!.patient_id);

      toast.success('Contrato assinado com sucesso! ✅');
      setContracts(prev => prev.map(c =>
        c.id === contract.id
          ? { ...c, status: 'signed', signed_at: new Date().toISOString(), signature_data: finalSig,
              signer_name: signerNameInput.trim(), signer_cpf: signerCpfInput.replace(/\D/g, ''),
              signer_city: signerCityInput.trim(), agreed_terms: true }
          : c
      ));
      setSigningContractId(null);
      setSignatureData('');
      setSignerNameInput('');
      setSignerCpfInput('');
      setSignerCityInput('');
      setAgreedTerms(false);
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
                    signerNameInput={signerNameInput}
                    signerCpfInput={signerCpfInput}
                    signerCityInput={signerCityInput}
                    agreedTerms={agreedTerms}
                    onSignerNameChange={setSignerNameInput}
                    onSignerCpfChange={(v) => setSignerCpfInput(formatCpfInput(v))}
                    onSignerCityChange={setSignerCityInput}
                    onAgreedTermsChange={setAgreedTerms}
                    onStartSign={() => {
                      setSigningContractId(contract.id);
                      setSignatureData('');
                      setSignerNameInput(signerName || '');
                      setSignerCpfInput(signerCpf ? formatCpfInput(signerCpf) : '');
                      setSignerCityInput('');
                      setAgreedTerms(false);
                    }}
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
                    signerNameInput=""
                    signerCpfInput=""
                    signerCityInput=""
                    agreedTerms={false}
                    onSignerNameChange={() => {}}
                    onSignerCpfChange={() => {}}
                    onSignerCityChange={() => {}}
                    onAgreedTermsChange={() => {}}
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
  signerNameInput, signerCpfInput, signerCityInput, agreedTerms,
  onSignerNameChange, onSignerCpfChange, onSignerCityChange, onAgreedTermsChange,
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
  signerNameInput: string;
  signerCpfInput: string;
  signerCityInput: string;
  agreedTerms: boolean;
  onSignerNameChange: (v: string) => void;
  onSignerCpfChange: (v: string) => void;
  onSignerCityChange: (v: string) => void;
  onAgreedTermsChange: (v: boolean) => void;
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
          isSigned ? 'bg-success/10' : 'bg-warning/10',
        )}>
          {isSigned
            ? <CheckCircle2 className="w-4 h-4 text-success" />
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
              className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed [&_p]:text-justify [&_p]:leading-relaxed [&_h2]:text-center [&_h3]:uppercase [&_h3]:text-sm [&_img]:max-w-full [&_img]:h-auto"
              dangerouslySetInnerHTML={{ __html: cleanContractHtml(contract.template_html) }}
            />
          </div>

          {/* Signed state: show signatures + signer info + download */}
          {isSigned && (
            <div className="space-y-4">
              {/* Signer identity info */}
              {(contract.signer_name || contract.signer_cpf || contract.signer_city) && (
                <div className="rounded-xl bg-muted/30 border border-border p-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Dados do assinante
                  </p>
                  {contract.signer_name && (
                    <p className="text-xs text-muted-foreground">Nome: <strong className="text-foreground">{contract.signer_name}</strong></p>
                  )}
                  {contract.signer_cpf && (
                    <p className="text-xs text-muted-foreground">CPF: <strong className="text-foreground">{formatCpf(contract.signer_cpf)}</strong></p>
                  )}
                  {contract.signer_city && (
                    <p className="text-xs text-muted-foreground">Cidade: <strong className="text-foreground">{contract.signer_city}</strong></p>
                  )}
                  {contract.signed_at && (
                    <p className="text-xs text-muted-foreground">
                      Data: <strong className="text-foreground">{format(new Date(contract.signed_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</strong>
                    </p>
                  )}
                </div>
              )}

              {contract.therapist_signature_data && (() => {
                let stampInfo: any = null;
                try { stampInfo = JSON.parse(contract.therapist_signature_data); } catch { stampInfo = null; }
                return (
                  <div className="space-y-1 text-center">
                    <p className="text-xs text-muted-foreground font-medium">Carimbo do terapeuta:</p>
                    {stampInfo?.stamp_image ? (
                      <img src={stampInfo.stamp_image} alt="Carimbo" className="max-h-20 mx-auto object-contain" />
                    ) : !stampInfo ? (
                      <img src={contract.therapist_signature_data} alt="Assinatura do terapeuta"
                        className="max-h-32 mx-auto object-contain border border-border rounded bg-background" />
                    ) : null}
                    <div className="w-40 mx-auto border-b border-foreground/40" />
                    {stampInfo?.name && <p className="text-xs font-semibold text-foreground">{stampInfo.name}</p>}
                    {stampInfo?.clinical_area && <p className="text-[10px] text-muted-foreground">{stampInfo.clinical_area}</p>}
                    {stampInfo?.cbo && <p className="text-[10px] text-muted-foreground">CBO: {stampInfo.cbo}</p>}
                    {stampInfo?.professional_id && <p className="text-[10px] text-muted-foreground">Registro: {stampInfo.professional_id}</p>}
                    {contract.therapist_signed_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(contract.therapist_signed_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                );
              })()}
              {contract.signature_data && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">
                    Assinatura de <strong>{contract.signer_name || signerName}</strong>:
                  </p>
                  {(contract.signer_cpf || signerCpf) && (
                    <p className="text-xs text-muted-foreground">CPF: {formatCpf(contract.signer_cpf || signerCpf!)}</p>
                  )}
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
              <p className="text-sm font-semibold text-foreground">
                {isMinor ? `Identificação do responsável legal` : 'Identificação do assinante'}
              </p>

              {/* Required identity fields */}
              <div className="space-y-3 rounded-xl bg-muted/20 border border-border p-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Nome completo <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={signerNameInput}
                    onChange={e => onSignerNameChange(e.target.value)}
                    placeholder="Nome completo do assinante"
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      CPF <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={signerCpfInput}
                      onChange={e => onSignerCpfChange(e.target.value)}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Cidade <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={signerCityInput}
                      onChange={e => onSignerCityChange(e.target.value)}
                      placeholder="Cidade / UF"
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </div>

              {/* Signature pad */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">
                  Assinatura digital <span className="text-destructive">*</span>
                </p>
                <SignaturePad
                  ref={signaturePadRef}
                  value={signatureData}
                  onChange={onSetSignatureData}
                  hideButtons
                />
              </div>

              {/* Agreement checkbox */}
              <label className="flex items-start gap-2.5 cursor-pointer rounded-xl bg-muted/20 border border-border p-3">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={e => onAgreedTermsChange(e.target.checked)}
                  className="w-4 h-4 accent-primary mt-0.5 shrink-0"
                />
                <span className="text-xs text-foreground leading-relaxed">
                  <strong>Declaro</strong> que li e compreendi todos os termos deste contrato e concordo integralmente com as condições estabelecidas.
                  {isMinor && ' Como responsável legal, assumo a responsabilidade pela contratação.'}
                </span>
              </label>

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
