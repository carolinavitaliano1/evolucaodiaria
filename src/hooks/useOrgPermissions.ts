import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * All permission keys available in the system.
 * The owner always has every permission.
 */
export const ALL_PERMISSIONS = [
  // Dashboard
  'dashboard.view',
  // Clínicas
  'clinics.view',
  'clinics.create',
  'clinics.edit',
  // Pacientes
  'patients.view',
  'patients.own_only',
  'patients.create',
  'patients.edit',
  'patients.delete',
  // Agenda
  'calendar.view',
  'calendar.own_only',
  'calendar.edit',
  // Evoluções
  'evolutions.view',
  'evolutions.own_only',
  'evolutions.create',
  'evolutions.edit',
  'evolutions.delete',
  'evolutions.status_only',   // ver se evolução foi preenchida (sem ler conteúdo)
  // Ferramentas de IA
  'ai_reports.use',           // Gerador de Relatórios via IA
  'ai_evolutions.use',        // Resumo/Melhoria de Evoluções com IA
  // Financeiro
  'financial.view',
  'financial.edit',
  'financial.export',
  // Comissões pessoais (visão do terapeuta)
  'commissions.view',
  // Relatórios
  'reports.view',
  'ai_reports.view',
  // Tarefas
  'tasks.view',
  // Mural
  'mural.view',
  // Equipe
  'team.view',
  'team.manage',
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'dashboard.view': 'Ver Dashboard',
  'clinics.view': 'Ver Clínicas',
  'clinics.create': 'Criar Clínicas',
  'clinics.edit': 'Editar Clínicas',
  'patients.view': 'Ver Pacientes',
  'patients.own_only': 'Apenas pacientes vinculados',
  'patients.create': 'Criar Pacientes',
  'patients.edit': 'Editar Pacientes',
  'patients.delete': 'Excluir Pacientes',
  'calendar.view': 'Ver Agenda',
  'calendar.own_only': 'Apenas seus agendamentos',
  'calendar.edit': 'Editar Agenda',
  'evolutions.view': 'Ver Evoluções (conteúdo clínico)',
  'evolutions.own_only': 'Apenas suas evoluções',
  'evolutions.create': 'Criar Evoluções',
  'evolutions.edit': 'Editar Evoluções',
  'evolutions.delete': 'Excluir Evoluções',
  'evolutions.status_only': 'Ver status de preenchimento (sem conteúdo)',
  'ai_reports.use': 'Usar Gerador de Relatórios com IA',
  'ai_evolutions.use': 'Usar IA nas Evoluções (resumo/melhoria)',
  'financial.view': 'Ver Financeiro',
  'financial.edit': 'Editar Financeiro',
  'financial.export': 'Exportar Financeiro',
  'commissions.view': 'Ver Minhas Comissões',
  'reports.view': 'Ver Relatórios',
  'ai_reports.view': 'Ver Relatórios IA',
  'tasks.view': 'Ver Tarefas',
  'mural.view': 'Ver Mural',
  'team.view': 'Ver Equipe',
  'team.manage': 'Gerenciar Equipe',
};

// ---------------------------------------------------------------------------
// TIERED PERMISSION MODULES
// Each module defines mutually-exclusive access levels.
// Selecting a level auto-applies the correct set of keys for that module.
// ---------------------------------------------------------------------------

export interface PermissionLevel {
  id: string;
  label: string;
  description: string;
  grants: PermissionKey[];   // keys turned ON  at this level
  revokes: PermissionKey[];  // keys turned OFF at this level (always the whole module pool)
}

