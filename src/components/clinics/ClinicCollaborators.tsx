import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Upload, Plus, Save, Trash2, Pencil, Check, ChevronsUpDown, UserCog } from 'lucide-react';
import { toast } from 'sonner';

type Collaborator = {
  id: string;
  name: string;
  isSocialName: boolean;
  personType: 'fisica' | 'juridica';
  birthdate?: string;
  sex?: string;
  cpf?: string;
  rg?: string;
  maritalStatus?: string;
  profession?: string;
  email?: string;
  phoneLandline?: string;
  cellphone?: string;
  professionalAreas?: { area: string; council?: string; councilNumber?: string; councilUF?: string; cbosCode?: string }[];
  // Address
  country?: string;
  cep?: string;
  state?: string;
  city?: string;
  street?: string;
  number?: string;
  district?: string;
  complement?: string;
  // Bank
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixType?: string;
  pixKey?: string;
  // Preferences
  allowEmailCampaigns: boolean;
  allowSystemEmails: boolean;
  prefEmail: boolean;
  prefSms: boolean;
  prefWhatsapp: boolean;
  // Council
  council?: string;
  councilNumber?: string;
  councilUF?: string;
  cbosCode?: string;
  avatarUrl?: string;
};

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const COUNTRIES = ['Brasil','Argentina','Chile','Estados Unidos','Portugal','Espanha','Uruguai','Paraguai'];
const COUNCILS = ['CRM','CRP','CREFITO','COREN','CRO','CRN','CRF','CRFa','Outro'];
const PIX_TYPES = ['CPF','CNPJ','Telefone','Email','Chave aleatória'];
const DEFAULT_CBOS_OPTIONS = [
  { value: '2515-50', label: 'Psicopedagogo' },
  { value: '2263-15', label: 'Musicoterapeuta' },
  { value: '2236-05', label: 'Psicomotricista' },
  { value: '2515-10', label: 'Psicólogo clínico' },
  { value: '2236-50', label: 'Fisioterapeuta' },
  { value: '2236-25', label: 'Fonoaudiólogo' },
  { value: '2239-05', label: 'Terapeuta ocupacional' },
  { value: '2231-40', label: 'Médico clínico' },
];

const emptyForm = (): Collaborator => ({
  id: '',
  name: '',
  isSocialName: false,
  personType: 'fisica',
  country: 'Brasil',
  allowEmailCampaigns: false,
  allowSystemEmails: true,
  prefEmail: true,
  prefSms: false,
  prefWhatsapp: true,
});

