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
  // Financeiro
  'financial.view',
  'financial.edit',
  'financial.export',
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
  'evolutions.view': 'Ver Evoluções',
  'evolutions.own_only': 'Apenas suas evoluções',
  'evolutions.create': 'Criar Evoluções',
  'evolutions.edit': 'Editar Evoluções',
  'evolutions.delete': 'Excluir Evoluções',
  'financial.view': 'Ver Financeiro',
  'financial.edit': 'Editar Financeiro',
  'financial.export': 'Exportar Financeiro',
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
        ],
      },
      {
        id: 'view',
        label: 'Ver',
        description: 'Visualiza apenas os pacientes e evoluções atribuídos.',
        grants: ['patients.view', 'patients.own_only', 'evolutions.view', 'evolutions.own_only'],
        revokes: ['patients.create', 'patients.edit', 'patients.delete', 'evolutions.create', 'evolutions.edit', 'evolutions.delete'],
      },
      {
        id: 'edit',
        label: 'Editar',
        description: 'Cria e edita pacientes e evoluções atribuídos.',
        grants: [
          'patients.view', 'patients.own_only', 'patients.create', 'patients.edit',
          'evolutions.view', 'evolutions.own_only', 'evolutions.create', 'evolutions.edit',
        ],
        revokes: ['patients.delete', 'evolutions.delete'],
      },
      {
        id: 'delete',
        label: 'Excluir',
        description: 'Acesso completo: criar, editar e excluir registros.',
        grants: [
          'patients.view', 'patients.own_only', 'patients.create', 'patients.edit', 'patients.delete',
          'evolutions.view', 'evolutions.own_only', 'evolutions.create', 'evolutions.edit', 'evolutions.delete',
        ],
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
        label: 'Exportar',
        description: 'Acesso total: editar e exportar PDF/CSV.',
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
        id: 'all',
        label: 'Ver Todas',
        description: 'Visualiza a agenda de todos os profissionais.',
        grants: ['calendar.view'],
        revokes: ['calendar.own_only', 'calendar.edit'],
      },
      {
        id: 'edit',
        label: 'Editar',
        description: 'Cria, move e cancela agendamentos de todos.',
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
  // Walk levels from highest to lowest; return first whose grants are all satisfied
  const levels = [...module.levels].reverse();
  for (const level of levels) {
    if (level.id === 'none') continue;
    if (level.grants.every(k => perms.includes(k))) return level.id;
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
  'mural.view',
  'tasks.view',
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
    description: 'Gestão de agendas e cadastro de pacientes. Sem acesso ao conteúdo clínico.',
    baseRole: 'professional',
    icon: 'calendar',
    permissions: [
      'dashboard.view',
      'clinics.view',
      'patients.view',
      'patients.create',
      'patients.edit',
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
        const { data } = await supabase
          .from('organization_members')
          .select('id, role, role_label, permissions, status, organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

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
