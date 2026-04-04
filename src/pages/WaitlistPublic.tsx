import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Heart, CheckCircle2, Clock } from 'lucide-react';

const WEEKDAY_OPTIONS = [
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'terca', label: 'Terça-feira' },
  { value: 'quarta', label: 'Quarta-feira' },
  { value: 'quinta', label: 'Quinta-feira' },
  { value: 'sexta', label: 'Sexta-feira' },
  { value: 'sabado', label: 'Sábado' },
];

export default function WaitlistPublic() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const [clinicName, setClinicName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [clinicUserId, setClinicUserId] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState('');
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [preferredTime, setPreferredTime] = useState('');

  useEffect(() => {
    if (!clinicId) return;
    supabase.rpc('get_clinic_for_enrollment', { _clinic_id: clinicId })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setClinicName(data[0].name);
        }
        setLoading(false);
      });
    // Get clinic user_id for the waitlist entry
    supabase.from('clinics').select('user_id').eq('id', clinicId).maybeSingle()
      .then(({ data }) => {
        if (data) setClinicUserId(data.user_id);
      });
  }, [clinicId]);

  const toggleDay = (day: string) => {
    setPreferredDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !clinicId || !clinicUserId) {
      toast.error('Preencha ao menos o nome.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('waitlist_entries' as any).insert({
        clinic_id: clinicId,
        user_id: clinicUserId,
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        birthdate: birthdate || null,
        gender: gender || null,
        address: address.trim() || null,
        reason: reason.trim() || null,
        preferred_days: preferredDays.length > 0 ? preferredDays : null,
        preferred_time: preferredTime.trim() || null,
      } as any);
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar inscrição');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinicName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-md">
          <p className="text-lg font-semibold text-foreground">Link inválido</p>
          <p className="text-sm text-muted-foreground mt-2">Esta lista de espera não está disponível.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-md space-y-4">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Inscrição enviada!</h2>
          <p className="text-sm text-muted-foreground">
            Sua inscrição na lista de espera foi registrada com sucesso. Entraremos em contato assim que uma vaga estiver disponível.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Heart className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Lista de Espera</h1>
          <p className="text-sm text-muted-foreground">
            Inscreva-se para iniciar sua jornada terapêutica
          </p>
          {clinicName && (
            <p className="text-xs text-primary font-medium">{clinicName}</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <p className="text-sm font-medium text-foreground">Preencha seus dados</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Seu nome" required className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sobrenome</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Seu sobrenome" className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="h-9 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Telefone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="h-9 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data de nascimento</Label>
              <Input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sexo</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feminino">Feminino</SelectItem>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                  <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Endereço</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Cidade, Estado ou endereço completo" className="h-9 text-sm" />
          </div>

          {/* Preference */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Preferência de horário</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_OPTIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    preferredDays.includes(d.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {d.label.replace('-feira', '')}
                </button>
              ))}
            </div>
            <Input value={preferredTime} onChange={e => setPreferredTime(e.target.value)} placeholder="Ex: manhã, tarde, após 14h..." className="h-9 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Por que você busca terapia?</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Conte um pouco sobre o que te motivou a buscar terapia..."
              className="text-sm min-h-[80px] resize-none" />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={submitting || !firstName.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
            Enviar inscrição
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Seus dados serão tratados com sigilo e utilizados apenas para contato terapêutico.
          </p>
        </form>
      </div>
    </div>
  );
}
