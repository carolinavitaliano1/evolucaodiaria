
## Como funcionaria um modelo multidisciplinar no app

A estrutura atual já é quase toda compatível — clínicas, pacientes, evoluções, templates e carimbos são por usuário. O que falta é suporte para **múltiplos profissionais dentro de uma mesma clínica**, cada um com seu próprio acesso, carimbos e evoluções, mas compartilhando a base de pacientes.

---

### O que precisaria ser adicionado (sem remover nada)

```
ESTRUTURA ATUAL                    ESTRUTURA MULTIDISCIPLINAR
─────────────────────────          ─────────────────────────────────
usuário único → clínica            organização → clínica → membros
usuário único → pacientes          pacientes compartilhados por clínica
usuário único → evoluções          evoluções com "autor" (profissional)
```

**1. Organizações / Equipes**
- Nova tabela `organizations` — uma clínica multidisciplinar seria uma organização
- Nova tabela `organization_members` — com papéis: `owner`, `admin`, `professional`
- O dono convida outros usuários via e-mail

**2. Pacientes compartilhados**
- Pacientes passariam a ser da organização, não só do usuário
- Cada profissional vê os pacientes da clínica, não só os seus
- Permissões por papel: quem pode criar/editar/arquivar

**3. Evoluções por profissional**
- Cada evolução já tem `user_id` — continuaria funcionando como "autor"
- Na visualização, apareceria o nome do profissional que registrou
- Carimbo automático do profissional logado

**4. Templates por organização**
- Templates criados pelo dono ficam disponíveis para toda a equipe
- Cada profissional ainda pode ter seus próprios templates pessoais

**5. Financeiro separado por profissional**
- Cada membro vê seus próprios recebimentos
- O dono/admin vê o consolidado de todos

---

### Impacto no que já existe

| Funcionalidade atual | Impacto |
|---|---|
| Clínica própria (terapeuta solo) | Zero — continua igual |
| Templates de evolução | Zero — apenas compartilhamento opcional |
| Carimbos pessoais | Zero — cada membro tem os seus |
| Exportação PDF | Pequena — adicionar nome do profissional no rodapé |
| Dashboard | Pequena — filtro por membro |

O terapeuta solo continua usando o app exatamente como hoje. O modo multidisciplinar seria **opt-in** — ao criar uma clínica, escolheria entre "uso individual" ou "equipe multidisciplinar".

---

### Implementação em fases

**Fase 1** — Convite e membros
- Tabelas `organizations` e `organization_members`
- Fluxo de convite por e-mail
- Papéis: dono, admin, profissional

**Fase 2** — Dados compartilhados
- Pacientes e evoluções vinculados à organização
- Filtros por profissional na agenda e evoluções

**Fase 3** — Financeiro consolidado
- Relatórios por membro e consolidado para o admin

---

Quer que eu implemente isso? Posso começar pela Fase 1 (estrutura de equipe e convites) mantendo tudo que existe intacto para usuários solo.
