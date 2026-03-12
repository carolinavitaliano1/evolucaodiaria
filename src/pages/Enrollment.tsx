import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  CheckCircle2, Loader2, Building2, AlertTriangle, UserPlus, Eye, EyeOff,
} from 'lucide-react';

export default function Enrollment() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const navigate = useNavigate();
  const [clinic, setClinic] = useState<{ name: string; address: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    birthdate: '',
    whatsapp: '',
  });

  useEffect(() => {
    if (!clinicId) { setNotFound(true); setLoading(false); return; }
    supabase
      .from('clinics')
      .select('name, address')
      .eq('id', clinicId)
      .eq('is_archived', false)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setClinic(data);
        setLoading(false);
      });
  }, [clinicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.birthdate || !form.email || !form.password) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (form.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setSubmitting(true);
    try {
      // PASSO A: Criar conta de autenticação
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { name: form.name },
          emailRedirectTo: `${window.location.origin}/portal/auth`,
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')) {
          toast.error('Este e-mail já possui uma conta. Acesse o portal para entrar.');
        } else {
          throw signUpError;
        }
        setSubmitting(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) throw new Error('Erro ao criar conta. Tente novamente.');

      // PASSO B: Inserir paciente com status Pendente
      const { error: insertError } = await supabase.from('patients').insert({
        user_id: userId,
        clinic_id: clinicId!,
        name: form.name,
        birthdate: form.birthdate,
        whatsapp: form.whatsapp || null,
        email: form.email,
        status: 'pendente',
      });

      if (insertError) throw insertError;

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
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
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Link inválido</h1>
        <p className="text-muted-foreground">Este link de cadastro não existe ou foi desativado.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-background p-6 text-center">
        <div className="max-w-sm w-full">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-primary" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-3">
            Cadastro realizado com sucesso! 🎉
          </h1>

          <p className="text-muted-foreground leading-relaxed mb-6">
            A clínica <strong className="text-foreground">{clinic?.name}</strong> analisará sua ficha e em breve seu portal estará totalmente liberado. Fique de olho no e-mail e WhatsApp informados. 📱
          </p>

          <p className="text-xs text-muted-foreground mb-6">
            Você receberá um e-mail de confirmação. Após a ativação, acesse o portal com o e-mail e senha que você cadastrou.
          </p>

          <Button
            className="w-full"
            onClick={() => navigate('/portal/auth')}
          >
            Ir para o Portal do Paciente
          </Button>

          <p className="text-xs text-muted-foreground mt-6">
            Seus dados são tratados com total sigilo e privacidade. 🔒
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{clinic?.name}</h1>
          {clinic?.address && (
            <p className="text-sm text-muted-foreground mt-1">{clinic.address}</p>
          )}
          <p className="text-muted-foreground mt-3 text-sm">
            Bem-vindo! Crie seu acesso para preencher a ficha de matrícula.
          </p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Criar Conta e Enviar Ficha</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Auth section */}
            <div className="rounded-xl bg-secondary/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados de Acesso</p>

              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <Label htmlFor="password">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Use este e-mail e senha para acessar o portal depois.</p>
              </div>
            </div>

            {/* Patient data section */}
            <div className="rounded-xl bg-secondary/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Paciente</p>

              <div>
                <Label htmlFor="name">Nome Completo do Paciente *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: João Pedro Silva"
                  required
                />
              </div>

              <div>
                <Label htmlFor="birthdate">Data de Nascimento *</Label>
                <Input
                  id="birthdate"
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="whatsapp">WhatsApp para Contato</Label>
                <Input
                  id="whatsapp"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="(11) 99999-9999"
                  type="tel"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Criando conta...</>
              ) : (
                'Criar Conta e Enviar Ficha'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 mb-4">
          Seus dados são tratados com total sigilo e privacidade. 🔒
        </p>
      </div>
    </div>
  );
}
