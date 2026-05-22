# Teleatendimento no Evolução Diária

Videochamada nativa, gravação opcional e transcrição sob demanda — integrada à agenda e ao prontuário.

## Escopo

**Provedor:** Daily.co (sala embutida via iframe `@daily-co/daily-js`).
**Transcrição:** sob demanda, via ElevenLabs Scribe (PT-BR, separa falantes) ou Gemini do AI Gateway.
**Pontos de acesso:**
- Botão **"Iniciar teleatendimento"** em cada evento da agenda (quando o paciente é atendido pelo terapeuta dono daquele evento).
- Aba **"Teleatendimento"** no prontuário do paciente com histórico de sessões, gravações e transcrições.
**Gating:** disponível apenas para usuários do plano **Pro** que atendam em clínicas do tipo **Consultório** ou **Contratante** (não liberado para perfis ligados a "Clínica Pro").

## Fluxo do terapeuta

1. Abre o evento da agenda → clica **"Iniciar teleatendimento"**.
2. Modal aparece com:
   - Checkbox **"Gravar esta sessão"** (desmarcado por padrão).
   - Aviso LGPD: "O paciente deve consentir explicitamente antes de iniciar a gravação."
   - Botão **"Copiar link do paciente"** (link único da sala) — pode ser enviado pelo WhatsApp ou aparecer no portal do paciente automaticamente.
3. Sala abre em tela cheia dentro do app (iframe Daily). Controles: mic, câmera, compartilhar tela, encerrar.
4. Ao encerrar, se gravou: arquivo fica disponível na aba "Teleatendimento" do paciente em ~1–2 min.
5. Na lista de gravações: botão **"Transcrever"** (consome créditos), **"Baixar áudio"**, **"Excluir"**.
6. Transcrição pronta vira card com texto editável + botão **"Gerar evolução com IA a partir da transcrição"** (reaproveita o assistente já existente).

## Fluxo do paciente

- Recebe um link único (sem precisar de login): `https://evolucaodiaria.app.br/teleatendimento/:token`.
- Página minimalista, lilás, com: nome do terapeuta, botão "Entrar na sala", aviso de gravação (se ativa) + checkbox de consentimento obrigatório quando gravando.
- Sem instalação. Funciona no navegador do celular.

## Banco de dados (3 tabelas novas)

- **video_sessions** — uma linha por chamada. Campos relevantes: `appointment_id`, `patient_id`, `therapist_user_id`, `clinic_id`, `daily_room_name`, `daily_room_url`, `patient_access_token`, `status` (`scheduled`/`active`/`ended`), `recording_enabled`, `patient_consented_at`, `started_at`, `ended_at`.
- **video_recordings** — uma linha por gravação. Campos: `video_session_id`, `daily_recording_id`, `download_url` (assinada e renovada), `duration_seconds`, `file_size_bytes`, `status`.
- **video_transcriptions** — uma linha por transcrição solicitada. Campos: `recording_id`, `status` (`processing`/`done`/`error`), `language`, `text`, `speakers_json`, `provider` (`elevenlabs`/`gemini`).
- **RLS:** terapeuta dono + organização (mesma regra de `evolutions`). Paciente nunca acessa a tabela — só recebe o link de sala via token público.

## Edge Functions (4 novas)

- **`create-video-room`** — recebe `appointment_id` + `record: boolean`. Cria sala no Daily, gera token de paciente, grava em `video_sessions`. Bloqueia se plano ≠ Pro ou clínica = "Clínica Pro".
- **`daily-webhook`** — recebe eventos do Daily (`recording.ready-to-download`, `meeting.ended`) e atualiza `video_recordings`/`video_sessions`.
- **`transcribe-recording`** — recebe `recording_id`, baixa o áudio do Daily, manda pro ElevenLabs Scribe, salva em `video_transcriptions`.
- **`get-recording-url`** — gera URL assinada de download (válida 1h) on-demand para terapeuta autorizado.

## Frontend (componentes novos)

- `src/pages/Telehealth.tsx` — página pública do paciente (`/teleatendimento/:token`).
- `src/components/telehealth/TelehealthRoom.tsx` — wrapper do `<DailyIframe>` para terapeuta.
- `src/components/telehealth/StartTelehealthDialog.tsx` — modal "Iniciar teleatendimento".
- `src/components/patients/TelehealthTab.tsx` — aba no prontuário com histórico, transcrições e geração de evolução.
- Integração no `EventDialog.tsx` da agenda: novo botão visível só quando elegível.

## Gating de plano (Pro + Consultório/Contratante)

- Hook novo `useTelehealthAccess()` retorna `{ enabled, reason }`.
- Lógica: `subscription.plan === 'pro'` **E** clínica atual `clinic.type IN ('consultorio','contratante')`.
- Owners (e-mails hardcoded) sempre `enabled = true`.
- Quando `enabled = false`, botão fica desabilitado com tooltip "Disponível no plano Pro (Consultório/Contratante)".

## Segurança & LGPD

- Consentimento do paciente armazenado em `patient_consented_at` (carimbado quando ele clica no checkbox).
- Gravações nunca ficam públicas — sempre URL assinada de 1h.
- Botão "Excluir gravação" sempre disponível (cumpre LGPD).
- Aviso visível na sala: "Esta sessão está sendo gravada" quando ativo.

## Custos

- Daily.co: 10.000 min/mês grátis no plano deles, depois ~$0,004/participante/min.
- ElevenLabs Scribe: ~$0,40/hora de áudio (PT-BR, com diarização).
- Os dois rodam **só** para o plano Pro Consultório/Contratante, então o custo fica contido.

## Pré-requisitos (peço ao usuário)

1. Criar conta gratuita em [daily.co](https://www.daily.co) → pegar `DAILY_API_KEY` e `DAILY_DOMAIN`.
2. Criar conta em [elevenlabs.io](https://elevenlabs.io) → pegar `ELEVENLABS_API_KEY` (ou usar Gemini do AI Gateway, sem custo extra para você — mas qualidade de diarização é menor).

## Ordem de entrega

**Fase 1 — Vídeo funcional (sem gravação):** tabelas, `create-video-room`, modal, sala, página pública, gating. (Entrega rápida, dá pra testar de cara.)
**Fase 2 — Gravação:** webhook do Daily, listagem na aba, download assinado, consentimento.
**Fase 3 — Transcrição:** botão "Transcrever", `transcribe-recording`, visualização + edição.
**Fase 4 — Integração com IA de evolução:** botão "Gerar evolução a partir da transcrição" reaproveitando `generate-evolution`.

## Detalhes técnicos

- Dependência nova: `@daily-co/daily-js` (~120kb gzip, lazy-loaded só na rota de teleatendimento).
- Webhook Daily configurado apontando para `https://uhhpnjyceobdcxqviouy.supabase.co/functions/v1/daily-webhook` (sem JWT).
- Edge functions usam `npm:@daily-co/daily-js` e validam JWT do terapeuta.
- Transcrição salva chunks de fala com timestamps + label do speaker, para virar evolução estruturada.

---

**Confirma e eu começo pela Fase 1?** Vou pedir as duas chaves (`DAILY_API_KEY` + `ELEVENLABS_API_KEY`) assim que aprovar — sem elas não dá pra subir nem o esqueleto.
