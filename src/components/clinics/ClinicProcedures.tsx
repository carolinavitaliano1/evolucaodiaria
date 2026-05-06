import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Copy, Download, FileSpreadsheet, Loader2, Plus, Search, Trash2, Stethoscope } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { Users } from 'lucide-react';

interface Props {
  clinicId: string;
  clinicName: string;
}

interface Procedure {
  id: string;
  name: string;
  value: number;
  commission_type: 'valor_fixo' | 'porcentagem';
  commission_value: number;
  tuss_code: string | null;
  health_plans: string[];
  allow_value_change: boolean;
  apply_to_all_professionals: boolean;
  created_at: string;
}

interface HealthPlan { id: string; name: string }

const emptyForm = {
  name: '',
  value: 0,
  commission_type: 'valor_fixo' as 'valor_fixo' | 'porcentagem',
  commission_value: 0,
  tuss_code: '',
  health_plans: [] as string[],
  allow_value_change: false,
  apply_to_all_professionals: false,
};

export default function ClinicProcedures({ clinicId, clinicName }: Props) {
  const { user } = useAuth();
  const { members } = useClinicOrg(clinicId);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [healthPlans, setHealthPlans] = useState<HealthPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [professional, setProfessional] = useState<string>('me');
  const [profileName, setProfileName] = useState<string>('');
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  /** Override de comissão por profissional para o procedimento em edição.
   *  Chave = member_id, Valor = { type, value } */
  const [memberCommissions, setMemberCommissions] = useState<
    Record<string, { type: 'valor_fixo' | 'porcentagem'; value: number }>
  >({});

  // Load profile name + procedures + health plans
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('name, clinical_area')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) {
          setProfileName(data.clinical_area ? `${data.name} (${data.clinical_area})` : data.name);
        }
      });
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    const [proc, plans] = await Promise.all([
      supabase.from('procedures').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
      supabase.from('health_plans').select('id, name').eq('clinic_id', clinicId).eq('is_active', true).order('name'),
    ]);
    if (proc.data) setProcedures(proc.data as any);
    if (plans.data) setHealthPlans(plans.data as any);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const planOptions = useMemo(() => {
    const opts = healthPlans.map(p => ({ value: p.id, label: p.name }));
    return [{ value: 'particular', label: 'Particular' }, ...opts];
  }, [healthPlans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return procedures;
    return procedures.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.tuss_code || '').toLowerCase().includes(q)
    );
  }, [procedures, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const showingFrom = filtered.length === 0 ? 0 : (page - 1) * perPage + 1;
  const showingTo = Math.min(page * perPage, filtered.length);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleSelectAll = () => {
    if (selected.size === paged.length && paged.length > 0) setSelected(new Set());
    else setSelected(new Set(paged.map(p => p.id)));
  };

  const togglePlan = (val: string) => {
    setForm(f => ({
      ...f,
      health_plans: f.health_plans.includes(val)
        ? f.health_plans.filter(p => p !== val)
        : [...f.health_plans, val],
    }));
  };

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setMemberCommissions({});
    setView('form');
  };

  const openEdit = (p: Procedure) => {
    setForm({
      name: p.name,
      value: Number(p.value || 0),
      commission_type: p.commission_type,
      commission_value: Number(p.commission_value || 0),
      tuss_code: p.tuss_code || '',
      health_plans: p.health_plans || [],
      allow_value_change: p.allow_value_change,
      apply_to_all_professionals: p.apply_to_all_professionals,
    });
    setEditingId(p.id);
    setView('form');
    // carrega overrides por profissional
    supabase
      .from('procedure_commissions' as any)
      .select('member_id, commission_value, commission_type')
      .eq('procedure_id', p.id)
      .then(({ data }) => {
        const map: Record<string, { type: 'valor_fixo' | 'porcentagem'; value: number }> = {};
        ((data || []) as any[]).forEach(r => {
          map[r.member_id] = { type: r.commission_type, value: Number(r.commission_value) || 0 };
        });
        setMemberCommissions(map);
      });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('O nome do procedimento é obrigatório');
      return;
    }
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      clinic_id: clinicId,
      name: form.name.trim(),
      value: form.value || 0,
      commission_type: form.commission_type,
      commission_value: form.commission_value || 0,
      tuss_code: form.tuss_code || null,
      health_plans: form.health_plans,
      allow_value_change: form.allow_value_change,
      apply_to_all_professionals: form.apply_to_all_professionals,
    };
    const { error } = editingId
      ? await supabase.from('procedures').update(payload).eq('id', editingId)
      : await supabase.from('procedures').insert(payload);
    if (error) {
      setSaving(false);
      toast.error('Erro ao salvar procedimento');
      return;
    }

    // salva overrides de comissão por profissional
    const procId = editingId ?? (await supabase
      .from('procedures')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('name', payload.name)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()).data?.id;

    if (procId) {
      // apaga existentes e recria (idempotente e simples)
      await supabase.from('procedure_commissions' as any).delete().eq('procedure_id', procId);
      const inserts = Object.entries(memberCommissions)
        .filter(([, v]) => v.value > 0)
        .map(([member_id, v]) => ({
          procedure_id: procId,
          member_id,
          commission_type: v.type,
          commission_value: v.value,
        }));
      if (inserts.length) {
        const { error: cErr } = await supabase
          .from('procedure_commissions' as any)
          .insert(inserts);
        if (cErr) toast.warning('Procedimento salvo, mas falhou ao salvar comissões: ' + cErr.message);
      }
    }

    setSaving(false);
    toast.success(editingId ? 'Procedimento atualizado' : 'Procedimento cadastrado');
    setView('list');
    setForm(emptyForm);
    setEditingId(null);
    setMemberCommissions({});
    loadAll();
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from('procedures').delete().in('id', ids);
    if (error) {
      toast.error('Erro ao excluir');
      return;
    }
    toast.success(`${ids.length} procedimento(s) excluído(s)`);
    setSelected(new Set());
    loadAll();
  };

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      toast.error('Nenhum procedimento para exportar');
      return;
    }
    const header = ['Nome', 'Valor (R$)', 'Tipo Comissão', 'Comissão', 'TUSS', 'Convênios', 'Cadastro'];
    const escape = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const planLabel = (ids: string[]) =>
      ids.map(id => planOptions.find(o => o.value === id)?.label || id).join(', ');
    const html = `
      <html><head><meta charset="UTF-8"></head><body>
      <table border="1">
        <thead><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>
          ${filtered.map(p => `<tr>
            <td>${escape(p.name)}</td>
            <td>${Number(p.value).toFixed(2)}</td>
            <td>${p.commission_type === 'porcentagem' ? 'Porcentagem' : 'Valor fixo'}</td>
            <td>${Number(p.commission_value).toFixed(2)}</td>
            <td>${escape(p.tuss_code || '')}</td>
            <td>${escape(planLabel(p.health_plans || []))}</td>
            <td>${format(new Date(p.created_at), 'dd/MM/yyyy')}</td>
          </tr>`).join('')}
        </tbody>
      </table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `procedimentos-${clinicName.replace(/\s+/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================ FORM VIEW ============================
  if (view === 'form') {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            {editingId ? 'Editar procedimento' : 'Cadastrar procedimento'}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => { setView('list'); setEditingId(null); }} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Linha 1 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs">Nome: *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Sessão de Musicoterapia" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Convênios:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    {form.health_plans.length === 0 ? (
                      <span className="text-muted-foreground">Selecione...</span>
                    ) : (
                      `${form.health_plans.length} selecionado(s)`
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {planOptions.map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer text-sm">
                        <Checkbox
                          checked={form.health_plans.includes(opt.value)}
                          onCheckedChange={() => togglePlan(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                    {planOptions.length === 1 && (
                      <p className="text-xs text-muted-foreground p-2">
                        Cadastre convênios na aba "Convênios" para vincular aqui.
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Linha 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$): *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Alterar valor:</Label>
              <Select
                value={form.allow_value_change ? 'sim' : 'nao'}
                onValueChange={(v) => setForm({ ...form, allow_value_change: v === 'sim' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo da comissão:</Label>
              <Select
                value={form.commission_type}
                onValueChange={(v) => setForm({ ...form, commission_type: v as 'valor_fixo' | 'porcentagem' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor_fixo">Valor fixo</SelectItem>
                  <SelectItem value="porcentagem">Porcentagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Comissão {form.commission_type === 'porcentagem' ? '(%):' : '(R$):'}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={form.commission_value}
                onChange={(e) => setForm({ ...form, commission_value: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Código TUSS:</Label>
              <Input value={form.tuss_code} onChange={(e) => setForm({ ...form, tuss_code: e.target.value })} />
            </div>
          </div>

          {/* Linha 4 */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={form.apply_to_all_professionals}
              onCheckedChange={(v) => setForm({ ...form, apply_to_all_professionals: !!v })}
            />
            Aplicar este procedimento para todos os profissionais?
          </label>

          {/* Comissões por profissional (override) */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold">Comissão por profissional (opcional)</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Configure um valor ou percentual de comissão diferente para cada profissional neste procedimento.
              Quem ficar em branco usa a comissão padrão acima.
            </p>
            {members.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum profissional cadastrado nesta clínica.</p>
            ) : (
              <div className="space-y-2">
                {members.map(m => {
                  const cur = memberCommissions[m.memberId] || { type: 'porcentagem' as const, value: 0 };
                  return (
                    <div key={m.memberId} className="grid grid-cols-1 sm:grid-cols-[1fr_140px_120px] gap-2 items-center">
                      <div className="text-sm truncate">{m.name || m.email}</div>
                      <Select
                        value={cur.type}
                        onValueChange={(v) => setMemberCommissions(prev => ({
                          ...prev,
                          [m.memberId]: { type: v as any, value: cur.value },
                        }))}
                      >
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="porcentagem">Porcentagem (%)</SelectItem>
                          <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={cur.value || ''}
                        onChange={(e) => setMemberCommissions(prev => ({
                          ...prev,
                          [m.memberId]: { type: cur.type, value: parseFloat(e.target.value) || 0 },
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-2 pt-3 border-t border-border">
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
            <p className="text-xs italic text-muted-foreground">Os itens com * são obrigatórios</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================ LIST VIEW ============================
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            Meus procedimentos
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" disabled title="Em breve">
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Copiar de outro profissional</span>
              <span className="sm:hidden">Copiar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="gap-2 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar para excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
            <Button size="sm" onClick={openNew} className="gap-2">
              <Plus className="w-4 h-4" /> Cadastrar novo
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Profissional</Label>
            <Select value={professional} onValueChange={setProfessional}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="me">{profileName || 'Meu perfil'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bulk action row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={handleDeleteSelected}
              className="gap-2 text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <Trash2 className="w-4 h-4" /> Excluir
            </Button>
            <Button variant="outline" size="sm" disabled={selected.size === 0} className="gap-2" title="Em breve">
              <Copy className="w-4 h-4" /> Copiar para
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 por página</SelectItem>
                <SelectItem value="25">25 por página</SelectItem>
                <SelectItem value="50">50 por página</SelectItem>
                <SelectItem value="100">100 por página</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Pesquisar..."
                className="pl-8 h-9 w-48 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={paged.length > 0 && selected.size === paged.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Convênios</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando...
                  </TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Stethoscope className="w-10 h-10 opacity-40" />
                      <p className="text-sm font-medium">Nenhum registro encontrado</p>
                      <p className="text-xs">Clique em "+ Cadastrar novo" para começar.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paged.map(p => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={(e) => {
                    // Don't trigger edit on checkbox click
                    if ((e.target as HTMLElement).closest('[role="checkbox"], button')) return;
                    openEdit(p);
                  }}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>R$ {Number(p.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      {p.commission_type === 'porcentagem'
                        ? `${Number(p.commission_value).toFixed(2)}%`
                        : `R$ ${Number(p.commission_value).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(p.health_plans || []).slice(0, 2).map(id => {
                          const opt = planOptions.find(o => o.value === id);
                          return (
                            <Badge key={id} variant="outline" className="text-[10px]">
                              {opt?.label || id}
                            </Badge>
                          );
                        })}
                        {(p.health_plans?.length || 0) > 2 && (
                          <Badge variant="outline" className="text-[10px]">+{p.health_plans.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(p.created_at), 'dd/MM/yy', { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Mostrando {showingFrom} até {showingTo} de {filtered.length} registros
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages || filtered.length === 0} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              Próximo
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}