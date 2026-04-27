import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgPermissions } from '@/hooks/useOrgPermissions';
import { usePatientPackages, type PatientPackageLink } from '@/hooks/usePatientPackages';
import { ClinicPackage } from '@/types';
import { Plus, X, Package } from 'lucide-react';
import { toast } from 'sonner';
import { getDynamicSessionValue } from '@/utils/dateHelpers';

interface OrgMemberOption {
  id: string;
  user_id: string | null;
  email: string;
  name?: string | null;
}

interface Props {
  patientId: string;
  clinicId: string;
  clinicPackages: ClinicPackage[];
  organizationId?: string | null;
  disabled?: boolean;
  /** Weekdays the patient attends — used to prorate "Mensal" packages dynamically. */
  patientWeekdays?: string[];
}

/**
 * Manage multiple package links per patient (one package per therapist/specialty).
 * Each link displays the linked therapist (optional) and total/per-session value.
 */
export function PatientPackagesManager({ patientId, clinicId, clinicPackages, organizationId, disabled, patientWeekdays = [] }: Props) {
  const { user } = useAuth();
  const { isOwner, role } = useOrgPermissions();
  const { links, loading, addLink, removeLink } = usePatientPackages(patientId);
  const [members, setMembers] = useState<OrgMemberOption[]>([]);
  const [newPackageId, setNewPackageId] = useState<string>('');
  const [newMemberId, setNewMemberId] = useState<string>('none');
  const [adding, setAdding] = useState(false);

  const canManage = !disabled && (isOwner || role === 'admin' || !organizationId);

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      if (!organizationId) { setMembers([]); return; }
      const { data: m } = await supabase
        .from('organization_members')
        .select('id, user_id, email')
        .eq('organization_id', organizationId)
        .eq('status', 'active');
      if (cancelled) return;
      const userIds = (m || []).map(x => x.user_id).filter(Boolean) as string[];
      const profileMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, name').in('user_id', userIds);
        (profiles || []).forEach((p: any) => { if (p.name) profileMap.set(p.user_id, p.name); });
      }
      setMembers((m || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        email: row.email,
        name: row.user_id ? profileMap.get(row.user_id) : null,
      })));
    }
    loadMembers();
    return () => { cancelled = true; };
  }, [organizationId]);

  const activePackages = clinicPackages.filter(p => p.isActive);

  const formatPerSession = (link: PatientPackageLink): string | null => {
    if (!link.packagePrice) return null;
    if (link.packageType === 'mensal') {
      // Prefer dynamic proration based on the patient's weekdays in the
      // current month (same logic shown for "Consultório" patients).
      const now = new Date();
      const dyn = getDynamicSessionValue(link.packagePrice, patientWeekdays, now.getMonth(), now.getFullYear());
      if (dyn.occurrences > 0) {
        return `Mês de ${dyn.occurrences} semanas: R$ ${dyn.perSession.toFixed(2)}/sessão`;
      }
      // Fallback to a static division if weekdays aren't configured yet.
      const limit = link.packageSessionLimit || 0;
      if (limit > 0) return `R$ ${(link.packagePrice / limit).toFixed(2)} por sessão`;
      return null;
    }
    if (link.packageType === 'personalizado') {
      const limit = link.packageSessionLimit || 0;
      if (limit > 0) return `R$ ${(link.packagePrice / limit).toFixed(2)} por sessão`;
      return null;
    }
    if (link.packageType === 'por_sessao') {
      return `R$ ${link.packagePrice.toFixed(2)} por sessão`;
    }
    return null;
  };

  const handleAdd = async () => {
    if (!newPackageId || newPackageId === 'none') {
      toast.error('Selecione um pacote');
      return;
    }
    // Prevent same package twice for same therapist
    const memberId = newMemberId === 'none' ? null : newMemberId;
    const duplicate = links.some(l => l.packageId === newPackageId && (l.memberId || null) === memberId);
    if (duplicate) {
      toast.error('Este pacote já está vinculado a este profissional');
      return;
    }
    setAdding(true);
    try {
      const member = memberId ? members.find(m => m.id === memberId) : null;
      await addLink({
        packageId: newPackageId,
        memberId,
        therapistUserId: member?.user_id || null,
        organizationId: organizationId || null,
      });
      setNewPackageId('');
      setNewMemberId('none');
      toast.success('Pacote vinculado!');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Erro ao vincular pacote');
    } finally {
      setAdding(false);
    }
  };

  if (activePackages.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Nenhum pacote ativo cadastrado nesta clínica.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Pacotes vinculados</Label>
        {loading ? (
          <div className="text-xs text-muted-foreground mt-2">Carregando...</div>
        ) : links.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground mt-1">
            Nenhum pacote vinculado a este paciente.
          </div>
        ) : (
          <div className="space-y-2 mt-1">
            {links.map(link => (
              <div
                key={link.id}
                className="flex items-start justify-between gap-2 rounded-md border bg-muted/40 p-2"
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Package className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {link.packageName}{' '}
                      <span className="text-xs text-muted-foreground font-normal">
                        — R$ {(link.packagePrice ?? 0).toFixed(2)}
                      </span>
                    </div>
                    {formatPerSession(link) && (
                      <div className="text-xs text-muted-foreground">{formatPerSession(link)}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {link.therapistName || link.therapistEmail
                        ? `Profissional: ${link.therapistName || link.therapistEmail}`
                        : 'Sem profissional específico'}
                    </div>
                  </div>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => removeLink(link.id)}
                    aria-label="Remover pacote"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <div className="rounded-md border p-3 space-y-2">
          <Label className="text-xs">Adicionar pacote</Label>
          <div className="grid grid-cols-1 gap-2">
            <Select value={newPackageId} onValueChange={setNewPackageId}>
              <SelectTrigger><SelectValue placeholder="Selecione um pacote" /></SelectTrigger>
              <SelectContent>
                {activePackages.map(pkg => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} — R$ {pkg.price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {organizationId && members.length > 0 && (
              <Select value={newMemberId} onValueChange={setNewMemberId}>
                <SelectTrigger><SelectValue placeholder="Profissional (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem profissional específico</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
              disabled={adding || !newPackageId}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-1" /> Vincular pacote
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
