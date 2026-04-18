import { useEffect, useState } from 'react';
import { Briefcase, Calendar, Clock, DollarSign, CheckCircle2, Receipt, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { EditableReceiptModal } from '@/components/financial/EditableReceiptModal';
import { toast } from 'sonner';

interface PatientServicesSectionProps {
  patientId: string;
  month: number; // 0-indexed
  year: number;
  therapist?: {
    name: string;
    cpf?: string | null;
    professionalId?: string | null;
    cbo?: string | null;
    address?: string | null;
  };
  payerName: string;
  payerCpf?: string | null;
  stamp?: any | null;
  clinic?: { name?: string | null; address?: string | null; cnpj?: string | null } | null;
}

interface ServiceRow {
  id: string;
  date: string;
  time: string;
  price: number;
  status: string;
  paid: boolean | null;
  payment_date: string | null;
  service_name: string | null;
  clinic_id: string | null;
}

export function PatientServicesSection({
  patientId, month, year, therapist, payerName, payerCpf, stamp, clinic,
}: PatientServicesSectionProps) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('private_appointments')
      .select('id, date, time, price, status, paid, payment_date, clinic_id, services(name)')
      .eq('patient_id', patientId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: false });
    setServices((data || []).map((d: any) => ({
      id: d.id, date: d.date, time: d.time, price: d.price,
      status: d.status, paid: d.paid, payment_date: d.payment_date,
      clinic_id: d.clinic_id, service_name: d.services?.name ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [patientId, month, year]);

  const togglePaid = async (svc: ServiceRow) => {
    const newPaid = !svc.paid;
    await supabase.from('private_appointments').update({
      paid: newPaid,
      payment_date: newPaid ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', svc.id);
    load();
  };

  const handleGenerateReceipt = async (svc: ServiceRow) => {
    if (!therapist) { toast.error('Perfil profissional incompleto'); return; }
    setGeneratingId(svc.id);
    try {
      await generatePaymentReceiptPdf({
        therapistName: therapist.name,
        therapistCpf: therapist.cpf,
        therapistAddress: therapist.address,
        therapistProfessionalId: therapist.professionalId,
        therapistCbo: therapist.cbo,
        therapistClinicalArea: stamp?.clinical_area ?? null,
        stamp: stamp || null,
        payerName,
        payerCpf,
        location: null,
        amount: svc.price,
        serviceName: svc.service_name || 'Serviço prestado',
        period: format(new Date(svc.date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR }),
        paymentMethod: 'transferência bancária',
        paymentDate: svc.payment_date || svc.date,
        clinicName: clinic?.name ?? null,
        clinicAddress: clinic?.address ?? null,
        clinicCnpj: clinic?.cnpj ?? null,
      });
    } finally {
      setGeneratingId(null);
    }
  };

  const totalReceived = services.filter(s => s.paid && s.status !== 'cancelado').reduce((sum, s) => sum + s.price, 0);
  const totalPending = services.filter(s => !s.paid && s.status !== 'cancelado').reduce((sum, s) => sum + s.price, 0);

  if (loading) {
    return (
      <div className="bg-card rounded-xl p-5 shadow-sm border border-border flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (services.length === 0) return null;

  return (
    <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
      <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
        <Briefcase className="w-4 h-4 text-primary" /> Serviços do Mês
        <span className="text-xs font-normal text-muted-foreground ml-1">
          — {services.length} {services.length === 1 ? 'serviço' : 'serviços'}
        </span>
      </h2>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-success/10 border border-success/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recebido</p>
          <p className="text-sm font-semibold text-success">R$ {totalReceived.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-warning/10 border border-warning/20 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pendente</p>
          <p className="text-sm font-semibold text-warning">R$ {totalPending.toFixed(2)}</p>
        </div>
      </div>
      <div className="space-y-2">
        {services.map(svc => (
          <div key={svc.id} className="rounded-lg border border-border bg-secondary/20 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <p className="text-sm font-medium text-foreground">
                    {svc.service_name || 'Serviço'}
                  </p>
                  <Badge className={cn("text-xs", svc.status === 'cancelado' ? 'bg-destructive/10 text-destructive' : svc.status === 'concluído' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary')}>
                    {svc.status}
                  </Badge>
                  {svc.paid && (
                    <Badge variant="outline" className="text-xs border-success/50 text-success">Pago</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {format(new Date(svc.date + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {svc.time?.slice(0, 5)}
                  </span>
                  <span className="flex items-center gap-1 text-success font-medium">
                    <DollarSign className="w-3 h-3" /> R$ {svc.price.toFixed(2)}
                  </span>
                  {svc.paid && svc.payment_date && (
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="w-3 h-3" /> {format(new Date(svc.payment_date + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {svc.status !== 'cancelado' && (
                  <Button
                    size="sm"
                    variant={svc.paid ? 'outline' : 'default'}
                    className="h-7 text-xs"
                    onClick={() => togglePaid(svc)}
                  >
                    {svc.paid ? 'Desmarcar' : 'Pago'}
                  </Button>
                )}
                {svc.paid && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Emitir recibo"
                    onClick={() => handleGenerateReceipt(svc)}
                    disabled={generatingId === svc.id}
                  >
                    {generatingId === svc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5 text-primary" />}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