export interface PermissionModule {
  id: string;
  label: string;
  icon: string; // matches getModuleIcon map
  allKeys: PermissionKey[]; // all keys that belong to this module
  levels: PermissionLevel[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  // ── Módulo Clínico ─────────────────────────────────────────────────────────
  {
    id: 'clinical',
    label: 'Módulo Clínico',
    icon: 'stethoscope',
    allKeys: [
      'patients.view', 'patients.own_only', 'patients.create', 'patients.edit', 'patients.delete',
      'evolutions.view', 'evolutions.own_only', 'evolutions.create', 'evolutions.edit', 'evolutions.delete',
      'evolutions.status_only',
    ],
    levels: [
      {
        id: 'none',
        label: 'Sem Acesso',
        description: 'Não vê pacientes nem evoluções.',
        grants: [],
        revokes: [
          'patients.view', 'patients.own_only', 'patients.create', 'patients.edit', 'patients.delete',
          'evolutions.view', 'evolutions.own_only', 'evolutions.create', 'evolutions.edit', 'evolutions.delete',
          'evolutions.status_only',
        ],
      },
      {
        id: 'status',
        label: 'Status',
        description: 'Vê se evoluções foram preenchidas, sem acessar o conteúdo clínico.',
        grants: ['patients.view', 'evolutions.status_only'],
        revokes: [
          'patients.own_only', 'patients.create', 'patients.edit', 'patients.delete',
          'evolutions.view', 'evolutions.own_only', 'evolutions.create', 'evolutions.edit', 'evolutions.delete',
        ],
      },
      {
        id: 'view',
        label: 'Ver',
        description: 'Visualiza apenas os pacientes e evoluções atribuídos.',
        grants: ['patients.view', 'patients.own_only', 'evolutions.view', 'evolutions.own_only', 'evolutions.status_only'],
        revokes: ['patients.create', 'patients.edit', 'patients.delete', 'evolutions.create', 'evolutions.edit', 'evolutions.delete'],
      },
      {
        id: 'edit',
        label: 'Editar',
        description: 'Cria e edita pacientes e evoluções atribuídos.',
        grants: [
          'patients.view', 'patients.own_only', 'patients.create', 'patients.edit',
          'evolutions.view', 'evolutions.own_only', 'evolutions.create', 'evolutions.edit', 'evolutions.status_only',
        ],
        revokes: ['patients.delete', 'evolutions.delete'],
      },
      {
        id: 'delete',
        label: 'Excluir',
        description: 'Criar, editar e excluir registros dos pacientes vinculados a este profissional.',
        grants: [
          'patients.view', 'patients.own_only', 'patients.create', 'patients.edit', 'patients.delete',
          'evolutions.view', 'evolutions.own_only', 'evolutions.create', 'evolutions.edit', 'evolutions.delete',
          'evolutions.status_only',
        ],
        revokes: [],
      },
      {
        id: 'all',
        label: 'Acesso Total',
        description: 'Criar, editar, excluir e ver todos os pacientes e evoluções da clínica (sem restrição de vínculo).',
        grants: [
          'patients.view', 'patients.create', 'patients.edit', 'patients.delete',
          'evolutions.view', 'evolutions.create', 'evolutions.edit', 'evolutions.delete',
          'evolutions.status_only',
        ],
        revokes: ['patients.own_only', 'evolutions.own_only'],
      },
    ],
  },

  // ── Ferramentas de IA ──────────────────────────────────────────────────────
  {
    id: 'ai_tools',
    label: 'Ferramentas de IA',
    icon: 'report',
    allKeys: ['ai_reports.use', 'ai_evolutions.use'],
    levels: [
      {
        id: 'none',
        label: 'Bloqueado',
        description: 'Sem acesso a nenhuma ferramenta de IA.',
        grants: [],
        revokes: ['ai_reports.use', 'ai_evolutions.use'],
      },
      {
        id: 'own',
        label: 'Evoluções IA',
        description: 'Pode melhorar e resumir evoluções com IA.',
        grants: ['ai_evolutions.use'],
        revokes: ['ai_reports.use'],
      },
      {
        id: 'edit',
        label: 'Relatórios IA',
        description: 'Acessa o gerador de relatórios clínicos com IA.',
        grants: ['ai_reports.use'],
        revokes: ['ai_evolutions.use'],
      },
      {
        id: 'all',
        label: 'Acesso Total',
        description: 'Acesso completo a todas as ferramentas de IA.',
        grants: ['ai_reports.use', 'ai_evolutions.use'],
        revokes: [],
      },
    ],
  },

  // ── Módulo Financeiro ──────────────────────────────────────────────────────
  {
    id: 'financial',
    label: 'Módulo Financeiro',
    icon: 'banknote',
    allKeys: ['financial.view', 'financial.edit', 'financial.export'],
    levels: [
      {
        id: 'none',
        label: 'Sem Acesso',
        description: 'Não acessa o módulo financeiro.',
        grants: [],
        revokes: ['financial.view', 'financial.edit', 'financial.export'],
      },
      {
        id: 'view',
        label: 'Ver',
        description: 'Consulta valores, extratos e status de pagamento.',
        grants: ['financial.view'],
        revokes: ['financial.edit', 'financial.export'],
      },
      {
        id: 'edit',
        label: 'Editar',
        description: 'Registra e altera pagamentos e lançamentos.',
        grants: ['financial.view', 'financial.edit'],
        revokes: ['financial.export'],
      },
      {
        id: 'export',
        label: 'Exportar PDF',
        description: 'Editar lançamentos e exportar relatórios em PDF/CSV.',
        grants: ['financial.view', 'financial.edit', 'financial.export'],
        revokes: [],
      },
      {
        id: 'all',
        label: 'Acesso Total',
        description: 'Acesso irrestrito ao financeiro: visualizar, editar e exportar.',
        grants: ['financial.view', 'financial.edit', 'financial.export'],
        revokes: [],
      },
    ],
  },

  // ── Agenda ─────────────────────────────────────────────────────────────────
  {
    id: 'calendar',
    label: 'Agenda',
    icon: 'calendar',
    allKeys: ['calendar.view', 'calendar.own_only', 'calendar.edit'],
    levels: [
      {
        id: 'none',
        label: 'Sem Acesso',
        description: 'Não visualiza a agenda.',
        grants: [],
        revokes: ['calendar.view', 'calendar.own_only', 'calendar.edit'],
      },
      {
        id: 'own',
        label: 'Ver Própria',
        description: 'Vê somente seus próprios agendamentos.',
        grants: ['calendar.view', 'calendar.own_only'],
        revokes: ['calendar.edit'],
      },
      {
        id: 'view_all',
        label: 'Ver Todas',
        description: 'Visualiza a agenda de todos os profissionais.',
        grants: ['calendar.view'],
        revokes: ['calendar.own_only', 'calendar.edit'],
      },
      {
        id: 'edit',
        label: 'Editar',
        description: 'Visualiza e edita apenas os próprios agendamentos.',
        grants: ['calendar.view', 'calendar.own_only', 'calendar.edit'],
        revokes: [],
      },
      {
        id: 'all',
        label: 'Acesso Total',
        description: 'Visualiza e edita todos os agendamentos sem restrições.',
        grants: ['calendar.view', 'calendar.edit'],
        revokes: ['calendar.own_only'],
      },
    ],
  },
];

/** Simple checkbox groups (non-tiered modules) */
export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  { label: 'Dashboard', keys: ['dashboard.view'] },
  { label: 'Clínicas', keys: ['clinics.view', 'clinics.create', 'clinics.edit'] },
  { label: 'Relatórios', keys: ['reports.view', 'ai_reports.view'] },
  { label: 'Tarefas', keys: ['tasks.view'] },
  { label: 'Mural', keys: ['mural.view'] },
  { label: 'Equipe', keys: ['team.view', 'team.manage'] },
];

