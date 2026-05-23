import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Save, Activity, Users } from 'lucide-react';

interface Props { patientId: string; }

type Motor = {
  marcos_motores?: string;
  tonus_postura?: string;
  coordenacao_global?: string;
  coordenacao_fina?: string;
  equilibrio?: string;
  lateralidade?: string;
  esquema_corporal?: string;
  orientacao_espacial?: string;
  orientacao_temporal?: string;
  praxias?: string;
  queixa_principal?: string;
};

type Familiar = {
  composicao?: string;
  gravidez_parto?: string;
  marcos_desenvolvimento?: string;
  saude_medicacao?: string;
  rotina_atividades?: string;
  tempo_tela?: string;
  sono_alimentacao?: string;
  eventos_recentes?: string;
};

const tx = (v: string | undefined) => v ?? '';

export function AnamnesePanel({ patientId }: Props) {
  const [motor, setMotor] = useState<Motor>({});
  const [familiar, setFamiliar] = useState<Familiar>({});
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('psicom_anamnese')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle();
      if (data) {
        setRecordId(data.id);
        setMotor((data.motor as Motor) || {});
        setFamiliar((data.familiar as Familiar) || {});
      }
      setLoading(false);
    })();
  }, [patientId]);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Sessão expirada'); setSaving(false); return; }
    const payload = { patient_id: patientId, user_id: user.id, motor, familiar };
    const q = recordId
      ? supabase.from('psicom_anamnese').update(payload).eq('id', recordId).select().single()
      : supabase.from('psicom_anamnese').insert(payload).select().single();
    const { data, error } = await q;
    if (error) toast.error('Erro ao salvar anamnese');
    else { toast.success('Anamnese salva'); if (data) setRecordId(data.id); }
    setSaving(false);
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Anamnese Psicomotora</h3>
          <p className="text-xs text-muted-foreground">Histórico motor e familiar para fundamentar a avaliação.</p>
        </div>
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando…' : 'Salvar anamnese'}
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={['motor', 'familiar']} className="space-y-3">
        <AccordionItem value="motor" className="rounded-xl border border-border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /><span className="font-medium">Anamnese motora</span></div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <Field label="Queixa principal e motivo da procura">
              <Textarea rows={3} value={tx(motor.queixa_principal)} onChange={(e) => setMotor({ ...motor, queixa_principal: e.target.value })} />
            </Field>
            <Field label="Marcos motores (sustentou cabeça, sentou, engatinhou, andou)">
              <Textarea rows={3} value={tx(motor.marcos_motores)} onChange={(e) => setMotor({ ...motor, marcos_motores: e.target.value })} />
            </Field>
            <Field label="Tônus e postura">
              <Textarea rows={2} value={tx(motor.tonus_postura)} onChange={(e) => setMotor({ ...motor, tonus_postura: e.target.value })} />
            </Field>
            <Field label="Coordenação motora global">
              <Textarea rows={2} value={tx(motor.coordenacao_global)} onChange={(e) => setMotor({ ...motor, coordenacao_global: e.target.value })} />
            </Field>
            <Field label="Coordenação motora fina">
              <Textarea rows={2} value={tx(motor.coordenacao_fina)} onChange={(e) => setMotor({ ...motor, coordenacao_fina: e.target.value })} />
            </Field>
            <Field label="Equilíbrio estático e dinâmico">
              <Textarea rows={2} value={tx(motor.equilibrio)} onChange={(e) => setMotor({ ...motor, equilibrio: e.target.value })} />
            </Field>
            <Field label="Lateralidade (definida, cruzada, em definição)">
              <Input value={tx(motor.lateralidade)} onChange={(e) => setMotor({ ...motor, lateralidade: e.target.value })} placeholder="Ex.: destro homogêneo" />
            </Field>
            <Field label="Esquema corporal">
              <Textarea rows={2} value={tx(motor.esquema_corporal)} onChange={(e) => setMotor({ ...motor, esquema_corporal: e.target.value })} />
            </Field>
            <Field label="Orientação espacial">
              <Textarea rows={2} value={tx(motor.orientacao_espacial)} onChange={(e) => setMotor({ ...motor, orientacao_espacial: e.target.value })} />
            </Field>
            <Field label="Orientação temporal e ritmo">
              <Textarea rows={2} value={tx(motor.orientacao_temporal)} onChange={(e) => setMotor({ ...motor, orientacao_temporal: e.target.value })} />
            </Field>
            <Field label="Praxias (ideomotora, construtiva, manual)">
              <Textarea rows={2} value={tx(motor.praxias)} onChange={(e) => setMotor({ ...motor, praxias: e.target.value })} />
            </Field>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="familiar" className="rounded-xl border border-border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><span className="font-medium">Anamnese familiar</span></div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <Field label="Composição familiar e responsáveis principais">
              <Textarea rows={3} value={tx(familiar.composicao)} onChange={(e) => setFamiliar({ ...familiar, composicao: e.target.value })} />
            </Field>
            <Field label="Gestação, parto e primeiros anos">
              <Textarea rows={3} value={tx(familiar.gravidez_parto)} onChange={(e) => setFamiliar({ ...familiar, gravidez_parto: e.target.value })} />
            </Field>
            <Field label="Marcos do desenvolvimento (linguagem, social, cognitivo)">
              <Textarea rows={3} value={tx(familiar.marcos_desenvolvimento)} onChange={(e) => setFamiliar({ ...familiar, marcos_desenvolvimento: e.target.value })} />
            </Field>
            <Field label="Condições de saúde, medicação e diagnósticos prévios">
              <Textarea rows={3} value={tx(familiar.saude_medicacao)} onChange={(e) => setFamiliar({ ...familiar, saude_medicacao: e.target.value })} />
            </Field>
            <Field label="Rotina e atividades físicas/esportivas">
              <Textarea rows={2} value={tx(familiar.rotina_atividades)} onChange={(e) => setFamiliar({ ...familiar, rotina_atividades: e.target.value })} />
            </Field>
            <Field label="Tempo de tela diário">
              <Textarea rows={2} value={tx(familiar.tempo_tela)} onChange={(e) => setFamiliar({ ...familiar, tempo_tela: e.target.value })} />
            </Field>
            <Field label="Sono, alimentação e hábitos de autocuidado">
              <Textarea rows={2} value={tx(familiar.sono_alimentacao)} onChange={(e) => setFamiliar({ ...familiar, sono_alimentacao: e.target.value })} />
            </Field>
            <Field label="Eventos significativos recentes (mudanças, perdas)">
              <Textarea rows={2} value={tx(familiar.eventos_recentes)} onChange={(e) => setFamiliar({ ...familiar, eventos_recentes: e.target.value })} />
            </Field>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando…' : 'Salvar anamnese'}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}