function maskCPF(v: string) {
  return v.replace(/\D/g,'').slice(0,11)
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d{1,2})$/,'$1-$2');
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g,'').slice(0,11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3').trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3').trim();
}
function maskCEP(v: string) {
  return v.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d)/,'$1-$2');
}
function maskCNPJ(v: string) {
  return v.replace(/\D/g,'').slice(0,14)
    .replace(/(\d{2})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1/$2')
    .replace(/(\d{4})(\d{1,2})$/,'$1-$2');
}

function maskPix(v: string, type?: string) {
  switch (type) {
    case 'CPF': return maskCPF(v);
    case 'CNPJ': return maskCNPJ(v);
    case 'Telefone': return maskPhone(v);
    default: return v;
  }
}

interface Props {
  clinicId: string;
  clinicName?: string;
}

export default function ClinicCollaborators({ clinicId }: Props) {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [list, setList] = useState<Collaborator[]>([]);
  const [form, setForm] = useState<Collaborator>(emptyForm());
  const [cbosOpen, setCbosOpen] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storageKey = `clinic-collaborators:${clinicId}`;
  const cbosStorageKey = `clinic-cbos-options:${clinicId}`;
  const [birthdateText, setBirthdateText] = useState('');
  const [cbosOptions, setCbosOptions] = useState<{ value: string; label: string }[]>(DEFAULT_CBOS_OPTIONS);
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [newRoleTarget, setNewRoleTarget] = useState<number | null>(null);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');

  // Sync text when form.birthdate changes (load/edit/calendar pick)
  useMemo(() => {
    if (form.birthdate) {
      setBirthdateText(format(new Date(form.birthdate + 'T12:00:00'), 'dd/MM/yyyy'));
    } else {
      setBirthdateText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.birthdate]);

  // Load from localStorage on mount
  useMemo(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setList(JSON.parse(raw));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  // Load custom CBOS options
  useMemo(() => {
    try {
      const raw = localStorage.getItem(cbosStorageKey);
      if (raw) {
        const custom = JSON.parse(raw) as { value: string; label: string }[];
        const merged = [...DEFAULT_CBOS_OPTIONS];
        custom.forEach(c => {
          if (!merged.some(m => m.value === c.value)) merged.push(c);
        });
        setCbosOptions(merged);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const openNewRoleDialog = (idx: number | null) => {
    setNewRoleTarget(idx);
    setNewRoleLabel('');
    setNewRoleCode('');
    setNewRoleOpen(true);
  };

  const saveNewRole = () => {
    const label = newRoleLabel.trim();
    const code = newRoleCode.trim();
    if (!label) {
      toast.error('Informe o nome da função');
      return;
    }
    const value = code || `custom-${Date.now()}`;
    if (cbosOptions.some(o => o.value === value)) {
      toast.error('Já existe uma função com este código');
      return;
    }
    const next = [...cbosOptions, { value, label }];
    setCbosOptions(next);
    try {
      const customs = next.filter(o => !DEFAULT_CBOS_OPTIONS.some(d => d.value === o.value));
      localStorage.setItem(cbosStorageKey, JSON.stringify(customs));
    } catch {}
    if (newRoleTarget !== null) {
      const base = form.professionalAreas && form.professionalAreas.length > 0
        ? [...form.professionalAreas]
        : [{ area: '', council: '', councilNumber: '', councilUF: '', cbosCode: '' }];
      base[newRoleTarget] = { ...base[newRoleTarget], cbosCode: value };
      update('professionalAreas', base);
    }
    setNewRoleOpen(false);
    toast.success('Função cadastrada');
  };

  const persist = (next: Collaborator[]) => {
    setList(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  };

  const update = <K extends keyof Collaborator>(key: K, value: Collaborator[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleAvatar = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => update('avatarUrl', reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('O nome é obrigatório');
      return;
    }
    const next = form.id
      ? list.map(c => c.id === form.id ? form : c)
      : [...list, { ...form, id: crypto.randomUUID() }];
    persist(next);
    toast.success(form.id ? 'Colaborador atualizado' : 'Colaborador cadastrado');
    setForm(emptyForm());
    setView('list');
  };

  const handleEdit = (c: Collaborator) => {
    setForm(c);
    setView('form');
  };

  const handleDelete = (id: string) => {
    persist(list.filter(c => c.id !== id));
    toast.success('Colaborador removido');
  };

  const handleNew = () => {
    setForm(emptyForm());
    setView('form');
  };

  if (view === 'list') {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UserCog className="w-5 h-5 text-primary" />
              Colaboradores
            </CardTitle>
            <CardDescription>Gerencie os colaboradores cadastrados desta clínica.</CardDescription>
          </div>
          <Button onClick={handleNew}><Plus className="w-4 h-4 mr-1" /> Novo colaborador</Button>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCog className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum colaborador cadastrado ainda.</p>
              <Button variant="outline" className="mt-4" onClick={handleNew}>
                <Plus className="w-4 h-4 mr-1" /> Cadastrar primeiro colaborador
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Profissão</TableHead>
                    <TableHead>Conselho</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={c.avatarUrl} />
                          <AvatarFallback>{c.name.slice(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{c.name}</span>
                      </TableCell>
                      <TableCell>{c.profession || '-'}</TableCell>
                      <TableCell>{c.council ? <Badge variant="secondary">{c.council} {c.councilNumber || ''}</Badge> : '-'}</TableCell>
                      <TableCell>{c.cellphone || c.phoneLandline || '-'}</TableCell>
                      <TableCell>{c.email || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // FORM
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" />
              Cadastrar colaboradores
            </CardTitle>
            <CardDescription>Preencha as informações do profissional. Os campos com * são obrigatórios.</CardDescription>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-20 w-20">
              <AvatarImage src={form.avatarUrl} />
              <AvatarFallback>{(form.name || 'FT').slice(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleAvatar(e.target.files[0])}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Foto
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* 1. Dados Pessoais */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome: *</Label>
            <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Nome completo" />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Checkbox id="social" checked={form.isSocialName} onCheckedChange={v => update('isSocialName', !!v)} />
            <Label htmlFor="social" className="cursor-pointer">É nome social</Label>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo:</Label>
            <Select value={form.personType} onValueChange={(v: 'fisica' | 'juridica') => update('personType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fisica">Pessoa física</SelectItem>
                <SelectItem value="juridica">Pessoa jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Data de nascimento:</Label>
            <div className="flex gap-1">
              <Input
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                maxLength={10}
                value={birthdateText}
                onChange={e => {
                  const d = e.target.value.replace(/\D/g,'').slice(0,8);
                  let masked = d;
                  if (d.length > 4) masked = `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
                  else if (d.length > 2) masked = `${d.slice(0,2)}/${d.slice(2)}`;
                  setBirthdateText(masked);
                  if (d.length === 0) {
                    update('birthdate', undefined);
                  } else if (d.length === 8) {
                    const dd = d.slice(0,2), mm = d.slice(2,4), yyyy = d.slice(4,8);
                    const dt = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
                    if (!isNaN(dt.getTime()) && dt.getFullYear() >= 1900) {
                      update('birthdate', `${yyyy}-${mm}-${dd}`);
                    }
                  }
                }}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" type="button" aria-label="Abrir calendário">
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    captionLayout="dropdown-buttons"
                    fromYear={1920}
                    toYear={new Date().getFullYear()}
                    defaultMonth={form.birthdate ? new Date(form.birthdate + 'T12:00:00') : new Date(1990, 0, 1)}
                    selected={form.birthdate ? new Date(form.birthdate + 'T12:00:00') : undefined}
                    onSelect={d => update('birthdate', d ? format(d, 'yyyy-MM-dd') : undefined)}
                    locale={ptBR}
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Sexo:</Label>
            <Select value={form.sex} onValueChange={v => update('sex', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>CPF:</Label>
            <Input value={form.cpf || ''} onChange={e => update('cpf', maskCPF(e.target.value))} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-1.5">
            <Label>RG:</Label>
            <Input value={form.rg || ''} onChange={e => update('rg', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Estado civil:</Label>
            <Select value={form.maritalStatus} onValueChange={v => update('maritalStatus', v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                <SelectItem value="casado">Casado(a)</SelectItem>
                <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                <SelectItem value="separado">Separado(a)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Profissão:</Label>
            <Input value={form.profession || ''} onChange={e => update('profession', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail:</Label>
            <Input type="email" value={form.email || ''} onChange={e => update('email', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone fixo:</Label>
            <Input value={form.phoneLandline || ''} onChange={e => update('phoneLandline', maskPhone(e.target.value))} placeholder="(00) 0000-0000" />
          </div>
          <div className="space-y-1.5">
            <Label>Celular:</Label>
            <Input value={form.cellphone || ''} onChange={e => update('cellphone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
          </div>

        </CardContent>
      </Card>

      {/* 2. Endereço */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados de Endereço</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>País:</Label>
            <Select value={form.country || 'Brasil'} onValueChange={v => update('country', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>CEP:</Label>
            <Input value={form.cep || ''} onChange={e => update('cep', maskCEP(e.target.value))} placeholder="00000-000" />
          </div>
          <div className="space-y-1.5">
            <Label>Estado:</Label>
            <Select value={form.state} onValueChange={v => update('state', v)}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{BR_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Cidade:</Label>
            <Input value={form.city || ''} onChange={e => update('city', e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Logradouro:</Label>
            <Input value={form.street || ''} onChange={e => update('street', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Número:</Label>
            <Input value={form.number || ''} onChange={e => update('number', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Bairro:</Label>
            <Input value={form.district || ''} onChange={e => update('district', e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
            <Label>Complemento:</Label>
            <Input value={form.complement || ''} onChange={e => update('complement', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* 3. Bancário */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados Bancários</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Nome do banco:</Label>
            <Input value={form.bankName || ''} onChange={e => update('bankName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Agência:</Label>
            <Input value={form.bankAgency || ''} onChange={e => update('bankAgency', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Número da conta:</Label>
            <Input value={form.bankAccount || ''} onChange={e => update('bankAccount', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de chave Pix:</Label>
            <Select value={form.pixType} onValueChange={v => { update('pixType', v); update('pixKey', ''); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{PIX_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Pix:</Label>
            <Input value={form.pixKey || ''} onChange={e => update('pixKey', maskPix(e.target.value, form.pixType))} placeholder="Chave Pix" />
          </div>
        </CardContent>
      </Card>

      {/* 4. Preferências */}
      <Card>
        <CardHeader><CardTitle className="text-base">Preferência de Contato</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { key: 'allowEmailCampaigns', label: 'Permitir o envio de campanhas de e-mail' },
            { key: 'allowSystemEmails', label: 'Permitir o envio de e-mails de notificação do sistema' },
            { key: 'prefEmail', label: 'E-mail' },
            { key: 'prefSms', label: 'SMS' },
            { key: 'prefWhatsapp', label: 'WhatsApp' },
          ].map(opt => (
            <div key={opt.key} className="flex items-center gap-2">
              <Checkbox
                id={opt.key}
                checked={(form as any)[opt.key]}
                onCheckedChange={v => update(opt.key as keyof Collaborator, !!v as any)}
              />
              <Label htmlFor={opt.key} className="cursor-pointer text-sm">{opt.label}</Label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 5. Registro do Profissional */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base">Registro do Profissional</CardTitle>
              <CardDescription>Cadastre uma ou mais áreas com seu respectivo conselho e código CBOS.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => toast.info('Cadastro de nova função em breve')}>
                + cadastrar nova função
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = [...(form.professionalAreas || []), { area: '', council: '', councilNumber: '', councilUF: '', cbosCode: '' }];
                  update('professionalAreas', next);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar área
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(form.professionalAreas && form.professionalAreas.length > 0
            ? form.professionalAreas
            : [{ area: '', council: '', councilNumber: '', councilUF: '', cbosCode: '' }]
          ).map((item, idx) => {
            const updateItem = (patch: Partial<NonNullable<Collaborator['professionalAreas']>[number]>) => {
              const base = form.professionalAreas && form.professionalAreas.length > 0
                ? [...form.professionalAreas]
                : [{ area: '', council: '', councilNumber: '', councilUF: '', cbosCode: '' }];
              base[idx] = { ...base[idx], ...patch };
              update('professionalAreas', base);
            };
            const removeItem = () => {
              const base = [...(form.professionalAreas || [])];
              base.splice(idx, 1);
              update('professionalAreas', base);
            };
            return (
              <div key={idx} className="rounded-md border p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Área {idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={removeItem}
                    disabled={!form.professionalAreas || form.professionalAreas.length <= 1}
                    aria-label="Remover área"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="space-y-1.5 lg:col-span-1">
                    <Label className="text-xs">Área do profissional</Label>
                    <Input value={item.area || ''} onChange={e => updateItem({ area: e.target.value })} placeholder="Ex: Fisioterapia" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Conselho</Label>
                    <Select value={item.council || ''} onValueChange={v => updateItem({ council: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>{COUNCILS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Número no conselho</Label>
                    <Input value={item.councilNumber || ''} onChange={e => updateItem({ councilNumber: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">UF</Label>
                    <Select value={item.councilUF || ''} onValueChange={v => updateItem({ councilUF: v })}>
                      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                      <SelectContent>{BR_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Código CBOS</Label>
                    <Popover open={cbosOpen === idx} onOpenChange={(o) => setCbosOpen(o ? idx : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                          <span className="truncate">
                            {item.cbosCode
                              ? cbosOptions.find(o => o.value === item.cbosCode)?.label || item.cbosCode
                              : 'Selecionar...'}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar código..." />
                          <CommandList>
                            <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                            <CommandGroup>
                              {cbosOptions.map(opt => (
                                <CommandItem
                                  key={opt.value}
                                  value={opt.label}
                                  onSelect={() => { updateItem({ cbosCode: opt.value }); setCbosOpen(null); }}
                                >
                                  <Check className={cn('mr-2 h-4 w-4', item.cbosCode === opt.value ? 'opacity-100' : 'opacity-0')} />
                                  <span className="font-mono text-xs mr-2">{opt.value}</span> {opt.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Footer */}
      <Card>
        <CardContent className="pt-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <button type="button" className="text-sm text-primary hover:underline text-left" onClick={() => toast.info('Lista de códigos identificadores por convênio em breve')}>
              Lista de códigos identificadores por convênio
            </button>
            <p className="text-xs italic text-muted-foreground">Os itens com * são obrigatórios</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { setForm(emptyForm()); setView('list'); }}>Cancelar</Button>
            <Button onClick={handleSave}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