/** Derive which level is currently active for a module given a permission set */
export function getModuleLevel(module: PermissionModule, perms: PermissionKey[]): string {
  // Exact-match: the set of module keys present must equal the level's grants exactly
  const activeModuleKeys = module.allKeys.filter(k => perms.includes(k));
  const levels = [...module.levels].reverse();
  for (const level of levels) {
    if (level.id === 'none') continue;
    const sortedGrants = [...level.grants].sort();
    const sortedActive = [...activeModuleKeys].sort();
    if (sortedGrants.length === sortedActive.length && sortedGrants.every((k, i) => k === sortedActive[i])) {
      return level.id;
    }
  }
  return 'none';
}

/** Apply a module level to a permission set, returning the updated set */
export function applyModuleLevel(
  module: PermissionModule,
  levelId: string,
  perms: PermissionKey[],
): PermissionKey[] {
  const level = module.levels.find(l => l.id === levelId);
  if (!level) return perms;
  // Remove all keys belonging to the module, then add grants
  const cleaned = perms.filter(p => !module.allKeys.includes(p));
  return [...cleaned, ...level.grants];
}

// ---------------------------------------------------------------------------
// DEFAULT PERMISSION SETS
// ---------------------------------------------------------------------------

/** Default permissions for a newly-invited therapist */
export const DEFAULT_THERAPIST_PERMISSIONS: PermissionKey[] = [
  'dashboard.view',
  'clinics.view',
  'patients.view',
  'patients.own_only',
  'calendar.view',
  'calendar.own_only',
  'evolutions.view',
  'evolutions.own_only',
  'evolutions.create',
  'evolutions.status_only',
  'ai_evolutions.use',
  'mural.view',
  'tasks.view',
  'commissions.view',
];

/** Default permissions for an admin */
export const DEFAULT_ADMIN_PERMISSIONS: PermissionKey[] = [
  'dashboard.view',
  'clinics.view',
  'clinics.edit',
  'patients.view',
  'patients.create',
  'patients.edit',
  'calendar.view',
  'calendar.edit',
  'evolutions.view',
  'evolutions.create',
  'evolutions.edit',
  'evolutions.status_only',
  'ai_reports.use',
  'ai_evolutions.use',
  'financial.view',
  'financial.edit',
  'financial.export',
  'reports.view',
  'ai_reports.view',
  'tasks.view',
  'mural.view',
  'team.view',
  'team.manage',
];

// ---------------------------------------------------------------------------
// PRESET ROLES
// ---------------------------------------------------------------------------

export interface PresetRole {
  id: string;
  label: string;
  description: string;
  baseRole: 'admin' | 'professional';
  permissions: PermissionKey[];
  icon: string;
}

