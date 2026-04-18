import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Download, FileText, ClipboardList, DollarSign, Phone, Cake, Building2, EyeOff, Lock, Link2, Send, AlertTriangle, CheckCircle2, FileSpreadsheet, Clock } from 'lucide-react';
import { PendingEnrollmentsCard } from '@/components/dashboard/PendingEnrollmentsCard';
import { BatchPatientImport } from '@/components/patients/BatchPatientImport';
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
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgPermissions, hasPermission } from '@/hooks/useOrgPermissions';
import { useMyAssignedPatientIds } from '@/hooks/usePatientAssignments';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WaitlistManager } from '@/components/patients/WaitlistManager';

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
  const { patients, clinics, evolutions, setCurrentPatient, getClinicPackages } = useApp();
  const { user } = useAuth();
  const { permissions: orgPermissions, isOwner: isOrgOwner, isOrgMember } = useOrgPermissions();
  const { assignedPatientIds, loading: assignmentsLoading } = useMyAssignedPatientIds();

  const [searchTerm, setSearchTerm] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'evolutions' | 'attendance' | 'financial'>('evolutions');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [stamps, setStamps] = useState<{ id: string; name: string; clinical_area: string; stamp_image: string | null; signature_image: string | null; is_default: boolean }[]>([]);
  const [profile, setProfile] = useState<{ name: string | null; professional_id: string | null } | null>(null);

  // Quick registration via link
  const [quickRegOpen, setQuickRegOpen] = useState(false);
  const [quickRegWhatsapp, setQuickRegWhatsapp] = useState('');
  const [quickRegClinicId, setQuickRegClinicId] = useState('');
  const [quickRegLink, setQuickRegLink] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importClinicId, setImportClinicId] = useState('');

  // Permission-based flags
  const ownOnly = isOrgMember && hasPermission(orgPermissions, 'patients.own_only') && !isOrgOwner;
  const canSeeClinical = !isOrgMember || isOrgOwner || hasPermission(orgPermissions, 'evolutions.view');

  useEffect(() => {
    if (!user) return;
    supabase.from('stamps').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) setStamps(data);
    });
    supabase.from('profiles').select('name, professional_id').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [user]);

  // Base patient list filtered by own_only permission
  const visiblePatients = useMemo(() => {
    if (ownOnly && !assignmentsLoading) {
      return patients.filter(p => assignedPatientIds.has(p.id));
    }
    return patients;
  }, [patients, ownOnly, assignedPatientIds, assignmentsLoading]);

  const filteredPatients = useMemo(() => {
    if (!searchTerm.trim()) return visiblePatients;
    const term = searchTerm.toLowerCase();
    return visiblePatients.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (canSeeClinical && p.clinicalArea?.toLowerCase().includes(term)) ||
      (canSeeClinical && p.diagnosis?.toLowerCase().includes(term))
    );
  }, [visiblePatients, searchTerm, canSeeClinical]);

  // Active (non-archived) clinics for quick registration
  const activeClinics = useMemo(() => clinics.filter(c => !c.isArchived), [clinics]);

  // Quick registration handler
  const handleQuickReg = () => {
    if (!quickRegClinicId) return;
    const appUrl = 'https://evolucaodiaria.app.br';
    const link = `${appUrl}/matricula/${quickRegClinicId}`;
    setQuickRegLink(link);
    toast.success('Link gerado! Compartilhe com o responsável.');
  };

  const handleSendViaWhatsApp = () => {
    if (!quickRegWhatsapp || !quickRegLink) return;
    const num = quickRegWhatsapp.replace(/\D/g, '');
    const phone = num.startsWith('55') ? num : `55${num}`;
    const cleanLink = quickRegLink.trim();
    const message = [
      'Olá!',
      'Por favor, preencha a ficha de matrícula pelo link abaixo:',
      cleanLink,
    ].join('\n\n');

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

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

  const handleExport = async () => {
    if (!selectedPatientId || !startDate || !endDate) return;
    
    const patient = patients.find(p => p.id === selectedPatientId);
    const clinic = clinics.find(c => c.id === patient?.clinicId);
    
    if (!patient) return;

    const patientEvolutions = evolutions
      .filter(e => e.patientId === selectedPatientId)
      .filter(e => {
        const evoDate = new Date(e.date + 'T00:00:00');
        const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        return evoDate >= start && evoDate <= end;
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
        stamps,
      });
      toast.success('PDF de evoluções gerado com sucesso!');
    } else if (exportType === 'attendance') {
      if (patientEvolutions.length === 0) {
        toast.error('Nenhuma evolução encontrada no período selecionado.');
        return;
      }
      const attendanceData = patientEvolutions.map(e => {
        const [yr, mo, dy] = e.date.split('-').map(Number);
        return {
          date: format(new Date(yr, mo - 1, dy), 'dd/MM/yyyy', { locale: ptBR }),
          status: e.attendanceStatus === 'presente' ? 'Presente' 
            : e.attendanceStatus === 'reposicao' ? 'Reposição'
            : e.attendanceStatus === 'falta_remunerada' ? 'Falta Remunerada' 
            : 'Falta',
          statusColor: e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao' 
            ? [34, 197, 94] : e.attendanceStatus === 'falta_remunerada' ? [234, 179, 8] : [239, 68, 68],
        };
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // --- HEADER with letterhead ---
      if (clinic?.letterhead) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = clinic.letterhead!;
          });
          const imgWidth = contentWidth;
          const imgHeight = Math.min((img.height / img.width) * imgWidth, 40);
          pdf.addImage(clinic.letterhead!, 'PNG', margin, y, imgWidth, imgHeight);
          y += imgHeight + 8;
        } catch { /* skip letterhead */ }
      }

      // Clinic name
      if (clinic) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(50, 50, 50);
        pdf.text(clinic.name, pageWidth / 2, y, { align: 'center' });
        y += 6;
        if (clinic.address) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(clinic.address, pageWidth / 2, y, { align: 'center' });
          y += 5;
        }
        const clinicDetails: string[] = [];
        if (clinic.phone) clinicDetails.push(`Tel: ${clinic.phone}`);
        if (clinic.email) clinicDetails.push(`Email: ${clinic.email}`);
        if (clinic.cnpj) clinicDetails.push(`CNPJ: ${clinic.cnpj}`);
        if (clinicDetails.length > 0) {
          pdf.setFontSize(8);
          pdf.text(clinicDetails.join(' | '), pageWidth / 2, y, { align: 'center' });
          y += 5;
        }
      }

      // Divider
      y += 3;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Title
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 30, 30);
      pdf.text('LISTA DE FREQUÊNCIA', pageWidth / 2, y, { align: 'center' });
      y += 8;

      // Period
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(
        `Período: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`,
        pageWidth / 2, y, { align: 'center' }
      );
      y += 10;

      // Patient info box
      pdf.setFillColor(245, 245, 245);
      pdf.roundedRect(margin, y, contentWidth, 22, 3, 3, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      pdf.text('Paciente:', margin + 5, y + 7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(patient.name, margin + 28, y + 7);

      if (profile?.name) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Terapeuta:', margin + 5, y + 14);
        pdf.setFont('helvetica', 'normal');
        const terapeutaText = profile.professional_id 
          ? `${profile.name} (${profile.professional_id})` 
          : profile.name;
        pdf.text(terapeutaText, margin + 30, y + 14);
      }

      if (patient.clinicalArea) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Área:', margin + contentWidth / 2, y + 7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(patient.clinicalArea, margin + contentWidth / 2 + 15, y + 7);
      }

      y += 30;

      // Table header
      const colDate = margin + 5;
      const colStatus = margin + contentWidth / 2;
      
      pdf.setFillColor(235, 235, 240);
      pdf.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      pdf.text('Data', colDate, y + 2);
      pdf.text('Status', colStatus, y + 2);
      y += 10;

      // Table rows
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      for (let i = 0; i < attendanceData.length; i++) {
        const row = attendanceData[i];
        if (y > pageHeight - 40) { pdf.addPage(); y = margin; }
        
        // Alternating row background
        if (i % 2 === 0) {
          pdf.setFillColor(250, 250, 252);
          pdf.rect(margin, y - 4, contentWidth, 7, 'F');
        }
        
        pdf.setTextColor(50, 50, 50);
        pdf.text(row.date, colDate, y);
        pdf.setTextColor(row.statusColor[0], row.statusColor[1], row.statusColor[2]);
        pdf.setFont('helvetica', 'bold');
        pdf.text(row.status, colStatus, y);
        pdf.setFont('helvetica', 'normal');
        y += 7;
      }

      // Summary
      y += 5;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;
      
      const presences = attendanceData.filter(r => r.status === 'Presente' || r.status === 'Reposição').length;
      const absences = attendanceData.filter(r => r.status === 'Falta').length;
      const faltasRem = attendanceData.filter(r => r.status === 'Falta Remunerada').length;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      let summaryText = `Total: ${attendanceData.length} sessões  |  Presenças: ${presences}  |  Faltas: ${absences}`;
      if (faltasRem > 0) summaryText += `  |  Faltas Remuneradas: ${faltasRem}`;
      pdf.text(summaryText, margin, y);

      // Stamp at bottom if available
      if (clinic?.stamp) {
        try {
          const stampImg = new Image();
          stampImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            stampImg.onload = () => resolve();
            stampImg.onerror = () => reject();
            stampImg.src = clinic.stamp!;
          });
          const maxW = 50;
          const maxH = 30;
          let sw = maxW;
          let sh = (stampImg.height / stampImg.width) * sw;
          if (sh > maxH) { sh = maxH; sw = (stampImg.width / stampImg.height) * sh; }
          
          const stampY = pageHeight - 50 - sh;
          if (y + 20 < stampY) {
            pdf.addImage(clinic.stamp, 'PNG', pageWidth - margin - sw, stampY, sw, sh);
            pdf.setDrawColor(100, 100, 100);
            pdf.line(pageWidth - margin - sw, stampY + sh + 3, pageWidth - margin, stampY + sh + 3);
            pdf.setFontSize(7);
            pdf.setTextColor(128, 128, 128);
            pdf.text('Carimbo', pageWidth - margin - sw / 2, stampY + sh + 7, { align: 'center' });
          }
        } catch { /* skip stamp */ }
      }

      // Footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Página ${i} de ${totalPages} | Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
          pageWidth / 2, pageHeight - 10, { align: 'center' }
        );
        pdf.setFontSize(6);
        pdf.setTextColor(190, 190, 190);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Plataforma Clínica - Evolução Diária', margin, pageHeight - 5);
        pdf.setFont('helvetica', 'normal');
      }

      pdf.save(`frequencia_${patient.name.replace(/\s+/g, '_')}_${format(startDate, 'dd-MM-yyyy')}_${format(endDate, 'dd-MM-yyyy')}.pdf`);
      toast.success('PDF de frequência exportado com sucesso!');
    } else if (exportType === 'financial') {
      if (patientEvolutions.length === 0) {
        toast.error('Nenhuma evolução encontrada no período selecionado.');
        return;
      }
      const presences = patientEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;
      const faltasRem = patientEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
      const absences = patientEvolutions.filter(e => e.attendanceStatus === 'falta').length;
      // Effective value calculation: respects package type
      // - mensal: fixed price × number of months in period
      // - personalizado: price / sessionLimit per session
      // - por_sessao / no package: price per session
      const _pkgs = getClinicPackages(patient.clinicId);
      const _pkg = patient.packageId ? _pkgs.find(p => p.id === patient.packageId) : null;
      const _pkgType = _pkg?.packageType;
      const _isPersonalizado = _pkgType === 'personalizado' && (_pkg?.sessionLimit ?? 0) > 0;
      const _isMensal = _pkgType === 'mensal';
      const baseValue = patient.paymentValue || clinic?.paymentAmount || 0;
      const valuePerSession = _isPersonalizado
        ? baseValue / (_pkg!.sessionLimit as number)
        : baseValue;
      let totalValue: number;
      if (_isMensal) {
        // Count distinct months in the selected period (inclusive)
        const monthsCount = (endDate.getFullYear() - startDate.getFullYear()) * 12
          + (endDate.getMonth() - startDate.getMonth()) + 1;
        totalValue = baseValue * Math.max(1, monthsCount);
      } else {
        totalValue = (presences + faltasRem) * valuePerSession;
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      // --- HEADER with letterhead ---
      if (clinic?.letterhead) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = clinic.letterhead!;
          });
          const imgWidth = contentWidth;
          const imgHeight = Math.min((img.height / img.width) * imgWidth, 40);
          pdf.addImage(clinic.letterhead!, 'PNG', margin, y, imgWidth, imgHeight);
          y += imgHeight + 8;
        } catch { /* skip letterhead */ }
      }

      // Clinic name & details
      if (clinic) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(50, 50, 50);
        pdf.text(clinic.name, pageWidth / 2, y, { align: 'center' });
        y += 6;
        if (clinic.address) {
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(clinic.address, pageWidth / 2, y, { align: 'center' });
          y += 5;
        }
        const clinicDetails: string[] = [];
        if (clinic.phone) clinicDetails.push(`Tel: ${clinic.phone}`);
        if (clinic.email) clinicDetails.push(`Email: ${clinic.email}`);
        if (clinic.cnpj) clinicDetails.push(`CNPJ: ${clinic.cnpj}`);
        if (clinicDetails.length > 0) {
          pdf.setFontSize(8);
          pdf.text(clinicDetails.join(' | '), pageWidth / 2, y, { align: 'center' });
          y += 5;
        }
      }

      // Divider
      y += 3;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Title
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 30, 30);
      pdf.text('RELATÓRIO FINANCEIRO', pageWidth / 2, y, { align: 'center' });
      y += 8;

      // Period
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(
        `Período: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`,
        pageWidth / 2, y, { align: 'center' }
      );
      y += 10;

      // Patient & Therapist info box
      const clinicPackages = getClinicPackages(patient.clinicId);
      const patientPackage = patient.packageId ? clinicPackages.find(p => p.id === patient.packageId) : null;
      const infoRows = 2 + (patientPackage ? 1 : 0);
      const infoBoxH = infoRows * 8 + 6;
      pdf.setFillColor(245, 245, 245);
      pdf.roundedRect(margin, y, contentWidth, infoBoxH, 3, 3, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      pdf.text('Paciente:', margin + 5, y + 7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(patient.name, margin + 28, y + 7);

      if (profile?.name) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Terapeuta:', margin + 5, y + 14);
        pdf.setFont('helvetica', 'normal');
        const terapeutaText = profile.professional_id
          ? `${profile.name} (${profile.professional_id})`
          : profile.name;
        pdf.text(terapeutaText, margin + 30, y + 14);
      }

      if (patient.clinicalArea) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Área:', margin + contentWidth / 2, y + 7);
        pdf.setFont('helvetica', 'normal');
        pdf.text(patient.clinicalArea, margin + contentWidth / 2 + 15, y + 7);
      }

      if (patientPackage) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Pacote:', margin + 5, y + 21);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${patientPackage.name} — R$ ${patientPackage.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 22, y + 21);
      }

      y += infoBoxH + 9;

      // Financial details table
      const colLabel = margin + 5;
      const colValue = pageWidth - margin - 5;

      pdf.setFillColor(235, 235, 240);
      pdf.roundedRect(margin, y - 4, contentWidth, 10, 2, 2, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      pdf.text('Descrição', colLabel, y + 2);
      pdf.text('Valor', colValue, y + 2, { align: 'right' });
      y += 12;

      const financialRows = [
        ...(patientPackage ? [{ label: 'Pacote / Modalidade', value: patientPackage.name }] : []),
        { label: 'Sessões Realizadas (Presenças + Reposições)', value: String(presences) },
        { label: 'Faltas Remuneradas', value: String(faltasRem) },
        { label: 'Faltas (sem cobrança)', value: String(absences) },
        { label: 'Total de Sessões no Período', value: String(patientEvolutions.length) },
        { label: 'Valor por Sessão', value: `R$ ${valuePerSession.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      ];

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      for (let i = 0; i < financialRows.length; i++) {
        const row = financialRows[i];
        if (i % 2 === 0) {
          pdf.setFillColor(250, 250, 252);
          pdf.rect(margin, y - 4, contentWidth, 7, 'F');
        }
        pdf.setTextColor(50, 50, 50);
        pdf.text(row.label, colLabel, y);
        pdf.text(row.value, colValue, y, { align: 'right' });
        y += 7;
      }

      // Total highlight
      y += 5;
      pdf.setFillColor(34, 197, 94);
      pdf.roundedRect(margin, y - 2, contentWidth, 14, 3, 3, 'F');
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('TOTAL A RECEBER', margin + 8, y + 7);
      pdf.text(`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, colValue - 5, y + 7, { align: 'right' });

      // Perdas info (faltas não remuneradas)
      if (absences > 0) {
        y += 20;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(180, 80, 80);
        const perda = absences * valuePerSession;
        pdf.text(`Perda por faltas não remuneradas: R$ ${perda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 5, y);
      }

      // Stamp at bottom if available
      if (clinic?.stamp) {
        try {
          const stampImg = new Image();
          stampImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            stampImg.onload = () => resolve();
            stampImg.onerror = () => reject();
            stampImg.src = clinic.stamp!;
          });
          const maxW = 50;
          const maxH = 30;
          let sw = maxW;
          let sh = (stampImg.height / stampImg.width) * sw;
          if (sh > maxH) { sh = maxH; sw = (stampImg.width / stampImg.height) * sh; }

          const stampY = pageHeight - 50 - sh;
          if (y + 20 < stampY) {
            pdf.addImage(clinic.stamp, 'PNG', pageWidth - margin - sw, stampY, sw, sh);
            pdf.setDrawColor(100, 100, 100);
            pdf.line(pageWidth - margin - sw, stampY + sh + 3, pageWidth - margin, stampY + sh + 3);
            pdf.setFontSize(7);
            pdf.setTextColor(128, 128, 128);
            pdf.text('Carimbo', pageWidth - margin - sw / 2, stampY + sh + 7, { align: 'center' });
          }
        } catch { /* skip stamp */ }
      }

      // Footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Página ${i} de ${totalPages} | Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
          pageWidth / 2, pageHeight - 10, { align: 'center' }
        );
        pdf.setFontSize(6);
        pdf.setTextColor(190, 190, 190);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Plataforma Clínica - Evolução Diária', margin, pageHeight - 5);
        pdf.setFont('helvetica', 'normal');
      }

      pdf.save(`financeiro_${patient.name.replace(/\s+/g, '_')}_${format(startDate, 'dd-MM-yyyy')}_${format(endDate, 'dd-MM-yyyy')}.pdf`);
      toast.success('Relatório financeiro exportado com sucesso!');
    }

    setExportDialogOpen(false);
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground mb-1 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Pacientes
          </h1>
          <p className="text-sm text-muted-foreground">
            {ownOnly
              ? 'Exibindo apenas seus pacientes vinculados'
              : 'Busque e gerencie todos os seus pacientes'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs"
            onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Importar CSV</span><span className="sm:hidden">CSV</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
            onClick={() => { setQuickRegOpen(true); setQuickRegLink(''); setQuickRegWhatsapp(''); setQuickRegClinicId(activeClinics[0]?.id || ''); }}>
            <Link2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cadastro via Link</span><span className="sm:hidden">Link</span>
          </Button>
          <Button onClick={() => navigate('/clinics')} className="gap-2" size="sm">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Paciente</span><span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Tabs: Pacientes | Lista de Espera */}
      <Tabs defaultValue="patients" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="patients" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" /> Pacientes</TabsTrigger>
          <TabsTrigger value="waitlist" className="gap-1.5 text-xs"><Clock className="w-3.5 h-3.5" /> Lista de Espera</TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="space-y-4 mt-0">
      {/* Pending Enrollments - same card as dashboard */}
      <PendingEnrollmentsCard />
      {/* Pending review banner */}
      {visiblePatients.some((p: any) => p.status === 'pendente_revisao') && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 text-sm text-warning mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{visiblePatients.filter((p: any) => p.status === 'pendente_revisao').length} paciente(s)</strong> com ficha de pré-cadastro pendente de revisão.
            Clique no paciente para revisar e ativar.
          </span>
        </div>
      )}

      {/* Quick Registration Dialog */}
      <Dialog open={quickRegOpen} onOpenChange={(v) => { setQuickRegOpen(v); if (!v) { setQuickRegLink(''); setQuickRegWhatsapp(''); setQuickRegClinicId(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" /> Cadastro via Link
            </DialogTitle>
          </DialogHeader>
          {!quickRegLink ? (
            <div className="space-y-4 pt-1">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Gere um link de matrícula para o responsável preencher a <strong>ficha completa de cadastro</strong> do paciente.
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Clínica <span className="text-destructive">*</span></Label>
                <Select value={quickRegClinicId} onValueChange={setQuickRegClinicId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecionar clínica..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClinics.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp do Responsável <span className="text-muted-foreground">(para envio via WhatsApp)</span></Label>
                <Input placeholder="(00) 00000-0000" value={quickRegWhatsapp} onChange={e => setQuickRegWhatsapp(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setQuickRegOpen(false)}>Cancelar</Button>
                <Button className="flex-1 gap-1.5" onClick={handleQuickReg}
                  disabled={!quickRegClinicId}>
                  <Link2 className="w-3.5 h-3.5" />
                  Gerar Link
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-2 text-success text-sm">
                <CheckCircle2 className="w-4 h-4" /> Link de matrícula gerado!
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link de cadastro completo</Label>
                <div className="flex gap-2">
                  <Input readOnly value={quickRegLink} className="text-xs" />
                  <Button variant="outline" size="icon" className="shrink-0"
                    onClick={() => { navigator.clipboard.writeText(quickRegLink); toast.success('Link copiado!'); }}>
                    <Link2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {quickRegWhatsapp && (
                <Button className="w-full gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-0"
                  onClick={handleSendViaWhatsApp}>
                  <Send className="w-4 h-4" /> Enviar via WhatsApp
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                O responsável preencherá a ficha completa de matrícula. Após o envio, o paciente aparecerá como <strong>Pendente</strong> para sua aprovação.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setQuickRegOpen(false)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* own_only banner */}
      {ownOnly && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary mb-4">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Você está vendo apenas os pacientes vinculados à sua conta. Contate o administrador para alterar os vínculos.</span>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={canSeeClinical ? 'Buscar por nome, área clínica ou diagnóstico...' : 'Buscar por nome...'}
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
              <p className="text-2xl font-bold text-foreground">{visiblePatients.length}</p>
              <p className="text-xs text-muted-foreground">{ownOnly ? 'Meus Pacientes' : 'Total de Pacientes'}</p>
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
                className={cn(
                  "bg-card rounded-xl border p-4",
                  (patient as any).status === 'pendente_revisao'
                    ? 'border-warning/40 bg-warning/5'
                    : (patient as any).status === 'rascunho'
                    ? 'border-muted-foreground/20 opacity-75'
                    : 'border-border'
                )}
              >
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleOpenPatient(patient.id)}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground">{patient.name}</h3>
                        {(patient as any).status === 'pendente_revisao' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/25">
                            <AlertTriangle className="w-2.5 h-2.5" /> Pendente de Revisão
                          </span>
                        )}
                        {(patient as any).status === 'rascunho' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                            Rascunho
                          </span>
                        )}
                      </div>
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
                    {patient.clinicalArea && canSeeClinical && (
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {patient.clinicalArea}
                      </span>
                    )}
                    {!canSeeClinical && (
                      <span className="flex items-center gap-1 text-muted-foreground/60 italic">
                        <EyeOff className="w-3 h-3" /> Dados clínicos restritos
                      </span>
                    )}
                    {canSeeClinical && (
                      <span className="bg-secondary px-2 py-0.5 rounded-full">
                        {patientEvolutions.length} evoluções
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Export Buttons — only shown to users with clinical access */}
                {canSeeClinical && (
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
                )}
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

      {/* CSV Batch Import */}
      {importOpen && (
        <BatchPatientImport
          open={importOpen}
          onClose={() => setImportOpen(false)}
          clinics={activeClinics.map(c => ({ id: c.id, name: c.name }))}
          defaultClinicId={activeClinics[0]?.id}
          onSuccess={() => { window.location.reload(); }}
        />
      )}
        </TabsContent>

        <TabsContent value="waitlist" className="mt-0">
          <WaitlistManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
