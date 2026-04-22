import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useApp } from '@/contexts/AppContext';
import { Users, Search, Trash2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { ClinicPackage } from '@/types';

interface PackagePatientsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pkg: ClinicPackage | null;
}

export function PackagePatientsModal({ open, onOpenChange, pkg }: PackagePatientsModalProps) {
  const { patients, updatePatient } = useApp();
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const linkedPatients = useMemo(
    () => patients.filter(p => p.packageId === pkg?.id && isPatientActiveOn(p)),
    [patients, pkg?.id]
  );

  const linkablePatients = useMemo(() => {
    if (!pkg) return [];
    return patients
      .filter(p => p.clinicId === pkg.clinicId && p.packageId !== pkg.id && isPatientActiveOn(p))
      .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  }, [patients, pkg, search]);

  const handleRemove = async (patientId: string) => {
    try {
      await updatePatient(patientId, { packageId: null as any });
      toast.success('Paciente desvinculado do pacote');
    } catch {
      toast.error('Erro ao desvincular');
    }
  };

  const handleLink = async () => {
    if (!pkg || selected.size === 0) return;
    try {
      await Promise.all(
        Array.from(selected).map(id => updatePatient(id, { packageId: pkg.id as any }))
      );
      toast.success(`${selected.size} paciente(s) vinculado(s) ao pacote`);
      setSelected(new Set());
      setLinking(false);
    } catch {
      toast.error('Erro ao vincular pacientes');
    }
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!pkg) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Pacientes — {pkg.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!linking ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{linkedPatients.length}</strong> paciente(s) neste pacote
                </p>
                <Button size="sm" className="h-8 gap-1.5" onClick={() => setLinking(true)}>
                  <Plus className="w-3 h-3" /> Vincular
                </Button>
              </div>

              {linkedPatients.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum paciente vinculado a este pacote.
                </div>
              ) : (
                <ScrollArea className="max-h-72">
                  <div className="space-y-1.5">
                    {linkedPatients.map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          {p.contractStartDate && (
                            <p className="text-[10px] text-muted-foreground">
                              Desde {new Date(p.contractStartDate).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemove(p.id)}
                          title="Remover do pacote"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar paciente..."
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setLinking(false); setSelected(new Set()); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {linkablePatients.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {search ? 'Nenhum paciente encontrado' : 'Todos os pacientes já estão neste pacote'}
                </div>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-1">
                    {linkablePatients.map(p => {
                      const inAnotherPkg = !!p.packageId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggle(p.id)}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                            {inAnotherPkg && (
                              <p className="text-[10px] text-warning">
                                Trocará de pacote
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button variant="outline" className="flex-1" onClick={() => { setLinking(false); setSelected(new Set()); }}>
                  Cancelar
                </Button>
                <Button className="flex-1" disabled={selected.size === 0} onClick={handleLink}>
                  Vincular {selected.size > 0 ? `(${selected.size})` : ''}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}