import { useState, useEffect } from 'react';
import { UserPlus, Copy, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const APP_URL = 'https://evolucaodiaria.app.br';

interface TeamPublicLinkCardProps {
  organizationId: string;
  isOwnerOrAdmin: boolean;
}

export function TeamPublicLinkCard({ organizationId, isOwnerOrAdmin }: TeamPublicLinkCardProps) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const link = `${APP_URL}/candidatura-equipe/${organizationId}`;

  useEffect(() => {
    let active = true;
    supabase
      .from('organizations')
      .select('applications_link_enabled')
      .eq('id', organizationId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setEnabled(!!(data as any).applications_link_enabled);
        setLoading(false);
      });
    return () => { active = false; };
  }, [organizationId]);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    setEnabled(next);
    const { error } = await supabase
      .from('organizations')
      .update({ applications_link_enabled: next } as any)
      .eq('id', organizationId);
    setSaving(false);
    if (error) {
      setEnabled(!next);
      toast.error('Erro ao atualizar o link');
    } else {
      toast.success(next ? 'Link de candidatura ativado' : 'Link de candidatura desativado');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const handleWhatsApp = () => {
    const message = [
      'Olá!',
      'Para fazer parte da nossa equipe, preencha seu cadastro de funcionário no link abaixo. Após a aprovação, você receberá acesso ao portal:',
      link,
    ].join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserPlus className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Link de cadastro de funcionário</h3>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Compartilhe para que profissionais se cadastrem na equipe e recebam acesso ao portal
            </p>
          </div>
        </div>
        {isOwnerOrAdmin && (
          <div className="flex items-center gap-2">
            <Label className="text-[11px] text-muted-foreground">{enabled ? 'Ativo' : 'Inativo'}</Label>
            <Switch checked={enabled} onCheckedChange={handleToggle} disabled={saving} />
          </div>
        )}
      </div>

      {enabled ? (
        <>
          <div className="flex gap-2">
            <Input readOnly value={link} className="text-xs h-9" />
            <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={handleCopy} title="Copiar link">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              className="shrink-0 h-9 w-9 bg-[#25D366] hover:bg-[#128C7E] text-white border-0"
              onClick={handleWhatsApp}
              title="Compartilhar via WhatsApp"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-success">
            <CheckCircle2 className="w-3 h-3" />
            Cadastros serão revisados manualmente antes do envio do convite.
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Link desativado. Ative para receber novos cadastros de funcionários.
        </p>
      )}
    </div>
  );
}