export const PRESET_ROLES: PresetRole[] = [
  {
    id: 'administrador',
    label: 'Administrador',
    description: 'Acesso total ao sistema, configurações e faturamento global.',
    baseRole: 'admin',
    icon: 'shield',
    permissions: DEFAULT_ADMIN_PERMISSIONS,
  },
  {
    id: 'terapeuta',
    label: 'Terapeuta',
    description: 'Acesso aos próprios pacientes, prontuários, evoluções e agenda pessoal.',
    baseRole: 'professional',
    icon: 'user',
    permissions: DEFAULT_THERAPIST_PERMISSIONS,
  },
  {
    id: 'secretaria',
    label: 'Secretária',
    description: 'Gestão de agendas e cadastro de pacientes. Vê status de evoluções, sem conteúdo clínico.',
    baseRole: 'professional',
    icon: 'calendar',
    permissions: [
      'dashboard.view',
      'clinics.view',
      'patients.view',
      'patients.create',
      'patients.edit',
      'evolutions.status_only',
      'calendar.view',
      'calendar.edit',
      'tasks.view',
      'mural.view',
      'financial.view',
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    description: 'Acesso exclusivo ao fluxo de caixa, extratos e contas a pagar/receber.',
    baseRole: 'professional',
    icon: 'banknote',
    permissions: [
      'dashboard.view',
      'financial.view',
      'financial.edit',
      'financial.export',
      'reports.view',
    ],
  },
];

// ---------------------------------------------------------------------------
// HOOK
// ---------------------------------------------------------------------------

export interface OrgMembershipInfo {
  isOrgMember: boolean;
  isOwner: boolean;
  role: string | null;
  roleLabel: string | null;
  permissions: PermissionKey[];
  loading: boolean;
}

export function useOrgPermissions(): OrgMembershipInfo {
  const { user, sessionReady } = useAuth();
  const [info, setInfo] = useState<OrgMembershipInfo>({
    isOrgMember: false,
    isOwner: false,
    role: null,
    roleLabel: null,
    permissions: [],
    loading: true,
  });

  useEffect(() => {
    if (!sessionReady || !user) {
      setInfo(prev => ({ ...prev, isOrgMember: false, isOwner: false, permissions: [], loading: false }));
      return;
    }

    (async () => {
      try {
        let { data } = await supabase
          .from('organization_members')
          .select('id, role, role_label, permissions, status, organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (!data) {
          // Maybe there is a pending invite for this email that was never
          // accepted (user signed up directly without the invite link). Try
          // to auto-accept it so they don't get redirected to /pricing.
          const { data: pending } = await supabase
            .from('organization_members')
            .select('id')
            .eq('email', user.email ?? '')
            .eq('status', 'pending')
            .limit(1)
            .maybeSingle();

          if (pending) {
            const { error: acceptErr } = await supabase.functions.invoke('accept-invite', {
              body: { member_id: pending.id },
            });
            if (!acceptErr) {
              const { data: refreshed } = await supabase
                .from('organization_members')
                .select('id, role, role_label, permissions, status, organization_id')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .limit(1)
                .maybeSingle();
              data = refreshed ?? null;
            }
          }
        }

        if (!data) {
          setInfo({ isOrgMember: false, isOwner: false, role: null, roleLabel: null, permissions: [], loading: false });
          return;
        }

        const { data: org } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', data.organization_id)
          .maybeSingle();

        const isOwner = org?.owner_id === user.id;
        const isNonOwnerMember = !isOwner && data.role !== 'owner';

        const rawPerms: PermissionKey[] = isOwner
          ? [...ALL_PERMISSIONS]
          : Array.isArray(data.permissions)
          ? (data.permissions as PermissionKey[])
          : Object.keys(data.permissions || {}).filter(k => (data.permissions as any)[k]) as PermissionKey[];

        setInfo({
          isOrgMember: isNonOwnerMember,
          isOwner,
          role: data.role,
          roleLabel: data.role_label,
          permissions: rawPerms,
          loading: false,
        });
      } catch {
        setInfo(prev => ({ ...prev, loading: false }));
      }
    })();
  }, [user, sessionReady]);

  return info;
}

/** Convenience: check a single permission */
export function hasPermission(permissions: PermissionKey[], key: PermissionKey): boolean {
  return permissions.includes(key);
}

/**
 * Returns true when the current user should be restricted to records they
 * created themselves (e.g. evolutions, attachments, notes, tasks). Owner
 * always sees everything. Non-org users (sole therapists) also see everything.
 */
export function shouldFilterOwnOnly(
  info: { isOrgMember: boolean; isOwner: boolean; permissions: PermissionKey[] },
  key: PermissionKey,
): boolean {
  if (!info.isOrgMember) return false;
  if (info.isOwner) return false;
  return info.permissions.includes(key);
}
