import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Building2, AlertTriangle } from 'lucide-react';

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
    reason: '',
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
    if (!form.name.trim() || !form.birthdate) {
      toast.error('Nome e data de nascimento são obrigatórios');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('submit-enrollment', {
        body: { clinic_id: clinicId, ...form },
      });
      if (error) throw error;
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
        <AlertTriangle className="w-12 h-12 text-warning mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Link inválido</h1>
        <p className="text-muted-foreground">Este link de matrícula não existe ou foi desativado.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">Ficha enviada com sucesso! 🎉</h1>
        <p className="text-muted-foreground max-w-sm">
          Sua ficha de matrícula foi recebida. A equipe de <strong>{clinic?.name}</strong> entrará em contato em breve para confirmar os detalhes.
        </p>
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
            Preencha a ficha abaixo para iniciar o processo de matrícula.
          </p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-3xl border border-border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-5">Ficha de Matrícula</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="responsible_name">Nome do Responsável</Label>
              <Input
                id="responsible_name"
                value={form.responsible_name}
                onChange={(e) => setForm({ ...form, responsible_name: e.target.value })}
                placeholder="Ex: Maria Silva (mãe)"
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
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="reason">Motivo da Consulta / O que você busca?</Label>
              <Textarea
                id="reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Descreva brevemente o que motivou buscar atendimento..."
                rows={3}
              />
            </div>

            <Button
              type="submit"
              className="w-full gradient-primary"
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando...</>
              ) : (
                'Enviar Ficha de Matrícula'
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 mb-4">
          Seus dados são tratados com total sigilo e privacidade.
        </p>
      </div>
    </div>
  );
}
