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
  'clinics.create',      // blocked for org members by default
  'clinics.edit',
  // Pacientes
  'patients.view',
  'patients.own_only',   // only see assigned patients
  'patients.create',
  'patients.edit',
  // Agenda
  'calendar.view',
  'calendar.own_only',   // only see own appointments
  // Evoluções (inside patient/clinic detail)
  'evolutions.view',
  'evolutions.own_only', // only see own evolutions
  'evolutions.create',
  // Financeiro
  'financial.view',
  // Relatórios
  'reports.view',
  'ai_reports.view',
  // Tarefas
  'tasks.view',
  // Mural
  'mural.view',
  // Equipe (team management)
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
  'calendar.view': 'Ver Agenda',
  'calendar.own_only': 'Apenas seus agendamentos',
  'evolutions.view': 'Ver Evoluções',
  'evolutions.own_only': 'Apenas suas evoluções',
  'evolutions.create': 'Criar Evoluções',
  'financial.view': 'Ver Financeiro',
  'reports.view': 'Ver Relatórios',
  'ai_reports.view': 'Ver Relatórios IA',
  'tasks.view': 'Ver Tarefas',
  'mural.view': 'Ver Mural',
  'team.view': 'Ver Equipe',
  'team.manage': 'Gerenciar Equipe',
};

export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  { label: 'Dashboard', keys: ['dashboard.view'] },
  { label: 'Clínicas', keys: ['clinics.view', 'clinics.create', 'clinics.edit'] },
  {
    label: 'Pacientes',
    keys: ['patients.view', 'patients.own_only', 'patients.create', 'patients.edit'],
  },
  { label: 'Agenda', keys: ['calendar.view', 'calendar.own_only'] },
  {
    label: 'Evoluções',
    keys: ['evolutions.view', 'evolutions.own_only', 'evolutions.create'],
  },
  { label: 'Financeiro', keys: ['financial.view'] },
  { label: 'Relatórios', keys: ['reports.view', 'ai_reports.view'] },
  { label: 'Tarefas', keys: ['tasks.view'] },
  { label: 'Mural', keys: ['mural.view'] },
  { label: 'Equipe', keys: ['team.view', 'team.manage'] },
];

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
  'evolutions.view',
  'evolutions.create',
  'financial.view',
  'reports.view',
  'ai_reports.view',
  'tasks.view',
  'mural.view',
  'team.view',
  'team.manage',
];

/**
 * Preset roles with display label, base role, and default permissions.
 * These are editable after selection — they're just a starting point.
 */
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
    permissions: [
      'dashboard.view',
      'clinics.view',
      'clinics.create',
      'clinics.edit',
      'patients.view',
      'patients.create',
      'patients.edit',
      'calendar.view',
      'evolutions.view',
      'evolutions.create',
      'financial.view',
      'reports.view',
      'ai_reports.view',
      'tasks.view',
      'mural.view',
      'team.view',
      'team.manage',
    ],
  },
  {
    id: 'terapeuta',
    label: 'Terapeuta',
    description: 'Acesso aos próprios pacientes, prontuários, evoluções e agenda pessoal.',
    baseRole: 'professional',
    icon: 'user',
    permissions: [
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
    ],
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
      'reports.view',
    ],
  },
];

export interface OrgMembershipInfo {
  isOrgMember: boolean;
  isOwner: boolean;
  role: string | null;
  roleLabel: string | null;
  permissions: PermissionKey[];
  loading: boolean;
}

/**
 * Returns the current user's org membership info + permissions.
 * Owners bypass all permission checks (they have everything).
 */
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

        // Check if user is the owner of this org
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
