import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Lock, ShieldCheck, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PermissionEditor } from '@/components/clinics/PermissionEditor';
import { PRESET_ROLES, PermissionKey } from '@/hooks/useOrgPermissions';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RoleId =
  | 'admin'
  | 'professional_full'
  | 'professional_limited'
  | 'secretary'
  | 'financial_full'
  | 'financial_individual'
  | 'financial_query'
  | 'marketing'
  | 'auditor';

interface RoleOption {
  id: RoleId;
  title: string;
  description: string;
  group?: 'professional';
}

export const ROLE_OPTIONS: RoleOption[] = [
  { id: 'admin', title: 'Administrador', description: 'Acesso total ao sistema, equipe, financeiro, relatórios e atendimentos de todos os profissionais.' },
  { id: 'professional_full', title: 'Profissional · Completo', description: 'Acesso a agenda, pacientes e a seus atendimentos.', group: 'professional' },
  { id: 'professional_limited', title: 'Profissional · Limitado', description: 'Apenas visualiza sua agenda e registra atendimentos sujeitos a aprovação.', group: 'professional' },
  { id: 'secretary', title: 'Secretária(o)', description: 'Gerencia agenda e cadastro de pacientes. Não acessa conteúdo clínico.' },
  { id: 'financial_full', title: 'Financeiro completo', description: 'Acesso total aos recursos financeiros da clínica.' },
  { id: 'financial_individual', title: 'Financeiro individual', description: 'Acesso financeiro restrito aos próprios pacientes vinculados.' },
  { id: 'financial_query', title: 'Financeiro consulta', description: 'Apenas consulta de comissões e movimentos. Não altera nem exclui.' },
  { id: 'marketing', title: 'Marketing', description: 'Acesso a marketing, página da clínica, pesquisa de satisfação e dados não sensíveis.' },
  { id: 'auditor', title: 'Auditor/Fiscal', description: 'Somente leitura de atendimentos e relatórios para auditoria. Não combina com outras funções.' },
];

/** Mapeia o roleId da UI para o preset correspondente em PRESET_ROLES */
const ROLE_TO_PRESET: Record<RoleId, string> = {
  admin: 'administrador',
  professional_full: 'terapeuta',
  professional_limited: 'terapeuta',
  secretary: 'secretaria',
  financial_full: 'financeiro_completo',
  financial_individual: 'financeiro_individual',
  financial_query: 'financeiro_consulta',
  marketing: 'marketing',
  auditor: 'auditor_fiscal',
};

/** Mapeia roleId da UI para o backend (organization_members.role) */
export function mapRoleToBackend(roleId: RoleId): { role: 'admin' | 'professional'; role_label: string } {
  const opt = ROLE_OPTIONS.find(r => r.id === roleId)!;
  if (roleId === 'admin' || roleId === 'financial_full' || roleId === 'secretary') {
    return { role: 'admin', role_label: opt.title };
  }
  return { role: 'professional', role_label: opt.title };
}

// ─────────────────────────────────────────────────────────────────────────────
// Granular toggle keys (5 perguntas)
// ─────────────────────────────────────────────────────────────────────────────

export interface GranularToggles {
  canEditPatients: boolean;       // patients.archive + patients.edit
  canDeleteAppointments: boolean; // appointments.delete_own
  canEditEvolutions: boolean;     // evaluations.edit + evolutions.edit
  canTranscribeAudio: boolean;    // audio.transcribe
  canApproveLimited: boolean;     // limited.approve
}

export interface ToggleLocks {
  canEditPatients?: boolean;
  canDeleteAppointments?: boolean;
  canEditEvolutions?: boolean;
  canTranscribeAudio?: boolean;
  canApproveLimited?: boolean;
}

/** Defaults + locks aplicados pela função selecionada */
export function getRolePermissionDefaults(roleId: RoleId): {
  toggles: GranularToggles;
  locks: ToggleLocks;
} {
  switch (roleId) {
    case 'admin':
      return {
        toggles: { canEditPatients: true, canDeleteAppointments: true, canEditEvolutions: true, canTranscribeAudio: true, canApproveLimited: true },
        locks:   { canEditPatients: true, canDeleteAppointments: true, canEditEvolutions: true, canTranscribeAudio: true, canApproveLimited: true },
      };
    case 'professional_full':
      return {
        toggles: { canEditPatients: true, canDeleteAppointments: true, canEditEvolutions: true, canTranscribeAudio: true, canApproveLimited: false },
        locks:   {},
      };
    case 'professional_limited':
      return {
        toggles: { canEditPatients: false, canDeleteAppointments: false, canEditEvolutions: false, canTranscribeAudio: true, canApproveLimited: false },
        locks:   { canApproveLimited: true }, // limitado nunca aprova
      };
    case 'secretary':
      return {
        toggles: { canEditPatients: true, canDeleteAppointments: false, canEditEvolutions: false, canTranscribeAudio: false, canApproveLimited: false },
        locks:   { canEditEvolutions: true, canApproveLimited: true },
      };
    case 'financial_full':
    case 'financial_individual':
    case 'financial_query':
    case 'marketing':
    case 'auditor':
      return {
        toggles: { canEditPatients: false, canDeleteAppointments: false, canEditEvolutions: false, canTranscribeAudio: false, canApproveLimited: false },
        locks:   { canEditPatients: true, canDeleteAppointments: true, canEditEvolutions: true, canTranscribeAudio: true, canApproveLimited: true },
      };
  }
}

