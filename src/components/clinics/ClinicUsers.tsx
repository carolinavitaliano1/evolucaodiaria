import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, X, UserPlus, Mail, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type RoleId =
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

const ROLE_OPTIONS: RoleOption[] = [
  { id: 'admin', title: 'Administrador', description: 'Tem acesso a equipe, movimentos financeiros, relatórios e pode ver os atendimentos de todos os profissionais.' },
  { id: 'professional_full', title: 'Profissional · Completo', description: 'Tem acesso a agenda, pacientes e a seus atendimentos.', group: 'professional' },
  { id: 'professional_limited', title: 'Profissional · Limitado', description: 'Tem acesso somente a visualização da sua agenda e registro de atendimentos permitidos.', group: 'professional' },
  { id: 'secretary', title: 'Secretária(o)', description: 'Tem acesso a lista de pacientes e agenda de todos os profissionais.' },
  { id: 'financial_full', title: 'Financeiro completo', description: 'Tem acesso total aos recursos financeiros.' },
  { id: 'financial_individual', title: 'Financeiro individual', description: 'Tem acesso somente aos seus movimentos financeiros.' },
  { id: 'financial_query', title: 'Financeiro consulta', description: 'Tem acesso somente aos movimentos referente as comissões cadastrados para este usuário e não pode alterar e nem excluir.' },
  { id: 'marketing', title: 'Marketing', description: 'Tem acesso ao recurso de Marketing, página da clínica, pesquisa de satisfação, banco de imagens e mensagens de aniversário.' },
  { id: 'auditor', title: 'Auditor/Fiscal', description: 'Tem acesso somente a visualização dos atendimentos referentes aos convênios selecionados. (O usuário auditor não pode ter outras funções).' },
];

function mapRoleToBackend(roleId: RoleId): { role: 'admin' | 'professional'; role_label: string } {
  const opt = ROLE_OPTIONS.find(r => r.id === roleId)!;
  if (roleId === 'admin' || roleId === 'financial_full' || roleId === 'secretary') {
    return { role: 'admin', role_label: opt.title };
  }
  return { role: 'professional', role_label: opt.title };
}

interface Props {
  clinicId: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role_label: string | null;
  status: string;
  created_at: string;
}

