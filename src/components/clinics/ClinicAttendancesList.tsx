import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ChevronDown, ChevronUp, Download, FileSpreadsheet, Search, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

interface Props {
  clinicId: string;
  clinicName: string;
}

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'agendado', label: 'Agendado', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  { value: 'presente', label: 'Atendido', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { value: 'cancelado', label: 'Cancelado', color: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  { value: 'falta', label: 'Faltou', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  { value: 'falta_sem_aviso', label: 'Faltou (sem aviso)', color: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  { value: 'nao_atendido', label: 'Não atendido', color: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300' },
  { value: 'nao_atendido_sem_cobranca', label: 'Não atendido (sem cobrança)', color: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300' },
  { value: 'confirmado', label: 'Presença confirmada', color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300' },
  { value: 'remarcar', label: 'Remarcar', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { value: 'rascunho', label: 'Rascunho', color: 'bg-muted text-muted-foreground' },
];

type Row = {
  id: string;
  date: string;
  time?: string;
  patientId: string;
  patientName: string;
  professional: string;
  procedure: string;
  status: string;
  details?: string;
  createdAt: string;
  hasEvolution: boolean;
  faturado: boolean;
};

export default function ClinicAttendancesList({ clinicId, clinicName }: Props) {
  const { patients, appointments, evolutions } = useApp();

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [professional, setProfessional] = useState<string>('all');
  const [patientQuery, setPatientQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [room, setRoom] = useState<string>('all');
  const [procedure, setProcedure] = useState<string>('all');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [faturado, setFaturado] = useState<string>('all');
  const [autorizacao, setAutorizacao] = useState<string>('');
  const [includeArchivedPros, setIncludeArchivedPros] = useState(false);
  const [includeArchivedPatients, setIncludeArchivedPatients] = useState(false);
  const [includeNoProfessional, setIncludeNoProfessional] = useState(true);
  const [onlyFacial, setOnlyFacial] = useState(false);
  const [onlyPendingApproval, setOnlyPendingApproval] = useState(false);
  const [perPage, setPerPage] = useState<number>(25);
  const [page, setPage] = useState(1);
  const [searched, setSearched] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState<Date | undefined>();
  const [exportTo, setExportTo] = useState<Date | undefined>();
  const [exportIncludeNoPro, setExportIncludeNoPro] = useState(true);

  const clinicPatients = useMemo(
    () => patients.filter(p => p.clinicId === clinicId),
    [patients, clinicId]
  );

  // Build a unified list of "atendimentos" combining appointments and evolutions for this clinic
  const allRows: Row[] = useMemo(() => {
    const evos = evolutions.filter(e => e.clinicId === clinicId);
    const apts = appointments.filter(a => a.clinicId === clinicId);
    const rows: Row[] = [];

    for (const e of evos) {
      const p = clinicPatients.find(p => p.id === e.patientId) || patients.find(p => p.id === e.patientId);
      rows.push({
        id: `evo-${e.id}`,
        date: e.date,
        time: (e as any).time,
        patientId: e.patientId,
        patientName: p?.name || '—',
        professional: (e as any).professionalName || '—',
        procedure: (e as any).procedure || 'Atendimento',
        status: (e as any).attendanceStatus || 'presente',
        details: (e as any).text?.slice(0, 60),
        createdAt: (e as any).createdAt || e.date,
        hasEvolution: true,
        faturado: !!(e as any).billed,
      });
    }

    for (const a of apts) {
      // skip appointments that already have a matching evolution same day+patient
      const sameDayEvo = evos.some(e => e.patientId === a.patientId && e.date === a.date);
      if (sameDayEvo) continue;
      const p = clinicPatients.find(p => p.id === a.patientId) || patients.find(p => p.id === a.patientId);
      rows.push({
        id: `apt-${a.id}`,
        date: a.date,
        time: a.time,
        patientId: a.patientId,
        patientName: p?.name || '—',
        professional: '—',
        procedure: 'Atendimento',
        status: 'agendado',
        details: a.notes?.slice(0, 60),
        createdAt: a.createdAt,
        hasEvolution: false,
        faturado: false,
      });
    }

    return rows.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  }, [evolutions, appointments, clinicId, clinicPatients, patients]);

  const filtered: Row[] = useMemo(() => {
    if (!searched) return [];
    let rows = allRows;
    if (patientQuery.trim()) {
      const q = patientQuery.toLowerCase();
      rows = rows.filter(r => r.patientName.toLowerCase().includes(q));
    }
    if (dateFrom) {
      const from = format(dateFrom, 'yyyy-MM-dd');
      rows = rows.filter(r => r.date >= from);
    }
    if (dateTo) {
      const to = format(dateTo, 'yyyy-MM-dd');
      rows = rows.filter(r => r.date <= to);
    }
    if (statuses.length > 0) {
      rows = rows.filter(r => statuses.includes(r.status));
    }
    if (faturado !== 'all') {
      rows = rows.filter(r => (faturado === 'sim' ? r.faturado : !r.faturado));
    }
    if (!includeNoProfessional) {
      rows = rows.filter(r => r.professional && r.professional !== '—');
    }
    return rows;
  }, [allRows, searched, patientQuery, dateFrom, dateTo, statuses, faturado, includeNoProfessional]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const showingFrom = filtered.length === 0 ? 0 : (page - 1) * perPage + 1;
  const showingTo = Math.min(page * perPage, filtered.length);

  const handleSearch = () => {
    setPage(1);
    setSearched(true);
  };

  const toggleStatus = (val: string) => {
    setStatuses(prev => prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]);
  };

  const handleExport = () => {
    let rows = allRows;
    if (exportFrom) rows = rows.filter(r => r.date >= format(exportFrom, 'yyyy-MM-dd'));
    if (exportTo) rows = rows.filter(r => r.date <= format(exportTo, 'yyyy-MM-dd'));
    if (!exportIncludeNoPro) rows = rows.filter(r => r.professional && r.professional !== '—');

    if (rows.length === 0) {
      toast.error('Nenhum atendimento no período selecionado');
      return;
    }

    // Build HTML-Excel (.xls) — Excel opens this natively, no extra deps
    const header = ['Data', 'Hora', 'Paciente', 'Profissional', 'Procedimento', 'Status', 'Faturado', 'Detalhes'];
    const escape = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>
        <table border="1">
          <thead><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td>${escape(r.date)}</td>
              <td>${escape(r.time || '')}</td>
              <td>${escape(r.patientName)}</td>
              <td>${escape(r.professional)}</td>
              <td>${escape(r.procedure)}</td>
              <td>${escape(STATUS_OPTIONS.find(s => s.value === r.status)?.label || r.status)}</td>
              <td>${r.faturado ? 'Sim' : 'Não'}</td>
              <td>${escape(r.details || '')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </body></html>
    `;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atendimentos-${clinicName.replace(/\s+/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} atendimentos exportados`);
    setExportOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Filters Card */}
      <Card>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Filtros de Busca
            </CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {filtersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Main grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Profissional/Usuário</Label>
                  <Select value={professional} onValueChange={setProfessional}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os profissionais</SelectItem>
                      <SelectItem value="me">Carolina Vitaliano Gurgel Justino Barbosa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Pacientes</Label>
                  <Input
                    placeholder="Buscar paciente..."
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Período (de)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inicial'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Período (até)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Data final'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Sala/Convênio/Área</Label>
                  <Select value={room} onValueChange={setRoom}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as salas</SelectItem>
                      <SelectItem value="particular">Particular</SelectItem>
                      <SelectItem value="musicoterapeuta">Musicoterapeuta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Procedimento</Label>
                  <Select value={procedure} onValueChange={setProcedure}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="atendimento">Atendimento</SelectItem>
                      <SelectItem value="avaliacao">Avaliação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Faturado</Label>
                  <Select value={faturado} onValueChange={setFaturado}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Senha/Autorização/Autenticador</Label>
                  <Input value={autorizacao} onChange={(e) => setAutorizacao(e.target.value)} placeholder="—" />
                </div>
              </div>

              {/* Status multi */}
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map(opt => {
                    const active = statuses.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleStatus(opt.value)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs border transition-colors',
                          active ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Checkboxes row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-border">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={includeArchivedPros} onCheckedChange={(v) => setIncludeArchivedPros(!!v)} />
                  Considerar profissionais arquivados?
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={includeArchivedPatients} onCheckedChange={(v) => setIncludeArchivedPatients(!!v)} />
                  Considerar pacientes arquivados?
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={includeNoProfessional} onCheckedChange={(v) => setIncludeNoProfessional(!!v)} />
                  Sem profissional definido?
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={onlyFacial} onCheckedChange={(v) => setOnlyFacial(!!v)} />
                  Confirmados por reconhecimento facial
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={onlyPendingApproval} onCheckedChange={(v) => setOnlyPendingApproval(!!v)} />
                  Atendimentos aguardando aprovação
                </label>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Resultados por página</Label>
                  <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setExportOpen(true)}
                    className="gap-2 border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar para Excel
                  </Button>
                  <Button onClick={handleSearch} className="gap-2">
                    <Search className="w-4 h-4" />
                    Pesquisar
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status/Evolução/Avaliação</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Procedimento</TableHead>
                <TableHead>Detalhes</TableHead>
                <TableHead>Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ClipboardList className="w-10 h-10 opacity-40" />
                      <p className="text-sm font-medium">Nenhum registro encontrado.</p>
                      <p className="text-xs">Utilize os filtros acima para buscar atendimentos.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paged.map(row => {
                  const statusInfo = STATUS_OPTIONS.find(s => s.value === row.status);
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge className={cn('text-xs', statusInfo?.color || 'bg-muted')}>
                            {statusInfo?.label || row.status}
                          </Badge>
                          {row.hasEvolution && (
                            <Badge variant="outline" className="text-[10px]">Evolução</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(row.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        {row.time && <span className="text-muted-foreground"> {row.time}</span>}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{row.patientName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.professional}</TableCell>
                      <TableCell className="text-sm">{row.procedure}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{row.details || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.createdAt ? format(new Date(row.createdAt), 'dd/MM/yy', { locale: ptBR }) : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar para excel</DialogTitle>
            <DialogDescription>
              Exportar todos os agendamentos do período selecionado para excel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">A partir de:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !exportFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {exportFrom ? format(exportFrom, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={exportFrom} onSelect={setExportFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Até:</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !exportTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {exportTo ? format(exportTo, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={exportTo} onSelect={setExportTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={exportIncludeNoPro} onCheckedChange={(v) => setExportIncludeNoPro(!!v)} />
              Considerar atendimentos sem profissional definido?
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Fechar</Button>
            <Button onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}