/** Permissões base (módulos) que vêm do PRESET_ROLES */
function getBasePermissionsForRole(roleId: RoleId): PermissionKey[] {
  const presetId = ROLE_TO_PRESET[roleId];
  const preset = PRESET_ROLES.find(p => p.id === presetId);
  const perms = preset ? [...preset.permissions] : [];
  if (roleId === 'professional_limited' && !perms.includes('professional.limited')) {
    perms.push('professional.limited');
  }
  return perms;
}

/** Junta permissões base (módulos) + toggles granulares em um único array de PermissionKey */
export function buildPermissionsArray(
  roleId: RoleId,
  toggles: GranularToggles,
  modulePermissions: PermissionKey[],
): PermissionKey[] {
  // Começa com as permissões customizadas dos módulos (vindas do PermissionEditor avançado)
  const set = new Set<PermissionKey>(modulePermissions);

  // Limpa todas as chaves granulares e reaplica conforme toggles
  const granularKeys: PermissionKey[] = [
    'professional.limited',
    'patients.archive',
    'appointments.delete_own',
    'evaluations.edit',
    'audio.transcribe',
    'limited.approve',
  ];
  granularKeys.forEach(k => set.delete(k));

  if (roleId === 'professional_limited') set.add('professional.limited');
  if (toggles.canEditPatients) set.add('patients.archive');
  if (toggles.canDeleteAppointments) set.add('appointments.delete_own');
  if (toggles.canEditEvolutions) set.add('evaluations.edit');
  if (toggles.canTranscribeAudio) set.add('audio.transcribe');
  if (toggles.canApproveLimited) set.add('limited.approve');

  return Array.from(set);
}

/** Lê toggles a partir de um array de permissões existente */
export function readTogglesFromPermissions(perms: PermissionKey[]): GranularToggles {
  return {
    canEditPatients: perms.includes('patients.archive') || perms.includes('patients.edit'),
    canDeleteAppointments: perms.includes('appointments.delete_own'),
    canEditEvolutions: perms.includes('evaluations.edit') || perms.includes('evolutions.edit'),
    canTranscribeAudio: perms.includes('audio.transcribe'),
    canApproveLimited: perms.includes('limited.approve'),
  };
}

