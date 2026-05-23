import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { Save, GraduationCap, Users } from 'lucide-react';

interface Props { patientId: string; }

type Escolar = {
  idade_ingresso?: string;
  instituicoes?: string;
  adaptacao?: string;
  repetencias?: string;
  disciplinas_alto?: string;
  disciplinas_baixo?: string;
  queixa_escola?: string;
  avaliacoes_resultados?: string;
  apoio_reforco?: string;
  avaliacoes_anteriores?: string;
  recursos_adaptados?: string;
};

type Familiar = {
  composicao?: string;
  relacao_membros?: string;
  eventos_recentes?: string;
  marcos_desenvolvimento?: string;
  gravidez_parto?: string;
  saude_medicacao?: string;
  local_estudo?: string;
  tempo_tela?: string;
  sono_alimentacao?: string;
};

const tx = (v: string | undefined) => v ?? '';

export function AnamnesePanel({ patientId }: Props) {
  const [escolar, setEscolar] = useState<Escolar>({});
  const [familiar, setFamiliar] = useState<Familiar>({});
  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('psico_anamnese')
        .select('*')
        .eq('patient_id', patientId)
        .maybeSingle();
      if (data) {
        setRecordId(data.id);
        setEscolar((data.escolar as Escolar) || {});
        setFamiliar((data.familiar as Familiar) || {});
      }
      setLoading(false);
    })();
  }, [patientId]);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Sessão expirada'); setSaving(false); return; }
    const payload = { patient_id: patientId, user_id: user.id, escolar, familiar };
    const q = recordId
      ? supabase.from('psico_anamnese').update(payload).eq('id', recordId).select().single()
      : supabase.from('psico_anamnese').insert(payload).select().single();
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
          <h3 className="text-sm font-semibold">Anamnese Psicopedagógica</h3>
          <p className="text-xs text-muted-foreground">Histórico escolar e familiar para fundamentar o diagnóstico.</p>
        </div>
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando…' : 'Salvar anamnese'}
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={['escolar', 'familiar']} className="space-y-3">
        <AccordionItem value="escolar" className="rounded-xl border border-border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-primary" /><span className="font-medium">Anamnese escolar</span></div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <Section title="Histórico escolar">
              <Field label="Idade de ingresso na escola e instituições frequentadas">
                <Input value={tx(escolar.idade_ingresso)} onChange={(e) => setEscolar({ ...escolar, idade_ingresso: e.target.value })} placeholder="Ex: 3 anos — Creche X, Escola Y…" />
              </Field>
              <Field label="Instituições frequentadas (detalhes)">
                <Textarea rows={2} value={tx(escolar.instituicoes)} onChange={(e) => setEscolar({ ...escolar, instituicoes: e.target.value })} />
              </Field>
              <Field label="Adaptação inicial e relações com pares e professores">
                <Textarea rows={3} value={tx(escolar.adaptacao)} onChange={(e) => setEscolar({ ...escolar, adaptacao: e.target.value })} />
              </Field>
              <Field label="Repetências, transferências ou interrupções">
                <Textarea rows={2} value={tx(escolar.repetencias)} onChange={(e) => setEscolar({ ...escolar, repetencias: e.target.value })} />
              </Field>
            </Section>

            <Section title="Desempenho atual">
              <Field label="Disciplinas com maior desempenho">
                <Textarea rows={2} value={tx(escolar.disciplinas_alto)} onChange={(e) => setEscolar({ ...escolar, disciplinas_alto: e.target.value })} />
              </Field>
              <Field label="Disciplinas com menor desempenho">
                <Textarea rows={2} value={tx(escolar.disciplinas_baixo)} onChange={(e) => setEscolar({ ...escolar, disciplinas_baixo: e.target.value })} />
              </Field>
              <Field label="Queixa relatada pela escola (leitura, escrita, atenção, etc.)">
                <Textarea rows={3} value={tx(escolar.queixa_escola)} onChange={(e) => setEscolar({ ...escolar, queixa_escola: e.target.value })} />
              </Field>
              <Field label="Resultado em avaliações internas e externas">
                <Textarea rows={2} value={tx(escolar.avaliacoes_resultados)} onChange={(e) => setEscolar({ ...escolar, avaliacoes_resultados: e.target.value })} />
              </Field>
            </Section>

            <Section title="Apoios recebidos">
              <Field label="Recebe reforço escolar, AEE ou tutoria? Frequência">
                <Textarea rows={2} value={tx(escolar.apoio_reforco)} onChange={(e) => setEscolar({ ...escolar, apoio_reforco: e.target.value })} />
              </Field>
              <Field label="Já realizou avaliações ou tratamentos anteriores?">
                <Textarea rows={2} value={tx(escolar.avaliacoes_anteriores)} onChange={(e) => setEscolar({ ...escolar, avaliacoes_anteriores: e.target.value })} />
              </Field>
              <Field label="Recursos pedagógicos adaptados em uso">
                <Textarea rows={2} value={tx(escolar.recursos_adaptados)} onChange={(e) => setEscolar({ ...escolar, recursos_adaptados: e.target.value })} />
              </Field>
            </Section>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="familiar" className="rounded-xl border border-border bg-card px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><span className="font-medium">Anamnese familiar</span></div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <Section title="Composição familiar">
              <Field label="Configuração da família e responsáveis principais">
                <Textarea rows={3} value={tx(familiar.composicao)} onChange={(e) => setFamiliar({ ...familiar, composicao: e.target.value })} />
              </Field>
              <Field label="Relação entre os membros e clima familiar">
                <Textarea rows={3} value={tx(familiar.relacao_membros)} onChange={(e) => setFamiliar({ ...familiar, relacao_membros: e.target.value })} />
              </Field>
              <Field label="Eventos significativos recentes (mudanças, perdas, separações)">
                <Textarea rows={2} value={tx(familiar.eventos_recentes)} onChange={(e) => setFamiliar({ ...familiar, eventos_recentes: e.target.value })} />
              </Field>
            </Section>

            <Section title="Desenvolvimento">
              <Field label="Marcos motores e de linguagem na primeira infância">
                <Textarea rows={3} value={tx(familiar.marcos_desenvolvimento)} onChange={(e) => setFamiliar({ ...familiar, marcos_desenvolvimento: e.target.value })} />
              </Field>
              <Field label="Histórico de gravidez, parto e primeiros anos">
                <Textarea rows={3} value={tx(familiar.gravidez_parto)} onChange={(e) => setFamiliar({ ...familiar, gravidez_parto: e.target.value })} />
              </Field>
              <Field label="Condições de saúde, uso de medicação e diagnósticos prévios">
                <Textarea rows={3} value={tx(familiar.saude_medicacao)} onChange={(e) => setFamiliar({ ...familiar, saude_medicacao: e.target.value })} />
              </Field>
            </Section>

            <Section title="Rotina e estudos em casa">
              <Field label="Local, horário e supervisão dos estudos">
                <Textarea rows={2} value={tx(familiar.local_estudo)} onChange={(e) => setFamiliar({ ...familiar, local_estudo: e.target.value })} />
              </Field>
              <Field label="Tempo de tela diário e atividades extracurriculares">
                <Textarea rows={2} value={tx(familiar.tempo_tela)} onChange={(e) => setFamiliar({ ...familiar, tempo_tela: e.target.value })} />
              </Field>
              <Field label="Sono, alimentação e hábitos de autocuidado">
                <Textarea rows={2} value={tx(familiar.sono_alimentacao)} onChange={(e) => setFamiliar({ ...familiar, sono_alimentacao: e.target.value })} />
              </Field>
            </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="space-y-3">{children}</div>
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