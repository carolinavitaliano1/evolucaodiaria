import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, UserPlus, CheckCircle2, Mail, Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import {
  BR_STATES, COUNTRIES, COUNCILS, PIX_TYPES, MARITAL_STATUSES, SEX_OPTIONS,
  DEFAULT_CBOS_OPTIONS, ProfessionalArea,
  maskCPF, maskPhone, maskCEP, maskPix,
} from '@/components/clinics/collaboratorFormUtils';

const emptyArea = (): ProfessionalArea => ({ area: '', council: '', councilNumber: '', councilUF: '', cbosCode: '' });

export default function TeamApplicationPublic() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const [orgName, setOrgName] = useState('');
  const [linkEnabled, setLinkEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Pessoais
  const [name, setName] = useState('');
  const [isSocialName, setIsSocialName] = useState(false);
  const [birthdate, setBirthdate] = useState('');
  const [sex, setSex] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [profession, setProfession] = useState('');
  const [email, setEmail] = useState('');
  const [phoneLandline, setPhoneLandline] = useState('');
  const [cellphone, setCellphone] = useState('');

  // Endereço
  const [country, setCountry] = useState('Brasil');
  const [cep, setCep] = useState('');
  const [stateUF, setStateUF] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [district, setDistrict] = useState('');
  const [complement, setComplement] = useState('');

  // Banco
  const [bankName, setBankName] = useState('');
  const [bankAgency, setBankAgency] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [pixType, setPixType] = useState('');
  const [pixKey, setPixKey] = useState('');

  // Preferências
  const [allowEmailCampaigns, setAllowEmailCampaigns] = useState(false);
  const [allowSystemEmails, setAllowSystemEmails] = useState(true);
  const [prefEmail, setPrefEmail] = useState(true);
  const [prefSms, setPrefSms] = useState(false);
  const [prefWhatsapp, setPrefWhatsapp] = useState(true);

  // Áreas profissionais
  const [areas, setAreas] = useState<ProfessionalArea[]>([emptyArea()]);
  const [cbosOpen, setCbosOpen] = useState<number | null>(null);

  const updateArea = (idx: number, patch: Partial<ProfessionalArea>) => {
    const next = [...areas];
    next[idx] = { ...next[idx], ...patch };
    setAreas(next);
  };
  const removeArea = (idx: number) => {
    if (areas.length <= 1) return;
    setAreas(areas.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    if (!organizationId) return;
    (supabase.rpc as any)('get_organization_for_application', { _org_id: organizationId })
      .then(({ data }: any) => {
        if (data && data.length > 0) {
          setOrgName(data[0].name);
          setLinkEnabled(!!data[0].applications_link_enabled);
        }
        setLoading(false);
      });
  }, [organizationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    // Validação dos obrigatórios
    const required: [string, string][] = [
      [name.trim(), 'Nome'],
      [email.trim(), 'E-mail'],
      [cpf.trim(), 'CPF'],
      [cellphone.trim(), 'Celular'],
      [cep.trim(), 'CEP'],
      [bankName.trim(), 'Banco'],
      [bankAgency.trim(), 'Agência'],
      [bankAccount.trim(), 'Número da conta'],
      [pixType, 'Tipo de chave Pix'],
      [pixKey.trim(), 'Pix'],
    ];
    for (const [val, label] of required) {
      if (!val) { toast.error(`Preencha o campo: ${label}`); return; }
    }
    const validAreas = areas.filter(a => a.area.trim() && a.council && a.councilNumber && a.cbosCode);
    if (validAreas.length === 0) {
      toast.error('Cadastre ao menos uma área profissional completa (Área, Conselho, Nº e CBOS).');
      return;
    }

    setSubmitting(true);
    try {
      const firstArea = validAreas[0];
      const professionalId = firstArea.council && firstArea.councilNumber
        ? `${firstArea.council} ${firstArea.councilUF ? firstArea.councilUF + '/' : ''}${firstArea.councilNumber}`
        : null;
      const specialtiesArr = validAreas.map(a => a.area.trim());

      const { error } = await supabase.from('team_applications' as any).insert({
        organization_id: organizationId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp: cellphone.trim() || null,
        role: firstArea.area.trim() || null,
        birthdate: birthdate || null,
        specialty: specialtiesArr[0] || null,
        specialties: specialtiesArr.length > 0 ? specialtiesArr : null,
        professional_id: professionalId,
        // Novos campos
        is_social_name: isSocialName,
        person_type: 'fisica',
        sex: sex || null,
        cpf: cpf.trim() || null,
        rg: rg.trim() || null,
        marital_status: maritalStatus || null,
        profession: profession.trim() || null,
        phone_landline: phoneLandline.trim() || null,
        cellphone: cellphone.trim() || null,
        country: country || 'Brasil',
        cep: cep.trim() || null,
        state: stateUF || null,
        city: city.trim() || null,
        street: street.trim() || null,
        number: number.trim() || null,
        district: district.trim() || null,
        complement: complement.trim() || null,
        bank_name: bankName.trim() || null,
        bank_agency: bankAgency.trim() || null,
        bank_account: bankAccount.trim() || null,
        pix_type: pixType || null,
        pix_key: pixKey.trim() || null,
        allow_email_campaigns: allowEmailCampaigns,
        allow_system_emails: allowSystemEmails,
        pref_email: prefEmail,
        pref_sms: prefSms,
        pref_whatsapp: prefWhatsapp,
        professional_areas: validAreas,
      } as any);
      if (error) {
        console.error('[team-application] insert error', error);
        throw error;
      }
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar cadastro');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!orgName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-md">
          <p className="text-lg font-semibold text-foreground">Link inválido</p>
          <p className="text-sm text-muted-foreground mt-2">Esta página de cadastro não está disponível.</p>
        </div>
      </div>
    );
  }

  if (!linkEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-md space-y-3">
          <p className="text-lg font-semibold text-foreground">Cadastros pausados</p>
          <p className="text-sm text-muted-foreground">
            <strong>{orgName}</strong> não está aceitando novos cadastros de funcionários no momento.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <div className="bg-card rounded-2xl border border-border p-8 text-center max-w-md space-y-4">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Cadastro enviado!</h2>
          <p className="text-sm text-muted-foreground">
            Recebemos seu cadastro para fazer parte da equipe de <strong>{orgName}</strong>. A administração
            irá revisar seus dados e, ao aprovar, você receberá um e-mail com o convite e seus dados de acesso ao portal.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
            <Mail className="w-3.5 h-3.5" />
            Fique de olho no seu e-mail: <strong>{email}</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6 space-y-2">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UserPlus className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Cadastro de Funcionário</h1>
          <p className="text-sm text-muted-foreground">
            Preencha seus dados para fazer parte da equipe e receber acesso ao portal
          </p>
          <p className="text-xs text-primary font-medium">{orgName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Nome <span className="text-destructive">*</span></Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" required />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Checkbox checked={isSocialName} onCheckedChange={v => setIsSocialName(!!v)} /> É nome social
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Input value="Pessoa física" disabled />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de nascimento</Label>
                  <Input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} max={new Date().toISOString().slice(0,10)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sexo</Label>
                  <Select value={sex} onValueChange={setSex}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{SEX_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CPF <span className="text-destructive">*</span></Label>
                  <Input value={cpf} onChange={e => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">RG</Label>
                  <Input value={rg} onChange={e => setRg(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado civil</Label>
                  <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{MARITAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Profissão</Label>
                  <Input value={profession} onChange={e => setProfession(e.target.value)} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">E-mail <span className="text-destructive">*</span></Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone fixo</Label>
                  <Input value={phoneLandline} onChange={e => setPhoneLandline(maskPhone(e.target.value))} placeholder="(11) 0000-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Celular <span className="text-destructive">*</span></Label>
                  <Input value={cellphone} onChange={e => setCellphone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" required />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados de Endereço</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">País</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CEP <span className="text-destructive">*</span></Label>
                  <Input value={cep} onChange={e => setCep(maskCEP(e.target.value))} placeholder="00000-000" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado</Label>
                  <Select value={stateUF} onValueChange={setStateUF}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>{BR_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Logradouro</Label>
                  <Input value={street} onChange={e => setStreet(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número</Label>
                  <Input value={number} onChange={e => setNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bairro</Label>
                  <Input value={district} onChange={e => setDistrict(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Complemento</Label>
                  <Input value={complement} onChange={e => setComplement(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bancário */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados Bancários</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do banco <span className="text-destructive">*</span></Label>
                  <Input value={bankName} onChange={e => setBankName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Agência <span className="text-destructive">*</span></Label>
                  <Input value={bankAgency} onChange={e => setBankAgency(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número da conta <span className="text-destructive">*</span></Label>
                  <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de chave Pix <span className="text-destructive">*</span></Label>
                  <Select value={pixType} onValueChange={v => { setPixType(v); setPixKey(''); }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{PIX_TYPES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Pix <span className="text-destructive">*</span></Label>
                  <Input value={pixKey} onChange={e => setPixKey(maskPix(e.target.value, pixType))} required />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferências */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferência de Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={allowEmailCampaigns} onCheckedChange={v => setAllowEmailCampaigns(!!v)} /> Permitir o envio de campanhas de e-mail</label>
              <label className="flex items-center gap-2"><Checkbox checked={allowSystemEmails} onCheckedChange={v => setAllowSystemEmails(!!v)} /> Permitir o envio de e-mails de notificação do sistema</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2">
                <label className="flex items-center gap-2"><Checkbox checked={prefEmail} onCheckedChange={v => setPrefEmail(!!v)} /> E-mail</label>
                <label className="flex items-center gap-2"><Checkbox checked={prefSms} onCheckedChange={v => setPrefSms(!!v)} /> SMS</label>
                <label className="flex items-center gap-2"><Checkbox checked={prefWhatsapp} onCheckedChange={v => setPrefWhatsapp(!!v)} /> WhatsApp</label>
              </div>
            </CardContent>
          </Card>

          {/* Registro Profissional */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base">Registro do Profissional</CardTitle>
                  <CardDescription>Cadastre uma ou mais áreas com seu respectivo conselho e código CBOS.</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setAreas([...areas, emptyArea()])}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar área
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {areas.map((item, idx) => (
                <div key={idx} className="rounded-md border p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Área {idx + 1}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeArea(idx)} disabled={areas.length <= 1} aria-label="Remover área">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Área do profissional <span className="text-destructive">*</span></Label>
                      <Input value={item.area} onChange={e => updateArea(idx, { area: e.target.value })} placeholder="Ex: Fisioterapia" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Conselho <span className="text-destructive">*</span></Label>
                      <Select value={item.council || ''} onValueChange={v => updateArea(idx, { council: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>{COUNCILS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Número no conselho <span className="text-destructive">*</span></Label>
                      <Input value={item.councilNumber || ''} onChange={e => updateArea(idx, { councilNumber: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">UF</Label>
                      <Select value={item.councilUF || ''} onValueChange={v => updateArea(idx, { councilUF: v })}>
                        <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>{BR_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Código CBOS <span className="text-destructive">*</span></Label>
                      <Popover open={cbosOpen === idx} onOpenChange={(o) => setCbosOpen(o ? idx : null)}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                            <span className="truncate">
                              {item.cbosCode
                                ? DEFAULT_CBOS_OPTIONS.find(o => o.value === item.cbosCode)?.label || item.cbosCode
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
                                {DEFAULT_CBOS_OPTIONS.map(opt => (
                                  <CommandItem key={opt.value} value={opt.label} onSelect={() => { updateArea(idx, { cbosCode: opt.value }); setCbosOpen(null); }}>
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
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <p className="text-xs italic text-muted-foreground text-center">Os itens com * são obrigatórios</p>
            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Enviar cadastro
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Seus dados serão tratados com sigilo. A administração revisará seu cadastro antes de liberar o acesso ao portal.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}