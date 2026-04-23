import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, UserPlus, CheckCircle2, Mail } from 'lucide-react';

export default function TeamApplicationPublic() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const [orgName, setOrgName] = useState('');
  const [linkEnabled, setLinkEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [role, setRole] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!organizationId) return;
    (supabase.rpc as any)('get_organization_for_application', { _org_id: organizationId })
      .then(({ data }: any) => {
        if (data && data.length > 0) {
          setOrgName(data[0].name);
          setLinkEnabled(!!data[0].applications_link_enabled);
        }
        setLoading(false);
      });
  }, [organizationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !organizationId) {
      toast.error('Preencha nome e e-mail.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('team_applications' as any).insert({
        organization_id: organizationId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: whatsapp.trim() || null,
        role: role.trim() || null,
        birthdate: birthdate || null,
        specialty: specialty.trim() || null,
        professional_id: professionalId.trim() || null,
        message: message.trim() || null,
      } as any);
      if (error) {
        console.error('[team-application] insert error', error);
        throw error;
      }
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar cadastro');
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

  if (!orgName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-md">
          <p className="text-lg font-semibold text-foreground">Link inválido</p>
          <p className="text-sm text-muted-foreground mt-2">Esta página de cadastro não está disponível.</p>
        </div>
      </div>
    );
  }

  if (!linkEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-md space-y-3">
          <p className="text-lg font-semibold text-foreground">Cadastros pausados</p>
          <p className="text-sm text-muted-foreground">
            <strong>{orgName}</strong> não está aceitando novos cadastros de funcionários no momento.
          </p>
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
          <h2 className="text-xl font-bold text-foreground">Cadastro enviado!</h2>
          <p className="text-sm text-muted-foreground">
            Recebemos seu cadastro para fazer parte da equipe de <strong>{orgName}</strong>. A administração
            irá revisar seus dados e, ao aprovar, você receberá um e-mail com o convite e seus dados de acesso ao portal.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
            <Mail className="w-3.5 h-3.5" />
            Fique de olho no seu e-mail: <strong>{email}</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6 space-y-2">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UserPlus className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro de Funcionário</h1>
          <p className="text-sm text-muted-foreground">
            Preencha seus dados para fazer parte da equipe e receber acesso ao portal
          </p>
          <p className="text-xs text-primary font-medium">{orgName}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
          <p className="text-sm font-medium text-foreground">Preencha seus dados</p>

          <div className="space-y-1">
            <Label className="text-xs">Nome completo <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" required className="h-9 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">E-mail <span className="text-destructive">*</span></Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required className="h-9 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">WhatsApp</Label>
            <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" className="h-9 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data de nascimento</Label>
              <Input
                type="date"
                value={birthdate}
                onChange={e => setBirthdate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Função / Cargo desejado</Label>
              <Input
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Ex: Terapeuta, Estagiário, Recepção"
                className="h-9 text-sm"
                maxLength={80}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Especialidade</Label>
              <Input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Ex: Fonoaudiologia" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Registro profissional</Label>
              <Input value={professionalId} onChange={e => setProfessionalId(e.target.value)} placeholder="Ex: CRP 06/12345" className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Mensagem (opcional)</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Conte um pouco sobre sua experiência e por que quer fazer parte da equipe..."
              className="text-sm min-h-[80px] resize-none" />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={submitting || !name.trim() || !email.trim()}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Enviar cadastro
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            Seus dados serão tratados com sigilo. A administração revisará seu cadastro antes de liberar o acesso ao portal.
          </p>
        </form>
      </div>
    </div>
  );
}