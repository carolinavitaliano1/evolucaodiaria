import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  CheckCircle2, Loader2, Building2, AlertTriangle, ClipboardList,
} from 'lucide-react';

export default function Enrollment() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const [clinic, setClinic] = useState<{ name: string; address: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState({
    name: '',
    birthdate: '',
    responsible_name: '',
    whatsapp: '',
    email: '',
  });

  useEffect(() => {
    if (!clinicId) { setNotFound(true); setLoading(false); return; }
    supabase
      .from('clinics')
      .select('name, address')
      .eq('id', clinicId)
      .neq('is_archived', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setClinic(data);
        setLoading(false);
      });
  }, [clinicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.birthdate) {
      toast.error('Preencha o nome e a data de nascimento do paciente');
      return;
    }

    setSubmitting(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/submit-enrollment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
          },
          body: JSON.stringify({
            clinic_id: clinicId,
            name: form.name,
            birthdate: form.birthdate,
            responsible_name: form.responsible_name,
            whatsapp: form.whatsapp,
            email: form.email,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar ficha');

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
            Ficha enviada com sucesso! 🎉
          </h1>

          <p className="text-muted-foreground leading-relaxed mb-6">
            A clínica <strong className="text-foreground">{clinic?.name}</strong> entrará em contato em breve. Seus dados foram recebidos com segurança. 📱
          </p>

          <p className="text-xs text-muted-foreground mb-8">
            Seus dados são tratados com total sigilo e privacidade. 🔒
          </p>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.close()}
          >
            Fechar esta página
          </Button>
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
            Preencha os dados abaixo para enviar sua ficha de cadastro.
          </p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Ficha de Cadastro</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Patient data */}
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
            </div>

            {/* Responsible data */}
            <div className="rounded-xl bg-secondary/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Responsável / Contato</p>

              <div>
                <Label htmlFor="responsible_name">Nome do Responsável</Label>
                <Input
                  id="responsible_name"
                  value={form.responsible_name}
                  onChange={(e) => setForm({ ...form, responsible_name: e.target.value })}
                  placeholder="Ex: Maria Silva"
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

              <div>
                <Label htmlFor="email">E-mail para Contato</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando ficha...</>
              ) : (
                'Enviar Ficha de Cadastro'
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
