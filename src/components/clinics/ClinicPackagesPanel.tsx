import { useState } from 'react';
import { Package, Plus, Edit, Trash2, Users, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';
import { PackagePatientsModal } from '@/components/clinics/PackagePatientsModal';

interface Props {
  clinicId: string;
}

type PackageType = 'mensal' | 'por_sessao' | 'personalizado';

export function ClinicPackagesPanel({ clinicId }: Props) {
  const { clinics, patients, getClinicPackages, addPackage, updatePackage, deletePackage } = useApp();
  const clinic = clinics.find(c => c.id === clinicId);
  const clinicPackages = getClinicPackages(clinicId);

  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [newPackage, setNewPackage] = useState({ name: '', description: '', price: '', packageType: 'mensal' as PackageType, sessionLimit: '' });
  const [editingPackage, setEditingPackage] = useState<{ id: string; name: string; description: string; price: string; packageType: PackageType; sessionLimit: string } | null>(null);
  const [viewingPackagePatients, setViewingPackagePatients] = useState<any | null>(null);

  const buildExportData = () =>
    clinicPackages.map(pkg => ({
      pkg,
      patients: patients.filter(p => p.packageId === pkg.id && !p.isArchived),
    }));

  const exportCSV = () => {
    if (!clinic) return;
    const data = buildExportData();
    const escape = (v: any) => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Pacote', 'Tipo', 'Valor (R$)', 'Sessões', 'Paciente', 'Telefone', 'Início do contrato'];
    const rows: string[] = [header.join(';')];
    data.forEach(({ pkg, patients: pts }) => {
      const tipo = pkg.packageType === 'por_sessao' ? 'Por Sessão' : pkg.packageType === 'personalizado' ? 'Personalizado' : 'Mensal';
      const sessoes = pkg.packageType === 'personalizado' && pkg.sessionLimit ? String(pkg.sessionLimit) : '-';
      if (pts.length === 0) {
        rows.push([pkg.name, tipo, pkg.price.toFixed(2), sessoes, '(sem pacientes)', '', ''].map(escape).join(';'));
      } else {
        pts.forEach(p => {
          rows.push([
            pkg.name, tipo, pkg.price.toFixed(2), sessoes,
            p.name, (p as any).whatsapp || (p as any).phone || '',
            (p as any).contractStartDate ? new Date((p as any).contractStartDate).toLocaleDateString('pt-BR') : '',
          ].map(escape).join(';'));
        });
      }
    });
    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pacotes-${clinic.name.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  const exportPDF = () => {
    if (!clinic) return;
    const data = buildExportData();
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 18;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Pacotes e Pacientes', pageW / 2, y, { align: 'center' });
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(clinic.name, pageW / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, pageW / 2, y, { align: 'center' });
    doc.setTextColor(0);
    y += 8;

    const ensureSpace = (need: number) => {
      if (y + need > pageH - 15) { doc.addPage(); y = 18; }
    };

    data.forEach(({ pkg, patients: pts }) => {
      ensureSpace(20);
      doc.setFillColor(243, 232, 255);
      doc.rect(14, y - 4, pageW - 28, 8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 30, 110);
      doc.text(pkg.name, 16, y + 1.5);
      const tipo = pkg.packageType === 'por_sessao' ? 'Por Sessão' : pkg.packageType === 'personalizado' ? 'Personalizado' : 'Mensal';
      const meta = `${tipo} · R$ ${pkg.price.toFixed(2)}${pkg.packageType === 'personalizado' && pkg.sessionLimit ? ` · ${pkg.sessionLimit} sessões` : ''} · ${pts.length} paciente${pts.length === 1 ? '' : 's'}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(meta, pageW - 16, y + 1.5, { align: 'right' });
      doc.setTextColor(0);
      y += 9;

      if (pts.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(140);
        doc.text('Nenhum paciente vinculado', 18, y + 4);
        doc.setTextColor(0);
        y += 9;
        return;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(90);
      doc.text('Paciente', 18, y + 4);
      doc.text('Telefone', 110, y + 4);
      doc.text('Início', 170, y + 4);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'normal');
      y += 6;
      doc.setDrawColor(220);
      doc.line(14, y - 1, pageW - 14, y - 1);

      pts.forEach(p => {
        ensureSpace(7);
        doc.setFontSize(9);
        const name = p.name.length > 50 ? p.name.slice(0, 47) + '…' : p.name;
        doc.text(name, 18, y + 4);
        doc.text((p as any).whatsapp || (p as any).phone || '-', 110, y + 4);
        doc.text((p as any).contractStartDate ? new Date((p as any).contractStartDate).toLocaleDateString('pt-BR') : '-', 170, y + 4);
        y += 6;
      });
      y += 4;
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${totalPages}`, pageW / 2, pageH - 8, { align: 'center' });
    }

    doc.save(`pacotes-${clinic.name.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF exportado');
  };

  if (!clinic) return null;

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Pacotes
        </h2>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={exportCSV} disabled={clinicPackages.length === 0} title="Exportar lista em CSV">
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={exportPDF} disabled={clinicPackages.length === 0} title="Exportar lista em PDF">
            <FileText className="w-4 h-4" /> PDF
          </Button>
          <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" /> Novo Pacote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Pacote</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Nome do Pacote *</Label>
                  <Input value={newPackage.name} onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })} placeholder="Ex: Pacote Social, Pacote Premium" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={newPackage.description} onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })} placeholder="Detalhes do pacote..." rows={2} />
                </div>
                <div>
                  <Label>Tipo de Pacote</Label>
                  <Select value={newPackage.packageType} onValueChange={(v) => setNewPackage({ ...newPackage, packageType: v as PackageType, sessionLimit: '' })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="por_sessao">Por Sessão</SelectItem>
                      <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newPackage.packageType === 'personalizado' && (
                  <div className="animate-in fade-in duration-200">
                    <Label>Quantidade de Sessões</Label>
                    <Input type="number" min={1} value={newPackage.sessionLimit} onChange={(e) => setNewPackage({ ...newPackage, sessionLimit: e.target.value })} placeholder="Ex: 8" className="mt-1" />
                  </div>
                )}
                <div>
                  <Label>Valor Total (R$) *</Label>
                  <Input type="number" step="0.01" value={newPackage.price} onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })} placeholder="0.00" />
                  {newPackage.packageType === 'personalizado' && newPackage.price && newPackage.sessionLimit && Number(newPackage.sessionLimit) > 0 && (
                    <p className="mt-1.5 text-sm text-muted-foreground animate-in fade-in duration-200">
                      Valor equivalente por sessão:{' '}
                      <span className="font-semibold">
                        {(parseFloat(newPackage.price) / parseInt(newPackage.sessionLimit)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </p>
                  )}
                </div>
                <Button
                  className="w-full"
                  disabled={!newPackage.name.trim() || !newPackage.price}
                  onClick={() => {
                    addPackage({
                      userId: '',
                      clinicId: clinic.id,
                      name: newPackage.name,
                      description: newPackage.description || undefined,
                      price: parseFloat(newPackage.price),
                      isActive: true,
                      packageType: newPackage.packageType,
                      sessionLimit: newPackage.packageType === 'personalizado' && newPackage.sessionLimit ? parseInt(newPackage.sessionLimit) : null,
                    });
                    setNewPackage({ name: '', description: '', price: '', packageType: 'mensal', sessionLimit: '' });
                    setPackageDialogOpen(false);
                  }}
                >
                  Criar Pacote
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {clinicPackages.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-muted-foreground mb-2">Nenhum pacote cadastrado</p>
          <p className="text-sm text-muted-foreground">Crie pacotes com valores diferentes para organizar seus atendimentos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clinicPackages.map(pkg => (
            <div key={pkg.id} className="bg-secondary/50 rounded-xl p-4 border border-border">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-foreground">{pkg.name}</h3>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditingPackage({
                      id: pkg.id,
                      name: pkg.name,
                      description: pkg.description || '',
                      price: pkg.price.toString(),
                      packageType: (pkg.packageType || 'mensal') as PackageType,
                      sessionLimit: pkg.sessionLimit?.toString() || '',
                    })}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deletePackage(pkg.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {pkg.description && <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-lg font-bold text-success">R$ {pkg.price.toFixed(2)}</p>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  pkg.packageType === 'por_sessao' ? 'bg-primary/10 text-primary' :
                  pkg.packageType === 'personalizado' ? 'bg-warning/10 text-warning' :
                  'bg-muted text-muted-foreground'
                )}>
                  {pkg.packageType === 'por_sessao' ? 'Por Sessão' : pkg.packageType === 'personalizado' ? 'Personalizado' : 'Mensal'}
                </span>
              </div>
              {pkg.packageType === 'personalizado' && pkg.sessionLimit && (
                <p className="text-xs text-muted-foreground mt-1">
                  {pkg.sessionLimit} sessões · {(pkg.price / pkg.sessionLimit).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/sessão
                </p>
              )}
              {(() => {
                const count = patients.filter(p => p.packageId === pkg.id && !p.isArchived).length;
                return (
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      <span><strong className="text-foreground">{count}</strong> paciente{count === 1 ? '' : 's'}</span>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setViewingPackagePatients(pkg)}>
                      <Users className="w-3 h-3" /> Ver pacientes
                    </Button>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      <PackagePatientsModal
        open={!!viewingPackagePatients}
        onOpenChange={(v) => !v && setViewingPackagePatients(null)}
        pkg={viewingPackagePatients}
      />

      {editingPackage && (
        <Dialog open={!!editingPackage} onOpenChange={(open) => !open && setEditingPackage(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar Pacote</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Nome do Pacote *</Label>
                <Input value={editingPackage.name} onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })} placeholder="Ex: Pacote Social" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={editingPackage.description} onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })} placeholder="Detalhes do pacote..." rows={2} />
              </div>
              <div>
                <Label>Tipo de Pacote</Label>
                <Select value={editingPackage.packageType} onValueChange={(v) => setEditingPackage({ ...editingPackage, packageType: v as PackageType, sessionLimit: '' })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="por_sessao">Por Sessão</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingPackage.packageType === 'personalizado' && (
                <div className="animate-in fade-in duration-200">
                  <Label>Quantidade de Sessões</Label>
                  <Input type="number" min={1} value={editingPackage.sessionLimit} onChange={(e) => setEditingPackage({ ...editingPackage, sessionLimit: e.target.value })} placeholder="Ex: 8" className="mt-1" />
                </div>
              )}
              <div>
                <Label>Valor Total (R$) *</Label>
                <Input type="number" step="0.01" value={editingPackage.price} onChange={(e) => setEditingPackage({ ...editingPackage, price: e.target.value })} placeholder="0.00" />
                {editingPackage.packageType === 'personalizado' && editingPackage.price && editingPackage.sessionLimit && Number(editingPackage.sessionLimit) > 0 && (
                  <p className="mt-1.5 text-sm text-muted-foreground animate-in fade-in duration-200">
                    Valor equivalente por sessão:{' '}
                    <span className="font-semibold">
                      {(parseFloat(editingPackage.price) / parseInt(editingPackage.sessionLimit)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                disabled={!editingPackage.name.trim() || !editingPackage.price}
                onClick={() => {
                  updatePackage(editingPackage.id, {
                    name: editingPackage.name,
                    description: editingPackage.description || undefined,
                    price: parseFloat(editingPackage.price),
                    packageType: editingPackage.packageType,
                    sessionLimit: editingPackage.packageType === 'personalizado' && editingPackage.sessionLimit ? parseInt(editingPackage.sessionLimit) : null,
                  });
                  setEditingPackage(null);
                  toast.success('Pacote atualizado!');
                }}
              >
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}