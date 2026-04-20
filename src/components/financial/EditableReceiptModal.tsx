import { useEffect, useState } from 'react';
import { Loader2, FileText, FileType2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generatePaymentReceiptPdf, generatePaymentReceiptWord, type PaymentReceiptOptions } from '@/utils/generatePaymentReceiptPdf';
import { toast } from 'sonner';

interface StampRow {
  id: string;
  name: string;
  clinical_area: string;
  cbo: string | null;
  stamp_image: string | null;
  signature_image: string | null;
  is_default: boolean | null;
}

interface TherapistInfo {
  name: string;
  cpf?: string | null;
  professionalId?: string | null;
  cbo?: string | null;
  address?: string | null;
}

interface ClinicInfo {
  name?: string | null;
  address?: string | null;
  cnpj?: string | null;
}

interface EditableReceiptModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Initial values pre-filled in the modal */
  initial: {
    payerName: string;
    payerCpf?: string | null;
    amount: number;
    serviceName: string;
    period: string;
    paymentMethod?: string;
    paymentDate?: string;
    location?: string | null;
    initialStampId?: string | null;
  };
  therapist: TherapistInfo;
  clinic?: ClinicInfo | null;
  /** When provided, generated receipts are auto-saved as patient documents */
  patientId?: string | null;
}