/** Inicialização padrão para um roleId */
export function getInitialStateForRole(roleId: RoleId): { toggles: GranularToggles; modulePermissions: PermissionKey[] } {
  return {
    toggles: getRolePermissionDefaults(roleId).toggles,
    modulePermissions: getBasePermissionsForRole(roleId),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  roleId: RoleId;
  onRoleChange: (r: RoleId) => void;
  toggles: GranularToggles;
  onTogglesChange: (t: GranularToggles) => void;
  modulePermissions: PermissionKey[];
  onModulePermissionsChange: (p: PermissionKey[]) => void;
  /** se true, esconde o card wrapper (usado no modal de edição) */
  embedded?: boolean;
}

export default function UserAccessPermissions({
  roleId,
  onRoleChange,
  toggles,
  onTogglesChange,
  modulePermissions,
  onModulePermissionsChange,
  embedded = false,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const locks = getRolePermissionDefaults(roleId).locks;

  // Quando muda a função, recalcula toggles + permissões base dos módulos
  // e mostra um aviso curto.
  useEffect(() => {
    const init = getInitialStateForRole(roleId);
    onTogglesChange(init.toggles);
    onModulePermissionsChange(init.modulePermissions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  // Coerência: se o usuário virar Limitado, força "aprovar limitados" para Não
  useEffect(() => {
    if (roleId === 'professional_limited' && toggles.canApproveLimited) {
      onTogglesChange({ ...toggles, canApproveLimited: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  function setToggle<K extends keyof GranularToggles>(key: K, value: boolean) {
    if (locks[key]) return; // locked
    onTogglesChange({ ...toggles, [key]: value });
  }

  const isLimited = roleId === 'professional_limited';

  const content = (
    <div className="space-y-4">
      {/* Função */}
      <div>
        <p className="text-sm font-medium mb-2">Função <span className="text-destructive">*</span></p>
        <RadioGroup value={roleId} onValueChange={(v) => onRoleChange(v as RoleId)} className="space-y-2">
          {ROLE_OPTIONS.filter(o => !o.group).map(opt => (
            <RoleRow key={opt.id} opt={opt} selected={roleId === opt.id} onSelect={() => onRoleChange(opt.id)} />
          ))}

          {/* Profissional grouping */}
          <div className={cn(
            'rounded-lg border-2 transition-all',
            (roleId === 'professional_full' || roleId === 'professional_limited') ? 'border-primary/40 bg-primary/5' : 'border-border'
          )}>
            <div className="px-3 py-2.5">
              <p className="text-sm font-semibold">Profissional</p>
              <p className="text-xs text-muted-foreground">Tipo de profissional:</p>
            </div>
            <Separator />
            <div className="p-2 space-y-1">
              {ROLE_OPTIONS.filter(o => o.group === 'professional').map(opt => (
                <SubRoleRow key={opt.id} opt={opt} selected={roleId === opt.id} onSelect={() => onRoleChange(opt.id)} />
              ))}
            </div>
          </div>
        </RadioGroup>
      </div>

      <Separator />

      {/* 5 toggles granulares */}
      <div className="space-y-2">
        <ToggleRow
          title="Pode editar ou arquivar pacientes?"
          description="Controla a edição de dados cadastrais e o arquivamento de pacientes."
          value={toggles.canEditPatients}
          locked={!!locks.canEditPatients}
          onChange={(v) => setToggle('canEditPatients', v)}
        />
        <ToggleRow
          title="Pode excluir atendimentos?"
          description="Permite que este usuário possa excluir atendimentos registrados por ele."
          value={toggles.canDeleteAppointments}
          locked={!!locks.canDeleteAppointments}
          onChange={(v) => setToggle('canDeleteAppointments', v)}
        />
        <ToggleRow
          title="Pode editar avaliações e evoluções?"
          description="Permite que este usuário possa editar avaliações e evoluções."
          value={toggles.canEditEvolutions}
          locked={!!locks.canEditEvolutions}
          onChange={(v) => setToggle('canEditEvolutions', v)}
        />
      </div>

      {isLimited && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-snug">
            Atendimentos deste usuário precisam ser aprovados por um profissional completo ou administrador.
          </p>
        </div>
      )}

      <Separator />

      {/* Avançado: módulos */}
      <div className="rounded-lg border bg-muted/20">
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Personalizar módulos avançados</p>
              <p className="text-xs text-muted-foreground">Clínico, Financeiro, Agenda, IA, Relatórios — para ajuste fino.</p>
            </div>
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showAdvanced && (
          <div className="px-3 pb-4 pt-1">
            <PermissionEditor
              permissions={modulePermissions}
              onChange={onModulePermissionsChange}
              excludeGroups={['Perfil profissional']}
            />
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onModulePermissionsChange(getBasePermissionsForRole(roleId))}
              >
                Restaurar padrão da função
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Personalize as permissões de acesso aos recursos</CardTitle>
        <CardDescription>Selecione a função e ajuste as permissões granulares.</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub components
// ─────────────────────────────────────────────────────────────────────────────

function RoleRow({ opt, selected, onSelect }: { opt: RoleOption; selected: boolean; onSelect: () => void }) {
  return (
    <label
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/30'
      )}
    >
      <RadioGroupItem value={opt.id} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{opt.title}</p>
        <p className="text-xs text-muted-foreground leading-snug">{opt.description}</p>
      </div>
    </label>
  );
}

function SubRoleRow({ opt, selected, onSelect }: { opt: RoleOption; selected: boolean; onSelect: () => void }) {
  return (
    <label
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 p-2.5 rounded-md border cursor-pointer transition-all',
        selected ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted/40'
      )}
    >
      <RadioGroupItem value={opt.id} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{opt.title}</p>
        <p className="text-xs text-muted-foreground leading-snug">{opt.description}</p>
      </div>
    </label>
  );
}

function ToggleRow({
  title, description, value, locked, onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  locked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-4 p-3 rounded-lg border',
      locked ? 'bg-muted/40 opacity-90' : 'bg-muted/20'
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {locked && <Lock className="w-3 h-3 text-muted-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground leading-snug">{description}</p>
        {locked && (
          <p className="text-[10px] text-muted-foreground italic mt-0.5">Definido pela função selecionada</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('text-xs', value && 'text-muted-foreground')}>Não</span>
        <Switch checked={value} onCheckedChange={onChange} disabled={locked} />
        <span className={cn('text-xs', !value && 'text-muted-foreground')}>Sim</span>
      </div>
    </div>
  );
}