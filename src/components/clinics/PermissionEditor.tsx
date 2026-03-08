import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  PermissionKey,
  PermissionModule,
  PERMISSION_MODULES,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  getModuleLevel,
  applyModuleLevel,
} from '@/hooks/useOrgPermissions';
import {
  Stethoscope,
  Banknote,
  CalendarDays,
  Shield,
  User,
  FileText,
  Inbox,
  Users,
  LayoutDashboard,
  CheckSquare,
  Megaphone,
} from 'lucide-react';

function getModuleIcon(icon: string) {
  const map: Record<string, React.ComponentType<any>> = {
    stethoscope: Stethoscope,
    banknote: Banknote,
    calendar: CalendarDays,
    shield: Shield,
    user: User,
    report: FileText,
  };
  return map[icon] || Inbox;
}

function getGroupIcon(label: string) {
  const map: Record<string, React.ComponentType<any>> = {
    'Dashboard': LayoutDashboard,
    'Clínicas': Inbox,
    'Relatórios': FileText,
    'Tarefas': CheckSquare,
    'Mural': Megaphone,
    'Equipe': Users,
  };
  return map[label] || Inbox;
}

const LEVEL_COLORS: Record<string, string> = {
  none: 'border-destructive/50 bg-destructive/5 text-destructive',
  view: 'border-blue-400/50 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
  own: 'border-blue-400/50 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
  view_all: 'border-blue-400/50 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
  status: 'border-blue-400/50 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300',
  edit: 'border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300',
  delete: 'border-rose-400/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300',
  export: 'border-emerald-400/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
  all: 'border-violet-400/50 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300',
};

function getLevelColor(levelId: string) {
  return LEVEL_COLORS[levelId] ?? 'border-border bg-muted text-muted-foreground';
}

interface PermissionEditorProps {
  permissions: PermissionKey[];
  onChange: (perms: PermissionKey[]) => void;
  compact?: boolean;
}

export function PermissionEditor({ permissions, onChange, compact = false }: PermissionEditorProps) {
  function handleLevelChange(module: PermissionModule, levelId: string) {
    onChange(applyModuleLevel(module, levelId, permissions));
  }

  function togglePerm(perm: PermissionKey) {
    onChange(
      permissions.includes(perm)
        ? permissions.filter(p => p !== perm)
        : [...permissions, perm]
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Tiered modules ── */}
      {PERMISSION_MODULES.map(module => {
        const Icon = getModuleIcon(module.icon);
        const activeLevel = getModuleLevel(module, permissions);

        return (
          <div key={module.id} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs font-semibold text-foreground">{module.label}</p>
            </div>
            <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
              {module.levels.map(level => {
                const isActive = activeLevel === level.id;
                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => handleLevelChange(module, level.id)}
                    className={cn(
                      'text-left px-3 py-2.5 rounded-lg border-2 transition-all flex flex-col gap-0.5',
                      isActive
                        ? getLevelColor(level.id)
                        : 'border-border bg-card hover:border-primary/30 hover:bg-muted/40'
                    )}
                  >
                    <span className={cn(
                      'text-xs font-semibold',
                      isActive ? '' : 'text-foreground'
                    )}>
                      {level.label}
                    </span>
                    {!compact && (
                      <span className={cn('text-[10px] leading-tight', isActive ? 'opacity-80' : 'text-muted-foreground')}>
                        {level.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <Separator />

      {/* ── Checkbox groups ── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outros módulos</p>
        {PERMISSION_GROUPS.map(group => {
          const GroupIcon = getGroupIcon(group.label);
          return (
            <div key={group.label} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <GroupIcon className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
              </div>
              <div className={cn('grid gap-1.5', compact ? 'grid-cols-1' : 'grid-cols-2')}>
                {group.keys.map(perm => (
                  <div
                    key={perm}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => togglePerm(perm)}
                  >
                    <Checkbox
                      checked={permissions.includes(perm)}
                      onCheckedChange={() => togglePerm(perm)}
                    />
                    <span className="text-xs">{PERMISSION_LABELS[perm]}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
