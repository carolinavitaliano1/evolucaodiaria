import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, ClipboardList, User, Phone, MapPin, Heart, School, AlertCircle } from 'lucide-react';

interface PatientRow {
  id: string;
  name: string;
  status: string;
}

export default function PatientIntakePublic() {
  const { token } = useParams<{ token: string }>();
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Form fields
  const [birthdate, setBirthdate] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleWhatsapp, setResponsibleWhatsapp] = useState('');
  const [responsibleCpf, setResponsibleCpf] = useState('');
  const [financialResponsibleName, setFinancialResponsibleName] = useState('');
  const [financialResponsibleWhatsapp, setFinancialResponsibleWhatsapp] = useState('');
  const [financialResponsibleCpf, setFinancialResponsibleCpf] = useState('');
  const [observations, setObservations] = useState('');
  const [howFound, setHowFound] = useState('');

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    supabase
      .from('patients')
      .select('id, name, status')
      .eq('intake_token', token)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true); }
        else { setPatient(data as PatientRow); }
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    if (!birthdate || !responsibleName) {
      toast.error('Preencha pelo menos a data de nascimento e o nome do responsável.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          birthdate,
          cpf: cpf || null,
          phone: phone || null,
          whatsapp: whatsapp || null,
          email: email || null,
          observations: address ? `Endereço: ${address}${observations ? '\n' + observations : ''}` : (observations || null),
          responsible_name: responsibleName || null,
          responsible_whatsapp: responsibleWhatsapp || null,
          responsible_cpf: responsibleCpf || null,
          financial_responsible_name: financialResponsibleName || null,
          financial_responsible_whatsapp: financialResponsibleWhatsapp || null,
          financial_responsible_cpf: financialResponsibleCpf || null,
          status: 'pendente_revisao',
        } as any)
        .eq('intake_token', token);

      if (error) throw error;

      // Also save to intake_forms table if patient has portal account
      await supabase.from('patient_intake_forms').upsert({
        patient_id: patient.id,
        therapist_user_id: '00000000-0000-0000-0000-000000000000', // placeholder — will be updated by therapist
        full_name: patient.name,
        birthdate,
        cpf: cpf || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        email: email || null,
        gender: gender || null,
        address: address || null,
        responsible_name: responsibleName || null,
        responsible_phone: responsibleWhatsapp || null,
        responsible_cpf: responsibleCpf || null,
        financial_responsible_name: financialResponsibleName || null,
        financial_responsible_phone: financialResponsibleWhatsapp || null,
        financial_responsible_cpf: financialResponsibleCpf || null,
        how_found: howFound || null,
        health_info: observations || null,
        submitted_at: new Date().toISOString(),
      }, { onConflict: 'patient_id' }).maybeSingle();

      setDone(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar dados. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">Link inválido ou expirado</h1>
        <p className="text-muted-foreground text-sm">Este link de pré-cadastro não é mais válido. Entre em contato com a clínica.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Dados enviados com sucesso! 🎉</h1>
        <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
          Sua ficha foi enviada para a clínica. Em breve entraremos em contato para confirmar o agendamento.
        </p>
        <p className="text-xs text-muted-foreground mt-6">Você já pode fechar esta página.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-6 py-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium opacity-80">Ficha de Pré-cadastro</span>
          </div>
          <h1 className="text-2xl font-bold">Olá, {patient?.name}! 👋</h1>
          <p className="text-sm opacity-80 mt-1 leading-relaxed">
            Preencha os dados abaixo para completar seu cadastro na clínica. Leva menos de 3 minutos!
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">

        {/* Personal data */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <User className="w-4 h-4 text-primary" />
            Dados Pessoais
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Data de Nascimento <span className="text-destructive">*</span></Label>
              <Input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF</Label>
              <Input placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Gênero</Label>
              <select
                value={gender}
                onChange={e => setGender(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecionar...</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="nao_binario">Não-binário</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Phone className="w-4 h-4 text-primary" />
            Contato
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input placeholder="(00) 0000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp</Label>
              <Input placeholder="(00) 00000-0000" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">E-mail</Label>
              <Input type="email" placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Address */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            Endereço
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Endereço completo</Label>
            <Input placeholder="Rua, número, bairro, cidade — UF" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
        </section>

        {/* Responsible */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Heart className="w-4 h-4 text-primary" />
            Responsável <span className="text-xs font-normal text-muted-foreground">(se menor de idade)</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nome do Responsável <span className="text-destructive">*</span></Label>
              <Input placeholder="Nome completo" value={responsibleName} onChange={e => setResponsibleName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp do Responsável</Label>
              <Input placeholder="(00) 00000-0000" value={responsibleWhatsapp} onChange={e => setResponsibleWhatsapp(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF do Responsável</Label>
              <Input placeholder="000.000.000-00" value={responsibleCpf} onChange={e => setResponsibleCpf(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Financial Responsible */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <School className="w-4 h-4 text-primary" />
            Responsável Financeiro <span className="text-xs font-normal text-muted-foreground">(se diferente do responsável)</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input placeholder="Nome completo" value={financialResponsibleName} onChange={e => setFinancialResponsibleName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp</Label>
              <Input placeholder="(00) 00000-0000" value={financialResponsibleWhatsapp} onChange={e => setFinancialResponsibleWhatsapp(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF</Label>
              <Input placeholder="000.000.000-00" value={financialResponsibleCpf} onChange={e => setFinancialResponsibleCpf(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Extra */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ClipboardList className="w-4 h-4 text-primary" />
            Informações Adicionais
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Como nos conheceu?</Label>
              <select
                value={howFound}
                onChange={e => setHowFound(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecionar...</option>
                <option value="indicacao">Indicação de amigo/familiar</option>
                <option value="google">Google / Internet</option>
                <option value="instagram">Instagram / Redes Sociais</option>
                <option value="escola">Escola / Instituição</option>
                <option value="plano">Plano de Saúde</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações de saúde / informações relevantes</Label>
              <Textarea
                placeholder="Alergias, medicamentos em uso, condições de saúde relevantes..."
                value={observations}
                onChange={e => setObservations(e.target.value)}
                className="min-h-[90px] resize-none text-sm"
              />
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 shadow-lg">
          <div className="max-w-lg mx-auto">
            <Button type="submit" className="w-full gap-2 h-12 text-base" disabled={saving}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {saving ? 'Enviando...' : 'Enviar Cadastro'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