export default function ClinicUsers({ clinicId }: Props) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [name, setName] = useState('');
  const [registry, setRegistry] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roleId, setRoleId] = useState<RoleId>('professional_full');
  const [canEditPatients, setCanEditPatients] = useState(true);
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clinics').select('organization_id').eq('id', clinicId).maybeSingle();
      setOrgId(data?.organization_id ?? null);
    })();
  }, [clinicId]);

  useEffect(() => { if (orgId) loadUsers(); }, [orgId]);

  async function loadUsers() {
    if (!orgId) return;
    setLoadingList(true);
    const { data } = await supabase
      .from('organization_members')
      .select('id, email, role_label, status, created_at, user_id, profiles:user_id(name)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    setUsers(
      (data ?? []).map((m: any) => ({
        id: m.id,
        email: m.email,
        name: m.profiles?.name ?? null,
        role_label: m.role_label,
        status: m.status,
        created_at: m.created_at,
      }))
    );
    setLoadingList(false);
  }

  function resetForm() {
    setName(''); setRegistry(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setRoleId('professional_full'); setCanEditPatients(true); setNotes('');
    setPhotoFile(null); setPhotoPreview(''); setSignatureFile(null); setSignaturePreview('');
  }

  function handlePhotoChange(file: File | null) {
    setPhotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(String(e.target?.result || ''));
      reader.readAsDataURL(file);
    } else setPhotoPreview('');
  }

  function handleSignatureChange(file: File | null) {
    setSignatureFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setSignaturePreview(String(e.target?.result || ''));
      reader.readAsDataURL(file);
    } else setSignaturePreview('');
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error('Informe o nome do usuário'); return; }
    if (!email.trim()) { toast.error('Informe o e-mail'); return; }
    if (password.length < 6) { toast.error('A senha deve ter ao menos 6 caracteres'); return; }
    if (password !== confirmPassword) { toast.error('As senhas não conferem'); return; }
    if (!orgId) { toast.error('Clínica sem organização vinculada'); return; }

    setSubmitting(true);
    try {
      const { role, role_label } = mapRoleToBackend(roleId);
      const fullLabel = `${role_label}${canEditPatients ? '' : ' (sem editar/arquivar pacientes)'}${registry ? ` · ${registry}` : ''}`;

      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          organization_id: orgId,
          email: email.trim().toLowerCase(),
          role,
          role_label: fullLabel,
          permissions: [],
          custom_password: password,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success(`Usuário ${name} cadastrado e e-mail enviado para ${email}.`);
      resetForm();
      setShowForm(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao cadastrar usuário');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(memberId: string, memberEmail: string) {
    if (!confirm(`Remover acesso de ${memberEmail}?`)) return;
    const { error } = await supabase.from('organization_members').delete().eq('id', memberId);
    if (error) { toast.error('Erro ao remover'); return; }
    toast.success('Usuário removido');
    loadUsers();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Usuários</h2>
          <p className="text-sm text-muted-foreground">Cadastre quem terá acesso ao sistema desta clínica.</p>
        </div>
        <Button onClick={() => setShowForm(v => !v)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          {showForm ? 'Fechar formulário' : 'Cadastrar novo usuário'}
        </Button>
      </div>

      {/* List of existing users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usuários cadastrados</CardTitle>
          <CardDescription>Pessoas com acesso ao app vinculadas a esta organização.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingList ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback>{(u.name || u.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.name || u.email}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {u.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {u.role_label && <Badge variant="secondary" className="hidden sm:inline-flex">{u.role_label}</Badge>}
                    <Badge
                      variant="outline"
                      className={cn(
                        u.status === 'active' && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                        u.status === 'pending' && 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                      )}
                    >
                      {u.status === 'active' ? 'Ativo' : u.status === 'pending' ? 'Pendente' : u.status}
                    </Badge>
                    <Button size="icon" variant="ghost" onClick={() => handleRemove(u.id, u.email)} title="Remover">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!showForm && null}

      {showForm && (
        <>
          <h3 className="text-xl font-bold text-foreground">Cadastrar novo usuário</h3>

          {/* Card 1 - Acesso */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações e dados de acesso do usuário</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="u-name">Nome <span className="text-destructive">*</span></Label>
                <Input id="u-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="u-registry">Registro</Label>
                <Input id="u-registry" value={registry} onChange={e => setRegistry(e.target.value)} placeholder="Ex: Crefito: 999999-F" />
                <p className="text-xs text-muted-foreground">Informações do registro profissional. Ex: Crefito: 999999-F</p>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="u-email">E-mail <span className="text-destructive">*</span></Label>
                <Input id="u-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-pass">Senha <span className="text-destructive">*</span></Label>
                <Input id="u-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-pass2">Confirmar senha <span className="text-destructive">*</span></Label>
                <Input id="u-pass2" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
              </div>
            </CardContent>
          </Card>

          {/* Card 2 - Permissões */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalize as permissões de acesso aos recursos</CardTitle>
              <CardDescription>Função <span className="text-destructive">*</span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={roleId} onValueChange={(v) => setRoleId(v as RoleId)} className="space-y-2">
                {ROLE_OPTIONS.filter(o => !o.group).map(opt => (
                  <RoleRow key={opt.id} opt={opt} selected={roleId === opt.id} onSelect={() => setRoleId(opt.id)} />
                ))}

                {/* Profissional grouping */}
                <div className={cn(
                  'rounded-lg border-2 transition-all',
                  (roleId === 'professional_full' || roleId === 'professional_limited') ? 'border-primary/40 bg-primary/5' : 'border-border'
                )}>
                  <div className="px-3 py-2.5">
                    <p className="text-sm font-semibold">Profissional</p>
                    <p className="text-xs text-muted-foreground">Selecione o nível de acesso do profissional.</p>
                  </div>
                  <Separator />
                  <div className="p-2 space-y-1">
                    {ROLE_OPTIONS.filter(o => o.group === 'professional').map(opt => (
                      <SubRoleRow key={opt.id} opt={opt} selected={roleId === opt.id} onSelect={() => setRoleId(opt.id)} />
                    ))}
                  </div>
                </div>
              </RadioGroup>

              <Separator />

              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Pode editar ou arquivar pacientes?</p>
                  <p className="text-xs text-muted-foreground">Controla a edição e arquivamento de pacientes pelo usuário.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs', !canEditPatients && 'text-muted-foreground')}>Não</span>
                  <Switch checked={canEditPatients} onCheckedChange={setCanEditPatients} />
                  <span className={cn('text-xs', canEditPatients && 'text-muted-foreground')}>Sim</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3 - Mais informações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mais informações e arquivos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="u-notes">Observações</Label>
                <Textarea id="u-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas internas sobre este usuário..." rows={3} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUploadBox
                  id="u-photo"
                  label="Foto de perfil"
                  accept="image/png,image/jpeg,image/jpg"
                  helper="Apenas no formato PNG, JPG e JPEG."
                  preview={photoPreview}
                  onChange={handlePhotoChange}
                />
                <FileUploadBox
                  id="u-sign"
                  label="Imagem digitalizada da assinatura"
                  accept="image/png,image/jpeg,image/jpg"
                  helper="Apenas no formato PNG, JPG e JPEG."
                  preview={signaturePreview}
                  onChange={handleSignatureChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground italic">Os itens com * são obrigatórios.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { resetForm(); setShowForm(false); }} disabled={submitting}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Salvar usuário
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
        <p className="text-sm font-medium">{opt.title.replace('Profissional · ', '')}</p>
        <p className="text-xs text-muted-foreground leading-snug">{opt.description}</p>
      </div>
    </label>
  );
}

function FileUploadBox({
  id, label, accept, helper, preview, onChange,
}: {
  id: string; label: string; accept: string; helper?: string; preview: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <label
        htmlFor={id}
        className="flex flex-col items-center justify-center gap-2 h-36 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 cursor-pointer transition-colors p-3 text-center"
      >
        {preview ? (
          <div className="relative w-full h-full">
            <img src={preview} alt={label} className="w-full h-full object-contain rounded" />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onChange(null); }}
              className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded-full p-1 border"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Clique ou arraste um arquivo</p>
          </>
        )}
        <input
          id={id}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}