import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Download, FileText, ClipboardList, DollarSign, Phone, Cake, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateMultipleEvolutionsPdf } from '@/utils/generateEvolutionPdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function calculateAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const today = new Date();
  const birth = new Date(birthdate);
  if (isNaN(birth.getTime())) return null;
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

export default function Patients() {
  const navigate = useNavigate();
  const { patients, clinics, evolutions, setCurrentPatient } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'evolutions' | 'attendance' | 'financial'>('evolutions');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return patients;
    const term = searchTerm.toLowerCase();
    return patients.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.clinicalArea?.toLowerCase().includes(term) ||
      p.diagnosis?.toLowerCase().includes(term)
    );
  }, [patients, searchTerm]);

  const handleOpenPatient = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (patient) {
      setCurrentPatient(patient);
      navigate(`/patients/${patientId}`);
    }
  };

  const getClinicName = (clinicId: string) => {
    return clinics.find(c => c.id === clinicId)?.name || 'Clínica não encontrada';
  };

  const openExportDialog = (patientId: string, type: 'evolutions' | 'attendance' | 'financial') => {
    setSelectedPatientId(patientId);
    setExportType(type);
    setStartDate(undefined);
    setEndDate(undefined);
    setExportDialogOpen(true);
  };

  const handleExport = () => {
    if (!selectedPatientId || !startDate || !endDate) return;
    
    const patient = patients.find(p => p.id === selectedPatientId);
    const clinic = clinics.find(c => c.id === patient?.clinicId);
    
    if (!patient) return;

    const patientEvolutions = evolutions
      .filter(e => e.patientId === selectedPatientId)
      .filter(e => {
        const evoDate = new Date(e.date);
        return evoDate >= startDate && evoDate <= endDate;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (exportType === 'evolutions') {
      if (patientEvolutions.length === 0) {
        toast.error('Nenhuma evolução encontrada no período selecionado.');
        return;
      }
      generateMultipleEvolutionsPdf({
        evolutions: patientEvolutions,
        patient,
        clinic,
        startDate,
        endDate,
      });
      toast.success('PDF de evoluções gerado com sucesso!');
    } else if (exportType === 'attendance') {
      // Gerar lista de frequência
      const attendanceData = patientEvolutions.map(e => ({
        date: format(new Date(e.date), 'dd/MM/yyyy', { locale: ptBR }),
        status: e.attendanceStatus === 'presente' ? 'Presente' : 'Falta'
      }));
      
      // Criar CSV
      const csvContent = [
        'Data,Status',
        ...attendanceData.map(row => `${row.date},${row.status}`)
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frequencia_${patient.name.replace(/\s+/g, '_')}_${format(startDate, 'dd-MM-yyyy')}_${format(endDate, 'dd-MM-yyyy')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Lista de frequência exportada com sucesso!');
    } else if (exportType === 'financial') {
      // Gerar relatório financeiro
      const presences = patientEvolutions.filter(e => e.attendanceStatus === 'presente').length;
      const absences = patientEvolutions.filter(e => e.attendanceStatus === 'falta').length;
      const valuePerSession = patient.paymentValue || clinic?.paymentAmount || 0;
      const totalValue = presences * valuePerSession;
      
      const financialData = [
        'Relatório Financeiro',
        `Paciente: ${patient.name}`,
        `Clínica: ${clinic?.name || 'N/A'}`,
        `Período: ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`,
        '',
        `Sessões Realizadas: ${presences}`,
        `Faltas: ${absences}`,
        `Valor por Sessão: R$ ${valuePerSession.toFixed(2)}`,
        `Total: R$ ${totalValue.toFixed(2)}`,
      ].join('\n');
      
      const blob = new Blob([financialData], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financeiro_${patient.name.replace(/\s+/g, '_')}_${format(startDate, 'dd-MM-yyyy')}_${format(endDate, 'dd-MM-yyyy')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Relatório financeiro exportado com sucesso!');
    }

    setExportDialogOpen(false);
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground mb-1 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Pacientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Busque e gerencie todos os seus pacientes
          </p>
        </div>
        <Button onClick={() => navigate('/clinics')} className="gap-2">
          <Users className="w-4 h-4" />
          Novo Paciente
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome, área clínica ou diagnóstico..."
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{patients.length}</p>
              <p className="text-xs text-muted-foreground">Total de Pacientes</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary">
              <Search className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{filteredPatients.length}</p>
              <p className="text-xs text-muted-foreground">Encontrados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Patients List */}
      {filteredPatients.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchTerm ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm ? 'Tente buscar por outro termo' : 'Cadastre pacientes através das clínicas'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPatients.map((patient) => {
            const patientEvolutions = evolutions.filter(e => e.patientId === patient.id);
            
            return (
              <div
                key={patient.id}
                className="bg-card rounded-xl border border-border p-4"
              >
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleOpenPatient(patient.id)}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-medium text-foreground">{patient.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {getClinicName(patient.clinicId)}
                      </p>
                    </div>
                    <div className="text-right">
                      {patient.birthdate && calculateAge(patient.birthdate) !== null && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                          <Cake className="w-3.5 h-3.5" />
                          {calculateAge(patient.birthdate)} anos
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
                    {patient.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {patient.phone}
                      </span>
                    )}
                    {patient.clinicalArea && (
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {patient.clinicalArea}
                      </span>
                    )}
                    <span className="bg-secondary px-2 py-0.5 rounded-full">
                      {patientEvolutions.length} evolução(ões)
                    </span>
                  </div>
                </div>
                
                {/* Export Buttons */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      openExportDialog(patient.id, 'evolutions');
                    }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Evoluções
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      openExportDialog(patient.id, 'attendance');
                    }}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Frequência
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      openExportDialog(patient.id, 'financial');
                    }}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Financeiro
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Exportar {exportType === 'evolutions' ? 'Evoluções' : exportType === 'attendance' ? 'Frequência' : 'Financeiro'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <Button 
              className="w-full gap-2" 
              onClick={handleExport}
              disabled={!startDate || !endDate}
            >
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
