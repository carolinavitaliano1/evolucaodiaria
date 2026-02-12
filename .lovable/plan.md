

## Rodape Institucional Completo no PDF

### Objetivo
Adicionar campos institucionais na clinica (email, CNPJ, telefone, servicos/especialidades) e exibir todas essas informacoes no rodape do PDF, seguindo o modelo enviado.

### O que muda

**1. Banco de dados -- novos campos na tabela `clinics`**
- `email` (text, nullable) -- email institucional
- `cnpj` (text, nullable) -- CNPJ ou inscricao
- `phone` (text, nullable) -- telefone(s) da clinica
- `services_description` (text, nullable) -- linha descritiva de servicos/especialidades (ex: "Psicologia - Psicopedagogia - Fonoaudiologia")

**2. Tipo `Clinic` em `src/types/index.ts`**
- Adicionar os 4 campos opcionais: `email`, `cnpj`, `phone`, `servicesDescription`

**3. Formulario de edicao da clinica (`EditClinicDialog.tsx`)**
- Adicionar campos de entrada para Email, CNPJ, Telefone e Descricao de Servicos

**4. Mapeamento Supabase nas paginas que carregam clinicas**
- Garantir que `ClinicDetail.tsx`, `AIReports.tsx`, `PatientDetail.tsx` leiam e passem os novos campos

**5. Utilitario PDF (`generateReportPdf.ts`)**
- Ampliar a interface `ReportPdfOptions` com `clinicEmail`, `clinicCnpj`, `clinicPhone`, `clinicServicesDescription`
- Redesenhar o rodape em todas as paginas para exibir (quando disponivel):
  - Linha 1: Descricao dos servicos (ex: "Psicologia - Psicopedagogia - Musicoterapia")
  - Linha 2: CNPJ e inscricoes
  - Linha 3: Endereco completo + telefones
  - Linha 4: Email
  - Linha divisoria sutil acima e numeracao de pagina abaixo

### Secao Tecnica

**Migracao SQL:**
```sql
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS services_description text;
```

**Arquivos modificados:**
- `src/types/index.ts` -- adicionar campos ao tipo Clinic
- `src/components/clinics/EditClinicDialog.tsx` -- formulario com novos inputs
- `src/utils/generateReportPdf.ts` -- rodape expandido com todas as informacoes
- `src/pages/ClinicDetail.tsx` -- passar novos campos ao PDF
- `src/pages/PatientDetail.tsx` -- passar novos campos ao PDF
- `src/pages/AIReports.tsx` -- passar novos campos ao PDF
- Paginas que mapeiam dados da clinica (ex: `Clinics.tsx`, `ClinicDetail.tsx`) -- mapear colunas novas

