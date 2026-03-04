import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserPlus, Mail, Trash2, Crown, Shield, User, Loader2, Users, Copy, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface OrganizationMember {
  id: string;
  user_id: string | null;
  email: string;
  role: 'owner' | 'admin' | 'professional';
  status: 'pending' | 'active' | 'inactive';
  joined_at: string | null;
  created_at: string;
  profile?: { name: string | null; avatar_url: string | null };
}

interface Organization {
  id: string;
  name: string;
  owner_id: string;
}

interface ClinicTeamProps {
  clinicId: string;
  clinicName: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Dono',
  admin: 'Administrador',
  professional: 'Profissional',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3 h-3" />,
  admin: <Shield className="w-3 h-3" />,
  professional: <User className="w-3 h-3" />,
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  pending: 'Convite pendente',
  inactive: 'Inativo',
};

export function ClinicTeam({ clinicId, clinicName }: ClinicTeamProps) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'professional'>('professional');
  const [inviting, setInviting] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const isOwner = organization?.owner_id === user?.id;
  const myMember = members.find(m => m.user_id === user?.id);
  const canManage = isOwner || myMember?.role === 'admin';

  useEffect(() => {
    loadTeam();
  }, [clinicId]);

  async function loadTeam() {
    setLoading(true);
    try {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('organization_id')
        .eq('id', clinicId)
        .single();

      if (!clinic?.organization_id) {
        setOrganization(null);
        setMembers([]);
        setLoading(false);
        return;
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', clinic.organization_id)
        .single();

      setOrganization(org);

      const { data: membersData } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', clinic.organization_id)
        .order('created_at');

      if (membersData) {
        const userIds = membersData.filter(m => m.user_id).map(m => m.user_id!);
        let profilesMap: Record<string, { name: string | null; avatar_url: string | null }> = {};

        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, name, avatar_url')
            .in('user_id', userIds);

          profiles?.forEach(p => { profilesMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url }; });
        }

        setMembers(membersData.map(m => ({
          ...m,
          role: m.role as OrganizationMember['role'],
          status: m.status as OrganizationMember['status'],
          profile: m.user_id ? profilesMap[m.user_id] : undefined,
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createOrganization() {
    if (!user) return;
    setCreating(true);
    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: clinicName, owner_id: user.id })
        .select()
        .single();

      if (orgError || !org) throw orgError;

      await supabase.from('clinics').update({ organization_id: org.id }).eq('id', clinicId);

      await supabase.from('organization_members').insert({
        organization_id: org.id,
        user_id: user.id,
        email: user.email!,
        role: 'owner',
        status: 'active',
        invited_by: user.id,
        joined_at: new Date().toISOString(),
      });

      toast.success('Equipe criada com sucesso!');
      loadTeam();
    } catch (err) {
      toast.error('Erro ao criar equipe');
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail || !organization) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { organization_id: organization.id, email: inviteEmail, role: inviteRole },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      toast.success(`Convite enviado para ${inviteEmail}`);
      setInviteEmail('');
      setInviteOpen(false);
      loadTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar convite');
    } finally {
      setInviting(false);
    }
  }

  function copyInviteLink(memberId: string) {
    const url = `${window.location.origin}/auth?invite=${memberId}&org=${organization?.id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link de convite copiado!');
  }

  async function handleResendInvite(member: OrganizationMember) {
    if (!organization) return;
    setResendingId(member.id);
    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: { organization_id: organization.id, email: member.email, role: member.role },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`Convite reenviado para ${member.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reenviar convite');
    } finally {
      setResendingId(null);
    }
  }

  async function handleRemoveMember() {
    if (!removeMemberId) return;
    const { error } = await supabase.from('organization_members').delete().eq('id', removeMemberId);
    if (error) {
      toast.error('Erro ao remover membro');
    } else {
      toast.success('Membro removido');
      loadTeam();
    }
    setRemoveMemberId(null);
  }

  async function handleChangeRole(memberId: string, newRole: 'admin' | 'professional') {
    const { error } = await supabase.from('organization_members').update({ role: newRole }).eq('id', memberId);
    if (error) toast.error('Erro ao alterar papel');
    else { toast.success('Papel atualizado'); loadTeam(); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-lg">Equipe multidisciplinar</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Ative o modo equipe para convidar outros profissionais para esta clínica. Eles poderão registrar evoluções com seus próprios carimbos, mas terão acesso compartilhado aos pacientes.
          </p>
        </div>
        <Button onClick={createOrganization} disabled={creating} className="gap-2">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          Ativar modo equipe
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Equipe da clínica</h3>
          <p className="text-sm text-muted-foreground">{members.filter(m => m.status === 'active').length} membro(s) ativo(s)</p>
        </div>
        {canManage && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="w-4 h-4" />
                Convidar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Convidar profissional</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    placeholder="profissional@email.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Papel</Label>
                  <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Profissional — acesso básico</SelectItem>
                      <SelectItem value="admin">Administrador — pode convidar e gerenciar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail} className="gap-2">
                    {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Enviar convite
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-2">
        {members.map(member => (
          <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border bg-card gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${member.status === 'active' ? 'bg-primary/10' : 'bg-muted'}`}>
                {member.status === 'active' ? ROLE_ICONS[member.role] : <Mail className="w-3 h-3 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-sm text-foreground truncate">
                    {member.profile?.name || member.email}
                  </p>
                  {member.status === 'active' && member.joined_at && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  )}
                </div>
                {member.profile?.name && (
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                )}
                {member.status === 'pending' && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">Aguardando aceite</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={member.status === 'active' ? 'default' : 'secondary'}
                className="text-xs hidden sm:flex"
              >
                {STATUS_LABELS[member.status]}
              </Badge>

              {canManage && member.status === 'pending' && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => copyInviteLink(member.id)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copiar link de convite</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => handleResendInvite(member)}
                        disabled={resendingId === member.id}
                      >
                        {resendingId === member.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reenviar convite</TooltipContent>
                  </Tooltip>
                </>
              )}

              {canManage && member.role !== 'owner' && member.user_id !== user?.id && member.status === 'active' && (
                <Select
                  value={member.role}
                  onValueChange={(v: any) => handleChangeRole(member.id, v)}
                >
                  <SelectTrigger className="h-7 text-xs w-auto gap-1 border-dashed">
                    <span className="flex items-center gap-1">
                      {ROLE_ICONS[member.role]}
                      {ROLE_LABELS[member.role]}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="professional">Profissional</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {member.role === 'owner' && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Crown className="w-2.5 h-2.5" />
                  Dono
                </Badge>
              )}

              {canManage && member.role !== 'owner' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setRemoveMemberId(member.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={!!removeMemberId} onOpenChange={open => !open && setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Este membro perderá acesso à equipe. Convites pendentes também serão cancelados. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
