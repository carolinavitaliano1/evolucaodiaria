

## Final Plan

### What changes

**1. `src/pages/Team.tsx` — Redesign the flow**

Two states:

**State A — No active team:**
- Clean page with a centered card: "Ativar Gestão de Equipe para uma clínica"
- Button "Selecionar Clínica" opens a `Dialog` listing all `propria` clinics as selectable cards
- On confirm → creates a new org + links to selected clinic (same logic as `createOrganization` in `ClinicTeam.tsx`) → navigates into team view

**State B — Active team exists:**
- Page shows team panel directly (no selector clutter)
- Header shows: `[UsersRound icon] Gestão de Equipe — [Clinic Name]` + small `"Trocar clínica"` button (only if multiple propria clinics exist)
- Clicking "Trocar clínica" opens an `AlertDialog` listing other clinics to pick from
- On confirm: **nullifies** `organization_id` on the current clinic AND **creates a new org** for the new clinic (old org stays orphaned/archived by losing its clinic link). The new clinic starts fresh with just the owner as member.

**2. `src/pages/ClinicDetail.tsx` — Add WhatsApp tab**

- Add `{ value: 'whatsapp', icon: <MessageSquare />, label: 'WhatsApp', color: 'text-green-500' }` to the tabs array (line ~973)
- Add `<TabsContent value="whatsapp">` rendering `<MessageTemplatesManager />`
- Import `MessageSquare` from lucide (already imported elsewhere) and `MessageTemplatesManager`

**3. `src/pages/Profile.tsx` — Remove WhatsApp section**

- Remove `MessageTemplatesManager` import
- Remove the WhatsApp card section (the Card that wraps `<MessageTemplatesManager />`)

---

### Files

```text
src/pages/Team.tsx            — redesign flow (modal-first activation, swap with new org)
src/pages/ClinicDetail.tsx    — add WhatsApp tab
src/pages/Profile.tsx         — remove WhatsApp card
```

No DB migrations. No new components. Logic already exists.

