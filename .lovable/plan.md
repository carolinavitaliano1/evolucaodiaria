
# Plano: Rebranding + Persistencia de Tipos + Integração Stripe

## Resumo

Quatro frentes de trabalho: renomear o app para "Evolução Diária" com novo ícone, persistir tipos de serviço personalizados no banco, e integrar o Stripe para planos de assinatura com teste gratuito de 30 dias.

---

## 1. Renomear App para "Evolução Diária" e Trocar Logo

- Substituir todas as ocorrências de "Clini Pro" por "Evolução Diária" em:
  - `src/components/layout/AppSidebar.tsx`
  - `src/pages/Auth.tsx` (2 ocorrências)
  - `index.html` (title e meta tags)
- Trocar o ícone `Stethoscope` por `BookOpen` (lucide-react) em todos os locais acima, representando um caderno/diário

---

## 2. Persistir Tipos Personalizados de Serviço

**Banco de dados:** Criar tabela `custom_service_types` com colunas:
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `name` (text, NOT NULL)
- `created_at` (timestamptz, default now())

Com políticas RLS para CRUD restrito ao próprio usuário.

**Código:** Atualizar `ServiceDialog.tsx` para:
- Carregar tipos personalizados do banco ao abrir o dialog
- Salvar novos tipos na tabela ao clicar "Adicionar"
- Exibir tipos salvos no dropdown junto com os pré-definidos

---

## 3. Integração Stripe - Planos de Assinatura

Habilitar o Stripe no projeto (será solicitada a chave secreta) e criar:

**Planos:**
| Plano | Período | Preço | Trial |
|-------|---------|-------|-------|
| Mensal | 1 mês | R$29,00 | 30 dias grátis |
| Bimestral | 2 meses | R$49,00 | 30 dias grátis |
| Trimestral | 3 meses | R$59,00 | 30 dias grátis |

**Implementação:**
- Criar página `/pricing` com cards dos planos
- Edge function para criar checkout session do Stripe com trial de 30 dias
- Edge function webhook para processar eventos do Stripe
- Lógica de verificação de assinatura ativa para proteger rotas (opcional, pode ser adicionado depois)

---

## Detalhes Técnicos

### Migração SQL
```sql
CREATE TABLE custom_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE custom_service_types ENABLE ROW LEVEL SECURITY;
-- Políticas RLS padrão (SELECT, INSERT, DELETE para auth.uid() = user_id)
```

### Arquivos Modificados
- `index.html` - titulo e meta tags
- `src/components/layout/AppSidebar.tsx` - nome e ícone
- `src/pages/Auth.tsx` - nome e ícone
- `src/components/services/ServiceDialog.tsx` - persistência de tipos

### Arquivos Novos
- `src/pages/Pricing.tsx` - página de planos
- Edge functions para Stripe (checkout, webhook)

### Ordem de Execução
1. Migração do banco (custom_service_types)
2. Rebranding (nome + logo)
3. Persistência dos tipos de serviço
4. Habilitar Stripe e implementar planos
