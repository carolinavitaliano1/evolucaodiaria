import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { toast } from 'sonner';
import { Play, Pause, Square, X, AlertTriangle, Plus, FileText, Smile, Frown, PenLine, ListTodo, CalendarPlus, MessageSquare, Upload, Clock, History, Target, Sparkles, Send, Loader2, BookOpen, Wand2, Stamp, Download, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import jsPDF from 'jspdf';
import { SessionHistory } from './SessionHistory';
import { SessionPlanForm } from './SessionPlanForm';
import { SessionPlansList } from './SessionPlansList';
import { SendActionPlanModal, type ActivityAttachment } from './SendActionPlanModal';

interface TherapeuticSessionTabProps {
  patientId: string;
  patientName: string;
  patientAvatar?: string | null;
  clinicId: string;
  paymentValue?: number;
  patientCpf?: string | null;
}

export function TherapeuticSessionTab({ patientId, patientName, patientAvatar, clinicId, paymentValue, patientCpf }: TherapeuticSessionTabProps) {
  const { user } = useAuth();

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [positiveFeelings, setPositiveFeelings] = useState<string[]>([]);
  const [negativeFeelings, setNegativeFeelings] = useState<string[]>([]);
  const [newPositive, setNewPositive] = useState('');
  const [newNegative, setNewNegative] = useState('');
  const [suicidalThoughts, setSuicidalThoughts] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [actionPlans, setActionPlans] = useState('');
  const [nextSessionNotes, setNextSessionNotes] = useState('');
  const [generalComments, setGeneralComments] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [activeTab, setActiveTab] = useState('notes');

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-save
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  // Sessions history
  const [sessions, setSessions] = useState<any[]>([]);
  const [viewingSession, setViewingSession] = useState<any | null>(null);
  const [viewLinkedEvolution, setViewLinkedEvolution] = useState<any | null>(null);
  const [viewLinkedEvolutionText, setViewLinkedEvolutionText] = useState<string | null>(null);
  const [loadingLinkedData, setLoadingLinkedData] = useState(false);

  // Plans
  const [plans, setPlans] = useState<any[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [activePlan, setActivePlan] = useState<any>(null);

  // AI Evolution
  const [aiEvolution, setAiEvolution] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [sendingToProntuario, setSendingToProntuario] = useState(false);
  const [improvingField, setImprovingField] = useState<string | null>(null);
  const [creatingField, setCreatingField] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [sendingToPortal, setSendingToPortal] = useState(false);
  const [stamps, setStamps] = useState<any[]>([]);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [declarationSession, setDeclarationSession] = useState<any | null>(null);
  const [declarationStampId, setDeclarationStampId] = useState<string | null>(null);

  // Sub-tab navigation: 'planning' | 'session' | 'history' | 'next_sessions'
  const [mainView, setMainView] = useState<'planning' | 'session' | 'history' | 'next_sessions'>('planning');

  // Saved next sessions
  const [savedNextSessions, setSavedNextSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !patientId) return;
    loadActiveSession();
    loadHistory();
    loadPlans();
    loadStamps();
    loadSavedNextSessions();
  }, [user, patientId]);

  const loadSavedNextSessions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('therapy_sessions')
      .select('id, title, created_at, next_session_notes')
      .eq('patient_id', patientId)
      .eq('user_id', user.id)
      .eq('status', 'finished')
      .not('next_session_notes', 'is', null)
      .order('created_at', { ascending: false });
    if (data) setSavedNextSessions(data.filter((s: any) => s.next_session_notes?.trim()));
  };

  const downloadNextSessionWord = async (session: any) => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: `Planejamento - ${patientName}`, bold: true, size: 32 })],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: `Sessão: ${session.title || 'Sem título'}`, size: 22, color: '666666' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Data: ${new Date(session.created_at).toLocaleDateString('pt-BR')}`, size: 20, color: '999999' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          ...session.next_session_notes.split('\n').map((line: string) =>
            new Paragraph({
              children: [new TextRun({ text: line, size: 24 })],
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 120 },
            })
          ),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `proxima_sessao_${patientName.replace(/\s+/g, '_')}_${new Date(session.created_at).toLocaleDateString('pt-BR').replace(/\//g, '-')}.docx`);
    toast.success('Documento Word gerado!');
  };

  const loadStamps = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('stamps')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });
    if (data) {
      setStamps(data);
      const defaultStamp = data.find((s: any) => s.is_default);
      if (defaultStamp) setSelectedStampId(defaultStamp.id);
    }
  };

  const loadActiveSession = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('therapy_sessions')
      .select('*')
      .eq('patient_id', patientId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      populateSessionForm(data);
      setMainView('session');
      // Load associated plan if exists
      if (data.plan_id) {
        const { data: plan } = await supabase
          .from('session_plans')
          .select('*')
          .eq('id', data.plan_id)
          .maybeSingle();
        if (plan) setActivePlan(plan);
      }
    }
  };

  const populateSessionForm = (data: any) => {
    setSessionId(data.id);
    setTitle(data.title || '');
    setMoodScore(data.mood_score);
    setPositiveFeelings(data.positive_feelings || []);
    setNegativeFeelings(data.negative_feelings || []);
    setSuicidalThoughts(data.suicidal_thoughts);
    setNotesText(data.notes_text || '');
    setActionPlans(data.action_plans || '');
    setNextSessionNotes(data.next_session_notes || '');
    setGeneralComments(data.general_comments || '');
    setElapsedSeconds(data.duration_seconds || 0);
    setAiEvolution('');
    if (data.started_at && !data.finished_at) {
      const start = new Date(data.started_at);
      setStartedAt(start);
      const diff = Math.floor((Date.now() - start.getTime()) / 1000);
      setElapsedSeconds(diff);
      setTimerRunning(true);
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('therapy_sessions')
      .select('id, title, created_at, duration_seconds, status, mood_score, notes_text, action_plans, next_session_notes, general_comments, positive_feelings, negative_feelings, suicidal_thoughts, started_at, finished_at')
      .eq('patient_id', patientId)
      .eq('user_id', user.id)
      .eq('status', 'finished')
      .order('created_at', { ascending: false });
    if (data) setSessions(data);
  };

  const loadPlans = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('session_plans')
      .select('*')
      .eq('patient_id', patientId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setPlans(data.filter((p: any) => !p.objectives?.includes('[grupo:')));
  };

  // Timer logic
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  // Auto-save every 60 seconds
  useEffect(() => {
    if (!sessionId) return;
    autoSaveRef.current = setTimeout(() => saveSession(false), 60000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [notesText, actionPlans, nextSessionNotes, generalComments, title, moodScore, positiveFeelings, negativeFeelings, suicidalThoughts, sessionId]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startSessionFromPlan = async (plan: any) => {
    if (!user) return;
    const now = new Date();
    const { data, error } = await supabase.from('therapy_sessions').insert({
      user_id: user.id,
      patient_id: patientId,
      clinic_id: clinicId,
      title: plan.title,
      notes_text: '',
      action_plans: '',
      next_session_notes: '',
      general_comments: '',
      started_at: now.toISOString(),
      status: 'active',
      plan_id: plan.id,
      price: 0,
      payment_pending: false,
    }).select('*').single();

    if (error) {
      toast.error('Erro ao iniciar sessão');
    } else if (data) {
      populateSessionForm(data);
      setActivePlan(plan);
      setStartedAt(now);
      setTimerRunning(true);
      setMainView('session');
      toast.success('Sessão iniciada a partir do plano!');
    }
  };

  const startSession = async () => {
    if (!user) return;
    const now = new Date();
    setStartedAt(now);
    setTimerRunning(true);

    if (sessionId) {
      await supabase.from('therapy_sessions').update({ started_at: now.toISOString() }).eq('id', sessionId);
    } else {
      const { data, error } = await supabase.from('therapy_sessions').insert({
        user_id: user.id,
        patient_id: patientId,
        clinic_id: clinicId,
        title,
        started_at: now.toISOString(),
        status: 'active',
        price: 0,
        payment_pending: false,
      }).select('id').single();
      if (data) setSessionId(data.id);
      if (error) toast.error('Erro ao iniciar sessão');
    }
  };

  const pauseTimer = () => setTimerRunning(false);
  const resumeTimer = () => setTimerRunning(true);

  const saveSession = useCallback(async (showToast = true) => {
    if (!user || !sessionId) return;
    setSaving(true);
    const { error } = await supabase.from('therapy_sessions').update({
      title,
      mood_score: moodScore,
      positive_feelings: positiveFeelings,
      negative_feelings: negativeFeelings,
      suicidal_thoughts: suicidalThoughts,
      notes_text: notesText,
      action_plans: actionPlans,
      next_session_notes: nextSessionNotes,
      general_comments: generalComments,
      duration_seconds: elapsedSeconds,
    }).eq('id', sessionId);
    setSaving(false);
    if (error) {
      if (showToast) toast.error('Erro ao salvar');
    } else {
      setLastSaved(new Date());
      if (showToast) toast.success('Sessão salva!');
    }
  }, [user, sessionId, title, moodScore, positiveFeelings, negativeFeelings, suicidalThoughts, notesText, actionPlans, nextSessionNotes, generalComments, elapsedSeconds]);

  const finishSession = async () => {
    if (!user || !sessionId) return;
    setTimerRunning(false);
    const { error } = await supabase.from('therapy_sessions').update({
      title,
      mood_score: moodScore,
      positive_feelings: positiveFeelings,
      negative_feelings: negativeFeelings,
      suicidal_thoughts: suicidalThoughts,
      notes_text: notesText,
      action_plans: actionPlans,
      next_session_notes: nextSessionNotes,
      general_comments: generalComments,
      duration_seconds: elapsedSeconds,
      finished_at: new Date().toISOString(),
      status: 'finished',
    }).eq('id', sessionId);

    if (error) {
      toast.error('Erro ao finalizar sessão');
    } else {
      toast.success('Sessão finalizada e salva com sucesso!');
      setSessionId(null);
      resetForm();
      await loadHistory();
      await loadSavedNextSessions();
      setMainView('history');
    }
  };

  const exitSession = async () => {
    if (sessionId) {
      await saveSession(false);
      toast.info('Sessão salva. Você pode retomá-la depois.');
    }
    setTimerRunning(false);
    setMainView('planning');
    // Don't reset - keep session active in DB for resuming
  };

  const resetForm = () => {
    setTitle('');
    setMoodScore(null);
    setPositiveFeelings([]);
    setNegativeFeelings([]);
    setSuicidalThoughts(false);
    setNotesText('');
    setActionPlans('');
    setNextSessionNotes('');
    setGeneralComments('');
    setElapsedSeconds(0);
    setStartedAt(null);
    setAttachedFiles([]);
    setAiEvolution('');
    setActivePlan(null);
  };

  const addFeeling = (type: 'positive' | 'negative') => {
    if (type === 'positive' && newPositive.trim()) {
      setPositiveFeelings(prev => [...prev, newPositive.trim()]);
      setNewPositive('');
    } else if (type === 'negative' && newNegative.trim()) {
      setNegativeFeelings(prev => [...prev, newNegative.trim()]);
      setNewNegative('');
    }
  };

  const removeFeeling = (type: 'positive' | 'negative', index: number) => {
    if (type === 'positive') setPositiveFeelings(prev => prev.filter((_, i) => i !== index));
    else setNegativeFeelings(prev => prev.filter((_, i) => i !== index));
  };

  // Improve text field with AI
  const improveFieldText = async (field: 'notes' | 'action_plans' | 'next_session', getText: () => string, setText: (v: string) => void) => {
    const text = getText();
    if (!text.trim()) {
      toast.error('Preencha o campo antes de melhorar com IA.');
      return;
    }
    setImprovingField(field);
    try {
      const { data, error } = await supabase.functions.invoke('improve-session-text', {
        body: { text, field },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.improved) {
        setText(data.improved);
        toast.success('Texto melhorado com IA!');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao melhorar texto');
    } finally {
      setImprovingField(null);
    }
  };
  // Create text with AI from session context
  const createFieldWithAI = async (field: 'create_action_plans' | 'create_next_session', setText: (v: string) => void) => {
    const context = [
      notesText ? `Anotações: ${notesText}` : '',
      moodScore ? `Humor: ${moodScore}/10` : '',
      positiveFeelings.length > 0 ? `Sentimentos positivos: ${positiveFeelings.join(', ')}` : '',
      negativeFeelings.length > 0 ? `Sentimentos negativos: ${negativeFeelings.join(', ')}` : '',
      suicidalThoughts ? 'ALERTA: Ideação suicida reportada' : '',
      actionPlans && field === 'create_next_session' ? `Planos de ação: ${actionPlans}` : '',
      activePlan?.objectives ? `Objetivos do plano: ${activePlan.objectives}` : '',
      activePlan?.activities ? `Atividades do plano: ${activePlan.activities}` : '',
    ].filter(Boolean).join('\n');

    if (!context.trim()) {
      toast.error('Preencha ao menos as anotações da sessão para criar com IA.');
      return;
    }

    setCreatingField(field);
    try {
      const { data, error } = await supabase.functions.invoke('improve-session-text', {
        body: { text: context, field },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.improved) {
        setText(data.improved);
        toast.success('Conteúdo criado com IA!');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar com IA');
    } finally {
      setCreatingField(null);
    }
  };

  const [showSendModal, setShowSendModal] = useState(false);

  // Send action plans to patient portal as activity
  const sendActionPlansToPortal = async (title: string, dueDate: string, attachments: ActivityAttachment[]) => {
    if (!user || !actionPlans.trim()) return;
    setSendingToPortal(true);
    try {
      const lines = actionPlans.split('\n').map(l => l.replace(/^[\s\-\*\d\.]+/, '').trim()).filter(Boolean);
      const items = lines.map(text => ({ text, done: false }));

      const { data: portalAccount } = await supabase
        .from('patient_portal_accounts')
        .select('id')
        .eq('patient_id', patientId)
        .eq('therapist_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const { error } = await supabase.from('portal_activities').insert({
        patient_id: patientId,
        therapist_user_id: user.id,
        portal_account_id: portalAccount?.id || null,
        title: title || 'Plano de Ação',
        items: items as any,
        due_date: dueDate || null,
        attachments: attachments as any,
        status: 'pending',
      });

      if (error) throw error;
      toast.success('Plano de ação enviado para o portal do paciente!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar para portal');
    } finally {
      setSendingToPortal(false);
    }
  };

  const generateReport = async () => {
    setGeneratingReport(true);
    try {
    // Auto-save before generating so nothing is lost
    if (sessionId) await saveSession(false);
    // Auto-correct text fields with AI before generating
    let correctedNotes = notesText;
    let correctedPlans = actionPlans;
    let correctedNext = nextSessionNotes;
    let correctedComments = generalComments;

    try {
      const textsToCorrect = [notesText, actionPlans, nextSessionNotes, generalComments].filter(t => t.trim());
      if (textsToCorrect.length > 0) {
        const allText = [
          notesText ? `[ANOTAÇÕES]\n${notesText}` : '',
          actionPlans ? `[PLANOS]\n${actionPlans}` : '',
          nextSessionNotes ? `[PRÓXIMA]\n${nextSessionNotes}` : '',
          generalComments ? `[COMENTÁRIOS]\n${generalComments}` : '',
        ].filter(Boolean).join('\n---\n');

        const { data } = await supabase.functions.invoke('improve-session-text', {
          body: { text: allText, field: 'report' },
        });
        if (data?.improved) {
          const sections = data.improved.split('---');
          for (const sec of sections) {
            const trimmed = sec.trim();
            if (trimmed.startsWith('[ANOTAÇÕES]')) correctedNotes = trimmed.replace('[ANOTAÇÕES]', '').trim();
            else if (trimmed.startsWith('[PLANOS]')) correctedPlans = trimmed.replace('[PLANOS]', '').trim();
            else if (trimmed.startsWith('[PRÓXIMA]')) correctedNext = trimmed.replace('[PRÓXIMA]', '').trim();
            else if (trimmed.startsWith('[COMENTÁRIOS]')) correctedComments = trimmed.replace('[COMENTÁRIOS]', '').trim();
          }
        }
      }
    } catch {
      // If AI correction fails, use original text
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Header bar
    doc.setFillColor(99, 102, 241); // primary purple
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Sessão Terapêutica', margin, 26);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin, 35);
    
    y = 52;
    doc.setTextColor(50, 50, 50);

    // Patient info box
    doc.setFillColor(245, 245, 250);
    doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Paciente', margin + 5, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(patientName, margin + 5, y + 16);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Sessão: ${title || 'Sem título'}  |  Duração: ${formatTime(elapsedSeconds)}`, margin + 5, y + 23);
    y += 35;

    doc.setTextColor(50, 50, 50);

    // Mood section
    if (moodScore !== null) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Avaliação de Humor', margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`${moodEmojis[moodScore - 1]}  ${moodScore}/10`, margin, y);
      y += 8;
    }

    if (positiveFeelings.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Sentimentos Positivos:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(positiveFeelings.join(', '), margin + 45, y);
      y += 6;
    }
    if (negativeFeelings.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Sentimentos Negativos:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(negativeFeelings.join(', '), margin + 45, y);
      y += 6;
    }

    if (suicidalThoughts) {
      y += 2;
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setTextColor(185, 28, 28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('⚠ ALERTA: Pensamentos suicidas reportados nesta sessão', margin + 5, y + 7);
      doc.setTextColor(50, 50, 50);
      y += 15;
    }

    y += 4;

    // Separator
    doc.setDrawColor(200, 200, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Helper: render text with **bold** markdown support + justified alignment
    const renderMarkdownText = (text: string, xPos: number, maxWidth: number) => {
      const originalLines = text.split('\n');
      
      for (const originalLine of originalLines) {
        // Parse segments: bold vs normal, stripping ** markers
        const segments: { text: string; bold: boolean }[] = [];
        let remaining = originalLine;
        while (remaining.length > 0) {
          const boldStart = remaining.indexOf('**');
          if (boldStart === -1) {
            if (remaining) segments.push({ text: remaining, bold: false });
            break;
          }
          if (boldStart > 0) {
            segments.push({ text: remaining.slice(0, boldStart), bold: false });
          }
          const boldEnd = remaining.indexOf('**', boldStart + 2);
          if (boldEnd === -1) {
            segments.push({ text: remaining.slice(boldStart + 2), bold: false });
            break;
          }
          segments.push({ text: remaining.slice(boldStart + 2, boldEnd), bold: true });
          remaining = remaining.slice(boldEnd + 2);
        }
        
        // Full clean text for wrapping
        const fullLineText = segments.map(s => s.text).join('');
        if (!fullLineText.trim()) { y += 3; continue; }
        const wrappedLines = doc.splitTextToSize(fullLineText, maxWidth);
        
        for (let wi = 0; wi < wrappedLines.length; wi++) {
          const wLine = wrappedLines[wi];
          if (y > 275) { doc.addPage(); y = 20; }
          
          // Check if this wrapped line contains bold segments
          let curX = xPos;
          let consumed = 0;
          // Find how many chars we already consumed in previous wrapped lines
          for (let pi = 0; pi < wi; pi++) consumed += wrappedLines[pi].length;
          // Remove leading spaces from consumed count adjustments
          const lineStart = consumed;
          const lineEnd = consumed + wLine.length;
          
          // Render segment by segment for this line portion
          let charPos = 0;
          let rendered = false;
          for (const seg of segments) {
            const segStart = charPos;
            const segEnd = charPos + seg.text.length;
            charPos = segEnd;
            
            // Find overlap with current wrapped line
            const overlapStart = Math.max(segStart, lineStart);
            const overlapEnd = Math.min(segEnd, lineEnd);
            if (overlapStart >= overlapEnd) continue;
            
            const portion = seg.text.slice(overlapStart - segStart, overlapEnd - segStart);
            if (!portion) continue;
            
            doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
            doc.text(portion, curX, y);
            curX += doc.getTextWidth(portion);
            rendered = true;
          }
          
          if (!rendered) {
            doc.setFont('helvetica', 'normal');
            doc.text(wLine, xPos, y, { align: 'justify', maxWidth });
          }
          y += 5;
        }
      }
    };

    const addSection = (label: string, text: string) => {
      if (!text) return;
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(99, 102, 241);
      doc.text(label, margin, y);
      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      renderMarkdownText(text, margin, contentWidth);
      y += 6;
    };

    // Plan info FIRST if available
    if (activePlan) {
      addSection('Objetivos do Plano', activePlan.objectives || '');
      addSection('Atividades Planejadas', activePlan.activities || '');
    }

    addSection('Anotações da Sessão', correctedNotes);
    addSection('Planos de Ação', correctedPlans);
    addSection('Planejamento para Próxima Sessão', correctedNext);
    addSection('Comentários Gerais', correctedComments);

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
      doc.text('Documento confidencial — uso exclusivo profissional', pageWidth / 2, 295, { align: 'center' });
    }

    doc.save(`sessao_${patientName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Relatório gerado!');
    } catch (e) {
      toast.error('Erro ao gerar relatório');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Generate AI Evolution
  const generateAIEvolution = async () => {
    if (!notesText && !actionPlans && !generalComments) {
      toast.error('Preencha as anotações da sessão antes de gerar a evolução.');
      return;
    }
    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-evolution', {
        body: {
          patientName,
          moodScore,
          positiveFeelings,
          negativeFeelings,
          suicidalThoughts,
          notesText,
          actionPlans,
          nextSessionNotes,
          generalComments,
          durationSeconds: elapsedSeconds,
          planObjectives: activePlan?.objectives || '',
          planActivities: activePlan?.activities || '',
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else if (data?.evolution) {
        setAiEvolution(data.evolution);
        toast.success('Evolução IA gerada!');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar evolução');
    } finally {
      setGeneratingAI(false);
    }
  };

  // Send AI evolution to Prontuário (evolutions table)
  const sendToProntuario = async () => {
    if (!user || !aiEvolution) return;
    setSendingToProntuario(true);
    const { error } = await supabase.from('evolutions').insert({
      user_id: user.id,
      patient_id: patientId,
      clinic_id: clinicId,
      date: new Date().toISOString().slice(0, 10),
      text: aiEvolution,
      attendance_status: 'presente',
      mood: moodScore ? moodEmojis[moodScore - 1] : null,
      stamp_id: selectedStampId || null,
    });
    setSendingToProntuario(false);
    if (error) {
      toast.error('Erro ao enviar para prontuário');
    } else {
      toast.success('Evolução salva no prontuário!');
      setAiEvolution('');
    }
  };

  const handleDeleteSession = async (id: string) => {
    const { error } = await supabase.from('therapy_sessions').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir sessão');
    else { toast.success('Sessão excluída'); loadHistory(); }
  };

  const handleEditSession = (session: any) => {
    // For finished sessions, load data but DON'T restart timer
    setSessionId(session.id);
    setTitle(session.title || '');
    setMoodScore(session.mood_score);
    setPositiveFeelings(session.positive_feelings || []);
    setNegativeFeelings(session.negative_feelings || []);
    setSuicidalThoughts(session.suicidal_thoughts || false);
    setNotesText(session.notes_text || '');
    setActionPlans(session.action_plans || '');
    setNextSessionNotes(session.next_session_notes || '');
    setGeneralComments(session.general_comments || '');
    setElapsedSeconds(session.duration_seconds || 0);
    setAiEvolution('');
    setTimerRunning(false);
    setStartedAt(null);
    setMainView('session');
  };

  const handleDeletePlan = async (planId: string) => {
    const { error } = await supabase.from('session_plans').delete().eq('id', planId);
    if (error) toast.error('Erro ao excluir plano');
    else { toast.success('Plano excluído'); loadPlans(); }
  };

  const moodEmojis = ['😭', '😢', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'];

  // Open stamp selector for declaration
  const handleRequestDeclaration = (session: any) => {
    const defaultStamp = stamps.find((s: any) => s.is_default) || stamps[0];
    setDeclarationStampId(defaultStamp?.id || null);
    setDeclarationSession(session);
  };

  // Generate attendance declaration PDF with selected stamp
  const generateDeclaration = async () => {
    const session = declarationSession;
    if (!session) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, cpf, professional_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      const chosenStamp = declarationStampId ? stamps.find((s: any) => s.id === declarationStampId) : (stamps.find((s: any) => s.is_default) || stamps[0]);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 25;
      const contentWidth = pageWidth - margin * 2;
      const centerX = pageWidth / 2;

      const { data: clinic } = await supabase
        .from('clinics')
        .select('name, letterhead, address, phone, cnpj')
        .eq('id', clinicId)
        .maybeSingle();

      let y = 20;

      if (clinic?.letterhead) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = clinic.letterhead;
          });
          const imgWidth = 160;
          const imgHeight = (img.height / img.width) * imgWidth;
          doc.addImage(img, 'PNG', (pageWidth - imgWidth) / 2, y, imgWidth, imgHeight);
          y += imgHeight + 10;
        } catch {
          y = 30;
        }
      } else {
        y = 40;
      }

      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(99, 102, 241);
      doc.text('Declaração', centerX, y, { align: 'center' });
      y += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('Documento Oficial de Presença', centerX, y, { align: 'center' });
      y += 25;

      const sessionDate = new Date(session.created_at);
      const dateStr = sessionDate.toLocaleDateString('pt-BR');
      const startTime = session.started_at
        ? new Date(session.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : sessionDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const endTime = session.finished_at
        ? new Date(session.finished_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : (() => {
            const end = new Date(sessionDate.getTime() + (session.duration_seconds || 0) * 1000);
            return end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          })();

      const cpfStr = patientCpf || 'Não Informado';
      const therapistName = profile?.name || 'Profissional';

      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'normal');

      const renderInlineParagraph = (parts: { text: string; bold: boolean }[], startY: number) => {
        let currentY = startY;
        let currentX = margin;
        const maxX = margin + contentWidth;
        const lineHeight = 7;
        const tokens = parts.flatMap((part) =>
          part.text
            .split(/(\s+)/)
            .filter(Boolean)
            .map((token) => ({
              text: /^\s+$/.test(token) ? ' ' : token,
              bold: part.bold,
              isSpace: /^\s+$/.test(token),
            }))
        );

        for (const token of tokens) {
          doc.setFont('helvetica', token.bold ? 'bold' : 'normal');
          const tokenWidth = doc.getTextWidth(token.text);

          if (!token.isSpace && currentX + tokenWidth > maxX) {
            currentY += lineHeight;
            if (currentY > 260) { doc.addPage(); currentY = 20; }
            currentX = margin;
          }

          if (!(token.isSpace && currentX === margin)) {
            doc.text(token.text, currentX, currentY);
            currentX += tokenWidth;
          }
        }

        return currentY + lineHeight;
      };

      const bodyParts = [
        { text: 'Declaro, para os devidos fins, que ', bold: false },
        { text: patientName, bold: true },
        { text: ', portador do CPF ', bold: false },
        { text: cpfStr, bold: true },
        { text: ', está em tratamento psicológico sob meus cuidados, e compareceu à sessão realizada no dia ', bold: false },
        { text: dateStr, bold: true },
        { text: ' das ', bold: false },
        { text: startTime, bold: true },
        { text: ' às ', bold: false },
        { text: endTime, bold: true },
        { text: '.', bold: false },
      ];

      y = renderInlineParagraph(bodyParts, y);

      y += 20;
      const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const now = new Date();
      const genDateStr = `Documento gerado em: ${String(now.getDate()).padStart(2, '0')} de ${months[now.getMonth()]} de ${now.getFullYear()}`;
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'italic');
      doc.text(genDateStr, centerX, y, { align: 'center' });

      // --- Signature block: stamp image → line → professional info ---
      // Calculate total block height to position it at bottom of page
      const lineWidth = pageWidth * 0.4;
      const signBlockStartY = pageHeight - 70; // anchor near bottom

      let sy = signBlockStartY;

      // 1. Stamp image (above the line, max 30mm tall, max 40mm wide)
      if (chosenStamp?.stamp_image) {
        try {
          const sImg = new Image();
          sImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            sImg.onload = () => resolve();
            sImg.onerror = () => reject();
            sImg.src = chosenStamp.stamp_image;
          });
          const maxW = 40;
          const maxH = 25;
          let sW = maxW;
          let sH = (sImg.height / sImg.width) * sW;
          if (sH > maxH) { sH = maxH; sW = (sImg.width / sImg.height) * sH; }
          doc.addImage(sImg, 'PNG', centerX - sW / 2, sy - sH, sW, sH);
        } catch { /* skip */ }
      }

      // 2. Signature line
      doc.setDrawColor(80, 80, 80);
      doc.line(centerX - lineWidth / 2, sy, centerX + lineWidth / 2, sy);

      // 3. Professional info below the line
      sy += 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(99, 102, 241);
      doc.text(therapistName, centerX, sy, { align: 'center' });
      sy += 5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      if (chosenStamp?.clinical_area) {
        doc.text(chosenStamp.clinical_area, centerX, sy, { align: 'center' });
        sy += 5;
      }
      if (chosenStamp?.cbo) {
        doc.text(`CBO: ${chosenStamp.cbo}`, centerX, sy, { align: 'center' });
      }

      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text('Documento confidencial — uso exclusivo profissional', centerX, pageHeight - 10, { align: 'center' });

      doc.save(`declaracao_comparecimento_${dateStr.replace(/\//g, '-')}.pdf`);
      toast.success('Declaração gerada!');
      setDeclarationSession(null);
    } catch (e: any) {
      toast.error('Erro ao gerar declaração');
    }
  };

  // View session detail dialog — shows session data + links to already generated content

  const renderViewDialog = () => {
    if (!viewingSession) return null;
    const s = viewingSession;
    const date = new Date(s.created_at);

    const handleDownloadReport = async () => {
      // Generate PDF from the session's saved data (on-the-fly, no state mutation)
      setGeneratingReport(true);
      try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const contentWidth = pageWidth - margin * 2;
        let y = 20;

        doc.setFillColor(99, 102, 241);
        doc.rect(0, 0, pageWidth, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Relatório de Sessão Terapêutica', margin, 26);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const sessionDate = date.toLocaleDateString('pt-BR');
        doc.text(`Sessão em: ${sessionDate}`, margin, 35);

        y = 52;
        doc.setTextColor(50, 50, 50);

        doc.setFillColor(245, 245, 250);
        doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Paciente', margin + 5, y + 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(patientName, margin + 5, y + 16);
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(`Sessão: ${s.title || 'Sem título'}  |  Duração: ${formatTime(s.duration_seconds || 0)}`, margin + 5, y + 23);
        y += 35;
        doc.setTextColor(50, 50, 50);

        if (s.mood_score) {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.text('Avaliação de Humor', margin, y);
          y += 6;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text(`${moodEmojis[s.mood_score - 1]}  ${s.mood_score}/10`, margin, y);
          y += 8;
        }

        // Helper: render markdown bold + justified text
        const renderMdText = (text: string) => {
          const originalLines = text.split('\n');
          for (const originalLine of originalLines) {
            const segments: { text: string; bold: boolean }[] = [];
            let rem = originalLine;
            while (rem.length > 0) {
              const bs = rem.indexOf('**');
              if (bs === -1) { if (rem) segments.push({ text: rem, bold: false }); break; }
              if (bs > 0) segments.push({ text: rem.slice(0, bs), bold: false });
              const be = rem.indexOf('**', bs + 2);
              if (be === -1) { segments.push({ text: rem.slice(bs + 2), bold: false }); break; }
              segments.push({ text: rem.slice(bs + 2, be), bold: true });
              rem = rem.slice(be + 2);
            }
            const fullText = segments.map(s => s.text).join('');
            if (!fullText.trim()) { y += 3; continue; }
            const wrappedLines = doc.splitTextToSize(fullText, contentWidth);
            let consumed = 0;
            for (const wLine of wrappedLines) {
              if (y > 280) { doc.addPage(); y = 20; }
              const lineStart = consumed;
              const lineEnd = consumed + wLine.length;
              consumed = lineEnd;
              let curX = margin;
              let charPos = 0;
              let didRender = false;
              for (const seg of segments) {
                const segStart = charPos;
                const segEnd = charPos + seg.text.length;
                charPos = segEnd;
                const oStart = Math.max(segStart, lineStart);
                const oEnd = Math.min(segEnd, lineEnd);
                if (oStart >= oEnd) continue;
                const portion = seg.text.slice(oStart - segStart, oEnd - segStart);
                if (!portion) continue;
                doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
                doc.text(portion, curX, y);
                curX += doc.getTextWidth(portion);
                didRender = true;
              }
              if (!didRender) {
                doc.setFont('helvetica', 'normal');
                doc.text(wLine, margin, y, { align: 'justify', maxWidth: contentWidth });
              }
              y += 5;
            }
          }
        };

        const addSection = (label: string, text: string) => {
          if (!text) return;
          if (y > 260) { doc.addPage(); y = 20; }
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(99, 102, 241);
          doc.text(label, margin, y);
          y += 6;
          doc.setFontSize(10);
          doc.setTextColor(60, 60, 60);
          renderMdText(text);
          y += 4;
        };

        addSection('Anotações da Sessão', s.notes_text || '');
        addSection('Planos de Ação', s.action_plans || '');
        addSection('Próxima Sessão', s.next_session_notes || '');
        addSection('Comentários Gerais', s.general_comments || '');

        doc.save(`relatorio_sessao_${sessionDate.replace(/\//g, '-')}.pdf`);
        toast.success('Relatório baixado!');
      } catch {
        toast.error('Erro ao gerar relatório');
      } finally {
        setGeneratingReport(false);
      }
    };

    const handleViewEvolution = async () => {
      if (viewLinkedEvolutionText !== null) return; // already loaded
      setLoadingLinkedData(true);
      try {
        const sessionDate = s.created_at.slice(0, 10);
        const { data } = await supabase
          .from('evolutions')
          .select('id, text, date, created_at')
          .eq('patient_id', patientId)
          .eq('clinic_id', clinicId)
          .eq('date', sessionDate)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setViewLinkedEvolution(data);
          setViewLinkedEvolutionText(data.text);
        } else {
          setViewLinkedEvolutionText('');
          toast.info('Nenhuma evolução encontrada para esta sessão.');
        }
      } catch {
        toast.error('Erro ao buscar evolução');
      } finally {
        setLoadingLinkedData(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => { setViewingSession(null); setViewLinkedEvolutionText(null); setViewLinkedEvolution(null); }}>
        <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{s.title || `Sessão ${date.toLocaleDateString('pt-BR')}`}</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewingSession(null); setViewLinkedEvolutionText(null); setViewLinkedEvolution(null); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {date.toLocaleDateString('pt-BR')} às {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Duração: {formatTime(s.duration_seconds || 0)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.mood_score && <div><Label className="text-xs text-muted-foreground">Humor</Label><p className="text-lg">{moodEmojis[s.mood_score - 1]} {s.mood_score}/10</p></div>}
            {s.positive_feelings?.length > 0 && <div><Label className="text-xs text-muted-foreground">Sentimentos Positivos</Label><div className="flex flex-wrap gap-1 mt-1">{s.positive_feelings.map((f: string, i: number) => <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">{f}</Badge>)}</div></div>}
            {s.negative_feelings?.length > 0 && <div><Label className="text-xs text-muted-foreground">Sentimentos Negativos</Label><div className="flex flex-wrap gap-1 mt-1">{s.negative_feelings.map((f: string, i: number) => <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400">{f}</Badge>)}</div></div>}
            {s.suicidal_thoughts && <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /><span className="text-sm text-destructive font-semibold">Pensamentos suicidas reportados</span></div>}
            {s.notes_text && <div><Label className="text-xs text-muted-foreground">Anotações</Label><p className="text-sm mt-1 whitespace-pre-wrap">{s.notes_text}</p></div>}
            {s.action_plans && <div><Label className="text-xs text-muted-foreground">Planos de Ação</Label><p className="text-sm mt-1 whitespace-pre-wrap">{s.action_plans}</p></div>}
            {s.next_session_notes && <div><Label className="text-xs text-muted-foreground">Próxima Sessão</Label><p className="text-sm mt-1 whitespace-pre-wrap">{s.next_session_notes}</p></div>}
            {s.general_comments && <div><Label className="text-xs text-muted-foreground">Comentários Gerais</Label><p className="text-sm mt-1 whitespace-pre-wrap">{s.general_comments}</p></div>}

            {/* Linked evolution preview */}
            {viewLinkedEvolutionText && (
              <div className="border border-border rounded-lg p-3 bg-muted/30 space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Sparkles className="w-3 h-3" /> Evolução Gerada</Label>
                <div className="text-sm whitespace-pre-wrap text-justify">{viewLinkedEvolutionText.split(/(\*\*.*?\*\*)/).map((part, i) => 
                  part.startsWith('**') && part.endsWith('**') 
                    ? <strong key={i}>{part.slice(2, -2)}</strong> 
                    : part
                )}</div>
              </div>
            )}

            {/* Action buttons: view/download already generated content */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleDownloadReport} disabled={generatingReport} className="gap-1.5">
                {generatingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Baixar Relatório PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleViewEvolution} disabled={loadingLinkedData || viewLinkedEvolutionText !== null} className="gap-1.5">
                {loadingLinkedData ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                {viewLinkedEvolutionText !== null ? 'Evolução exibida' : 'Ver Evolução'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 border-b border-border pb-2 flex-wrap">
        <Button variant={mainView === 'planning' ? 'default' : 'ghost'} size="sm" onClick={() => setMainView('planning')} className="gap-1.5">
          <Target className="w-3.5 h-3.5" /> Planejamento
        </Button>
        <Button variant={mainView === 'session' ? 'default' : 'ghost'} size="sm" onClick={() => setMainView('session')} className="gap-1.5">
          <PenLine className="w-3.5 h-3.5" /> Sessão Ativa
          {sessionId && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
        </Button>
        <Button variant={mainView === 'history' ? 'default' : 'ghost'} size="sm" onClick={() => setMainView('history')} className="gap-1.5">
          <History className="w-3.5 h-3.5" /> Realizadas
          {sessions.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">{sessions.length}</Badge>}
        </Button>
        <Button variant={mainView === 'next_sessions' ? 'default' : 'ghost'} size="sm" onClick={() => setMainView('next_sessions')} className="gap-1.5">
          <CalendarPlus className="w-3.5 h-3.5" /> Próximas Sessões
          {savedNextSessions.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">{savedNextSessions.length}</Badge>}
        </Button>
      </div>

      {/* ===== PLANNING VIEW ===== */}
      {mainView === 'planning' && (
        showPlanForm || editingPlan ? (
          <SessionPlanForm
            patientId={patientId}
            clinicId={clinicId}
            editingPlan={editingPlan}
            onSaved={() => { setShowPlanForm(false); setEditingPlan(null); loadPlans(); }}
            onCancel={() => { setShowPlanForm(false); setEditingPlan(null); }}
          />
        ) : (
          <SessionPlansList
            plans={plans}
            onNewPlan={() => setShowPlanForm(true)}
            onEditPlan={(plan) => setEditingPlan(plan)}
            onDeletePlan={handleDeletePlan}
            onStartSession={startSessionFromPlan}
          />
        )
      )}

      {/* ===== SESSION VIEW ===== */}
      {mainView === 'session' && (
        <>
          {/* Header */}
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    {patientAvatar && <AvatarImage src={patientAvatar} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">{patientName[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold text-foreground text-base">{patientName}</h2>
                    {lastSaved && <p className="text-xs text-muted-foreground">Salvo às {lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sessionId && <Button variant="outline" size="sm" onClick={exitSession}>Sair da sessão</Button>}
                  {!sessionId ? (
                    <Button size="sm" onClick={startSession} className="gap-1.5"><Play className="w-3.5 h-3.5" /> Iniciar sessão</Button>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={finishSession} className="gap-1.5">
                      <Square className="w-3.5 h-3.5" /> Finalizar {formatTime(elapsedSeconds)}
                    </Button>
                  )}
                </div>
              </div>
              {sessionId && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-lg font-semibold text-foreground">{formatTime(elapsedSeconds)}</span>
                  {timerRunning ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={pauseTimer}><Pause className="w-4 h-4" /></Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resumeTimer}><Play className="w-4 h-4" /></Button>
                  )}
                  {saving && <span className="text-xs text-muted-foreground ml-auto">Salvando...</span>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan Summary (read-only) */}
          {activePlan && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" /> Resumo do Plano
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {activePlan.objectives && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Objetivos Terapêuticos</Label>
                    <p className="text-foreground whitespace-pre-wrap mt-0.5 select-none pointer-events-none">{activePlan.objectives}</p>
                  </div>
                )}
                {activePlan.activities && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Atividades Planejadas</Label>
                    <p className="text-foreground whitespace-pre-wrap mt-0.5 select-none pointer-events-none">{activePlan.activities}</p>
                  </div>
                )}
                {(activePlan.external_links as any[])?.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Links de Referência</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(activePlan.external_links as any[]).map((link: any, i: number) => (
                        <Badge key={i} variant="secondary" className="gap-1">
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline text-primary">{link.label}</a>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Dados da Sessão</CardTitle></CardHeader>
            <CardContent>
              <Label className="text-xs">Título da sessão</Label>
              <Input placeholder="Ex: Sessão 05 - Ansiedade no trabalho" value={title} onChange={e => setTitle(e.target.value)} />
            </CardContent>
          </Card>

          {/* Clinical Assessment */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Smile className="w-4 h-4 text-primary" /> Avaliação Clínica Rápida</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs mb-2 block">Humor do paciente</Label>
                <div className="flex items-center gap-1 flex-wrap">
                  {moodEmojis.map((emoji, i) => (
                    <button key={i} onClick={() => setMoodScore(i + 1)} className={cn('text-2xl p-1.5 rounded-lg transition-all hover:scale-110', moodScore === i + 1 ? 'bg-primary/15 ring-2 ring-primary scale-110' : 'hover:bg-muted')} title={`${i + 1}/10`}>{emoji}</button>
                  ))}
                  {moodScore !== null && <span className="text-sm font-semibold text-primary ml-2">{moodScore}/10</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-1.5"><Smile className="w-3 h-3 text-green-500" /> Sentimentos Positivos</Label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {positiveFeelings.map((f, i) => (
                      <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 gap-1">{f}<X className="w-3 h-3 cursor-pointer" onClick={() => removeFeeling('positive', i)} /></Badge>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Input value={newPositive} onChange={e => setNewPositive(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFeeling('positive')} placeholder="Adicionar..." className="h-8 text-xs" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => addFeeling('positive')}><Plus className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1 mb-1.5"><Frown className="w-3 h-3 text-red-500" /> Sentimentos Negativos</Label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {negativeFeelings.map((f, i) => (
                      <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400 gap-1">{f}<X className="w-3 h-3 cursor-pointer" onClick={() => removeFeeling('negative', i)} /></Badge>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Input value={newNegative} onChange={e => setNewNegative(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFeeling('negative')} placeholder="Adicionar..." className="h-8 text-xs" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => addFeeling('negative')}><Plus className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </div>

              <div className={cn('flex items-center gap-3 p-3 rounded-lg border transition-colors', suicidalThoughts ? 'border-red-500/50 bg-red-500/5' : 'border-border')}>
                <Switch checked={suicidalThoughts} onCheckedChange={setSuicidalThoughts} className={suicidalThoughts ? 'data-[state=checked]:bg-red-500' : ''} />
                <div className="flex items-center gap-2">
                  {suicidalThoughts && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  <Label className={cn('text-sm', suicidalThoughts ? 'text-red-600 dark:text-red-400 font-semibold' : '')}>Pensamentos suicidas</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Notes Area */}
          <Card className="border-border">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full bg-muted/50 rounded-none border-b border-border h-auto p-0">
                  {[
                    { value: 'notes', icon: PenLine, label: 'Anotações' },
                    { value: 'plans', icon: ListTodo, label: 'Planos de Ação' },
                    { value: 'next', icon: CalendarPlus, label: 'Próxima Sessão' },
                  ].map(({ value, icon: Icon, label }) => (
                    <TabsTrigger key={value} value={value} className="flex-1 rounded-none border-b-2 border-transparent py-3 text-xs sm:text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none gap-1.5">
                      <Icon className="w-3.5 h-3.5" />{label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <div className="p-4">
                  <TabsContent value="notes" className="mt-0 space-y-2">
                    <Textarea value={notesText} onChange={e => setNotesText(e.target.value)} placeholder="Registre observações, insights e pontos importantes da sessão atual." className="min-h-[200px] resize-y" />
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={improvingField === 'notes' || !notesText.trim()} onClick={() => improveFieldText('notes', () => notesText, setNotesText)}>
                      {improvingField === 'notes' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Melhorar com IA
                    </Button>
                  </TabsContent>
                  <TabsContent value="plans" className="mt-0 space-y-2">
                    <Textarea value={actionPlans} onChange={e => setActionPlans(e.target.value)} placeholder="Liste tarefas, exercícios ou atividades para o paciente fazer em casa." className="min-h-[200px] resize-y" />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={improvingField === 'action_plans' || !actionPlans.trim()} onClick={() => improveFieldText('action_plans', () => actionPlans, setActionPlans)}>
                        {improvingField === 'action_plans' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Melhorar com IA
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary" disabled={creatingField === 'create_action_plans'} onClick={() => createFieldWithAI('create_action_plans', setActionPlans)}>
                        {creatingField === 'create_action_plans' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Criar com IA
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={!actionPlans.trim() || sendingToPortal} onClick={() => setShowSendModal(true)}>
                        {sendingToPortal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar para Portal
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="next" className="mt-0 space-y-2">
                    <Textarea value={nextSessionNotes} onChange={e => setNextSessionNotes(e.target.value)} placeholder="O que trabalhar na próxima sessão? Planejamento e temas pendentes." className="min-h-[200px] resize-y" />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={improvingField === 'next_session' || !nextSessionNotes.trim()} onClick={() => improveFieldText('next_session', () => nextSessionNotes, setNextSessionNotes)}>
                        {improvingField === 'next_session' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Melhorar com IA
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary" disabled={creatingField === 'create_next_session'} onClick={() => createFieldWithAI('create_next_session', setNextSessionNotes)}>
                        {creatingField === 'create_next_session' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Criar com IA
                      </Button>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* General Comments */}
          <Card className="border-border">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Comentários Gerais</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={generalComments} onChange={e => setGeneralComments(e.target.value)} placeholder="Use este espaço para anotar lembretes, dicas, revisões das anotações, etc." className="min-h-[80px] resize-y" />
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card className="border-border">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> Arquivos da Sessão</CardTitle></CardHeader>
            <CardContent>
              <FileUpload existingFiles={attachedFiles} onUpload={(files) => setAttachedFiles(prev => [...prev, ...files])} onRemove={(fileId) => setAttachedFiles(prev => prev.filter(f => f.id !== fileId))} parentId={sessionId || 'temp'} parentType="therapy_session" multiple />
              <p className="text-xs text-muted-foreground mt-2">Envie até 5 arquivos (máx 20MB por arquivo).</p>
            </CardContent>
          </Card>

          {/* AI Evolution */}
          {aiEvolution && (
            <Card className="border-border border-primary/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Evolução Gerada por IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea value={aiEvolution} onChange={e => setAiEvolution(e.target.value)} className="min-h-[200px] resize-y text-sm" />
                {stamps.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Stamp className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Carimbo:</Label>
                    <Select value={selectedStampId || ''} onValueChange={(v) => setSelectedStampId(v || null)}>
                      <SelectTrigger className="w-[250px] h-8 text-xs">
                        <SelectValue placeholder="Selecione um carimbo" />
                      </SelectTrigger>
                      <SelectContent>
                        {stamps.map((s: any) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.name} — {s.clinical_area}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={sendToProntuario} disabled={sendingToProntuario} className="gap-1.5">
                  {sendingToProntuario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar para Prontuário
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {sessionId && <Button variant="outline" onClick={() => saveSession(true)} disabled={saving}>{saving ? 'Salvando...' : 'Salvar sessão'}</Button>}
            <Button variant="outline" onClick={generateReport} disabled={generatingReport} className="gap-1.5">
              {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {generatingReport ? 'Gerando...' : 'Gerar Relatório'}
            </Button>
            <Button variant="outline" onClick={generateAIEvolution} disabled={generatingAI} className="gap-1.5">
              {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Gerar Evolução IA
            </Button>
          </div>
        </>
      )}

      {/* ===== HISTORY VIEW ===== */}
      {mainView === 'history' && (
        <>
          <SessionHistory
            sessions={sessions}
            onView={(s) => setViewingSession(s)}
            onEdit={handleEditSession}
            onDelete={handleDeleteSession}
            onNewSession={() => { resetForm(); setMainView('session'); }}
            onGenerateReport={generateReport}
            onGenerateDeclaration={handleRequestDeclaration}
          />
          {renderViewDialog()}

          {/* Stamp selector dialog for declaration */}
          <Dialog open={!!declarationSession} onOpenChange={v => !v && setDeclarationSession(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm">
                  <Stamp className="w-4 h-4 text-primary" /> Declaração de Comparecimento
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Selecione o carimbo que será usado na declaração. O CBO e a área clínica serão preenchidos automaticamente.
                </p>
                {stamps.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-xs">Carimbo</Label>
                    <Select value={declarationStampId || ''} onValueChange={setDeclarationStampId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecionar carimbo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {stamps.map((s: any) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs">
                            {s.name} — {s.clinical_area} {s.cbo ? `(CBO: ${s.cbo})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {declarationStampId && (() => {
                      const st = stamps.find((s: any) => s.id === declarationStampId);
                      return st?.stamp_image ? (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border">
                          <img src={st.stamp_image} alt="Carimbo" className="h-12 object-contain" />
                          <div className="text-[10px] text-muted-foreground space-y-0.5">
                            <p className="font-medium text-foreground">{st.name}</p>
                            {st.cbo && <p>CBO: {st.cbo}</p>}
                            <p>{st.clinical_area}</p>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum carimbo cadastrado. A declaração será gerada sem CBO.</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setDeclarationSession(null)}>
                    Cancelar
                  </Button>
                  <Button size="sm" className="flex-1 text-xs gap-1.5" onClick={generateDeclaration}>
                    <Download className="w-3 h-3" /> Gerar PDF
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ===== NEXT SESSIONS VIEW ===== */}
      {mainView === 'next_sessions' && (
        <div className="space-y-3">
          {savedNextSessions.length === 0 ? (
            <div className="text-center py-12">
              <CalendarPlus className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhum planejamento de próxima sessão salvo</p>
              <p className="text-xs text-muted-foreground mt-1">Os planejamentos são salvos automaticamente ao finalizar uma sessão com a aba &quot;Próxima Sessão&quot; preenchida.</p>
            </div>
          ) : (
            savedNextSessions.map(s => {
              const date = new Date(s.created_at);
              return (
                <Card key={s.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{s.title || `Sessão ${date.toLocaleDateString('pt-BR')}`}</p>
                        <p className="text-xs text-muted-foreground">{date.toLocaleDateString('pt-BR')}</p>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={() => downloadNextSessionWord(s)}>
                        <Download className="w-3.5 h-3.5" /> Word
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-4">{s.next_session_notes}</p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      <SendActionPlanModal
        open={showSendModal}
        onOpenChange={setShowSendModal}
        actionPlansText={actionPlans}
        onSend={sendActionPlansToPortal}
      />
    </div>
  );
}