export function EditableReceiptModal({
  open, onOpenChange, initial, therapist, clinic, patientId,
}: EditableReceiptModalProps) {
  const { user } = useAuth();
  const [stamps, setStamps] = useState<StampRow[]>([]);
  const [stampId, setStampId] = useState<string>('none');
  const [payerName, setPayerName] = useState(initial.payerName);
  const [payerCpf, setPayerCpf] = useState(initial.payerCpf || '');
  const [amount, setAmount] = useState(String(initial.amount.toFixed(2)));
  const [serviceName, setServiceName] = useState(initial.serviceName);
  const [period, setPeriod] = useState(initial.period);
  const [paymentMethod, setPaymentMethod] = useState(initial.paymentMethod || 'transferência bancária');
  const [paymentDate, setPaymentDate] = useState(initial.paymentDate || new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState(initial.location || '');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingWord, setGeneratingWord] = useState(false);

  // Reset state when modal reopens with new initial
  useEffect(() => {
    if (open) {
      setPayerName(initial.payerName);
      setPayerCpf(initial.payerCpf || '');
      setAmount(String(initial.amount.toFixed(2)));
      setServiceName(initial.serviceName);
      setPeriod(initial.period);
      setPaymentMethod(initial.paymentMethod || 'transferência bancária');
      setPaymentDate(initial.paymentDate || new Date().toISOString().split('T')[0]);
      setLocation(initial.location || '');
    }
  }, [open, initial]);

  // Load stamps
  useEffect(() => {
    if (!user || !open) return;
    supabase.from('stamps').select('*').eq('user_id', user.id).then(({ data }) => {
      const list = (data || []) as StampRow[];
      setStamps(list);
      if (initial.initialStampId && list.some(s => s.id === initial.initialStampId)) {
        setStampId(initial.initialStampId);
      } else {
        const def = list.find(s => s.is_default) || list[0];
        setStampId(def ? def.id : 'none');
      }
    });
  }, [user, open, initial.initialStampId]);

  const buildOpts = (): PaymentReceiptOptions => {
    const stamp = stampId !== 'none' ? stamps.find(s => s.id === stampId) || null : null;
    return {
      therapistName: stamp?.name || therapist.name,
      therapistCpf: therapist.cpf ?? null,
      therapistAddress: therapist.address ?? null,
      therapistProfessionalId: therapist.professionalId ?? null,
      therapistCbo: stamp?.cbo || therapist.cbo || null,
      therapistClinicalArea: stamp?.clinical_area ?? null,
      stamp: stamp ? {
        id: stamp.id,
        name: stamp.name,
        clinical_area: stamp.clinical_area,
        cbo: stamp.cbo,
        stamp_image: stamp.stamp_image,
        signature_image: stamp.signature_image,
      } : null,
      payerName: payerName.trim() || initial.payerName,
      payerCpf: payerCpf.trim() || null,
      location: location.trim() || null,
      amount: parseFloat(amount) || 0,
      serviceName: serviceName.trim() || 'Serviço prestado',
      period: period.trim(),
      paymentMethod: paymentMethod.trim() || 'transferência bancária',
      paymentDate,
      clinicName: clinic?.name ?? null,
      clinicAddress: clinic?.address ?? null,
      clinicCnpj: clinic?.cnpj ?? null,
    };
  };

  const saveToPatientDocs = async (blob: Blob, ext: 'pdf' | 'docx', mime: string) => {
    if (!patientId || !user) return;
    try {
      const safePayer = (payerName.trim() || initial.payerName).replace(/\s+/g, '-').toLowerCase();
      const safeDate = paymentDate || new Date().toISOString().slice(0, 10);
      const filename = `recibo-pagamento-${safePayer}-${safeDate}.${ext}`;
      const filePath = `patient-receipts/${patientId}/${Date.now()}_${filename}`;
      const { error: upErr } = await supabase.storage.from('attachments').upload(filePath, blob, {
        contentType: mime, upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('attachments').insert({
        user_id: user.id,
        parent_id: patientId,
        parent_type: 'patient',
        name: filename,
        file_path: filePath,
        file_type: mime,
        file_size: blob.size,
      });
      if (insErr) throw insErr;
      toast.success('Recibo salvo nos documentos do paciente');
    } catch (e) {
      console.error('Falha ao salvar recibo nos documentos:', e);
      toast.error('Recibo gerado, mas falhou ao salvar nos documentos do paciente');
    }
  };

  const handlePdf = async () => {
    setGeneratingPdf(true);
    try {
      const opts = buildOpts();
      if (patientId) {
        const blob = await generatePaymentReceiptPdf(opts, true);
        // Trigger download as well
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safePayer = opts.payerName.replace(/\s+/g, '-').toLowerCase();
        const safeDate = opts.paymentDate || new Date().toISOString().slice(0, 10);
        a.href = url; a.download = `recibo-pagamento-${safePayer}-${safeDate}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        await saveToPatientDocs(blob, 'pdf', 'application/pdf');
      } else {
        await generatePaymentReceiptPdf(opts);
      }
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar recibo PDF');
    } finally { setGeneratingPdf(false); }
  };

  const handleWord = async () => {
    setGeneratingWord(true);
    try {
      const opts = buildOpts();
      if (patientId) {
        const blob = await generatePaymentReceiptWord(opts, true);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safePayer = opts.payerName.replace(/\s+/g, '-').toLowerCase();
        const safeDate = opts.paymentDate || new Date().toISOString().slice(0, 10);
        a.href = url; a.download = `recibo-pagamento-${safePayer}-${safeDate}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        await saveToPatientDocs(blob, 'docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } else {
        await generatePaymentReceiptWord(opts);
      }
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar recibo Word');
    } finally { setGeneratingWord(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Recibo de Pagamento — Edite antes de gerar</DialogTitle>
          <DialogDescription className="text-xs">
            Revise e ajuste todos os campos. Você pode trocar o carimbo abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome do pagador</Label>
              <Input value={payerName} onChange={e => setPayerName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">CPF/CNPJ do pagador</Label>
              <Input value={payerCpf} onChange={e => setPayerCpf(e.target.value)} placeholder="opcional" />
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data do pagamento</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder="Ex: PIX, transferência bancária" />
            </div>
            <div>
              <Label className="text-xs">Período de referência</Label>
              <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="Ex: 01/04 a 30/04/2026" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Descrição do serviço</Label>
            <Textarea
              value={serviceName}
              onChange={e => setServiceName(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <div>
            <Label className="text-xs">Local (opcional)</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: São Paulo, SP, 18/04/2026" />
          </div>

          <div>
            <Label className="text-xs">Carimbo / Assinatura</Label>
            <Select value={stampId} onValueChange={setStampId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um carimbo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem carimbo</SelectItem>
                {stamps.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.clinical_area}{s.is_default ? ' (padrão)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stamps.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">Nenhum carimbo cadastrado. Cadastre em Perfil &gt; Carimbos.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={handleWord} disabled={generatingWord || generatingPdf}>
            {generatingWord ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileType2 className="w-4 h-4 mr-1" />}
            Word
          </Button>
          <Button onClick={handlePdf} disabled={generatingPdf || generatingWord}>
            {generatingPdf ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
            PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
