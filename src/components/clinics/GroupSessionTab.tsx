import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { toast } from 'sonner';
import { Play, Pause, Square, X, AlertTriangle, Plus, Smile, Frown, PenLine, ListTodo, CalendarPlus, Clock, History, Sparkles, Send, Loader2, Wand2, Users, Target, Download, Eye, Trash2, BrainCircuit, MoreVertical, Pencil, ScrollText, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SendActionPlanModal, type ActivityAttachment } from '@/components/patients/SendActionPlanModal';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';

interface MemberPatient {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface ParticipantData {
  moodScore: number | null;
  positiveFeelings: string[];
  negativeFeelings: string[];
  suicidalThoughts: boolean;
}

interface GroupSessionTabProps {
  groupId: string;
  groupName: string;
  clinicId: string;
  members: MemberPatient[];
}

const moodEmojis = ['😭', '😢', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'];

export function GroupSessionTab({ groupId, groupName, clinicId, members }: GroupSessionTabProps) {
  const { user } = useAuth();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [participantsData, setParticipantsData] = useState<Record<string, ParticipantData>>({});
  const [notesText, setNotesText] = useState('');
  const [actionPlans, setActionPlans] = useState('');
  const [nextSessionNotes, setNextSessionNotes] = useState('');
  const [generalComments, setGeneralComments] = useState('');
  const [activeTab, setActiveTab] = useState('notes');

  const [newFeelings, setNewFeelings] = useState<Record<string, { positive: string; negative: string }>>({});

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-save
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  // Sub-views: planning | session | history
  const [mainView, setMainView] = useState<'planning' | 'session' | 'history'>('planning');

  // History
  const [sessions, setSessions] = useState<any[]>([]);
  const [viewingSession, setViewingSession] = useState<any | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  // Plans
  const [plans, setPlans] = useState<any[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planObjectives, setPlanObjectives] = useState('');
  const [planActivities, setPlanActivities] = useState('');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<any>(null);

  // Attendance per participant
  const [participantAttendance, setParticipantAttendance] = useState<Record<string, string>>({});

  // AI
  const [aiEvolution, setAiEvolution] = useState('');
  const [aiEvoMode, setAiEvoMode] = useState<'group' | 'individual'>('group');
  const [aiEvoCreationMode, setAiEvoCreationMode] = useState<'manual' | 'ai'>('ai');
  const [aiIndividualEvolutions, setAiIndividualEvolutions] = useState<Record<string, string>>({});
  const [aiIndividualCreationMode, setAiIndividualCreationMode] = useState<'manual' | 'ai'>('ai');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [generatingIndividualFor, setGeneratingIndividualFor] = useState<string | null>(null);
  const [sendingToProntuario, setSendingToProntuario] = useState(false);
  const [improvingField, setImprovingField] = useState<string | null>(null);
  const [creatingField, setCreatingField] = useState<string | null>(null);
  const [sendingToPortal, setSendingToPortal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendTargetMemberId, setSendTargetMemberId] = useState<string | null>(null);
  const [sendIndividualMemberId, setSendIndividualMemberId] = useState<string | null>(null);

  // Stamps & Declaration
  const [stamps, setStamps] = useState<any[]>([]);
  const [declarationSession, setDeclarationSession] = useState<any | null>(null);
  const [declarationStampId, setDeclarationStampId] = useState<string | null>(null);
  const [declarationMemberId, setDeclarationMemberId] = useState<string | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  // Init participants data
  useEffect(() => {
    const init: Record<string, ParticipantData> = {};
    const initFeelings: Record<string, { positive: string; negative: string }> = {};
    const initAttendance: Record<string, string> = {};
    members.forEach(m => {
      init[m.id] = participantsData[m.id] || { moodScore: null, positiveFeelings: [], negativeFeelings: [], suicidalThoughts: false };
      initFeelings[m.id] = newFeelings[m.id] || { positive: '', negative: '' };
      initAttendance[m.id] = participantAttendance[m.id] || 'presente';
    });
    setParticipantsData(init);
    setNewFeelings(initFeelings);
    setParticipantAttendance(initAttendance);
  }, [members.map(m => m.id).join(',')]); 

  useEffect(() => {
    if (!user || !groupId) return;
    loadActiveSession();
    loadHistory();
    loadPlans();
    // Load stamps
    supabase.from('stamps').select('*').eq('user_id', user.id).then(({ data }) => {
      if (data) setStamps(data);
    });
  }, [user, groupId]);

  // ─── Data Loading ───
  const loadActiveSession = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('therapy_sessions')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      populateSessionForm(data);
      setMainView('session');
      if (data.plan_id) {
        const { data: plan } = await supabase.from('session_plans').select('*').eq('id', data.plan_id).maybeSingle();
        if (plan) setActivePlan(plan);
      }
    }
  };

  const populateSessionForm = (data: any) => {
    setSessionId(data.id);
    setTitle(data.title || '');
    setNotesText(data.notes_text || '');
    setActionPlans(data.action_plans || '');
    setNextSessionNotes(data.next_session_notes || '');
    setGeneralComments(data.general_comments || '');
    setElapsedSeconds(data.duration_seconds || 0);
    setAiEvolution(data.ai_evolution || '');
    if (data.ai_individual_evolutions && typeof data.ai_individual_evolutions === 'object') {
      setAiIndividualEvolutions(data.ai_individual_evolutions);
    }

    if (data.participants_data && typeof data.participants_data === 'object') {
      const restored: Record<string, ParticipantData> = {};
      const restoredAttendance: Record<string, string> = {};
      for (const [pid, pd] of Object.entries(data.participants_data as Record<string, any>)) {
        restored[pid] = {
          moodScore: pd.mood_score ?? null,
          positiveFeelings: pd.positive_feelings || [],
          negativeFeelings: pd.negative_feelings || [],
          suicidalThoughts: pd.suicidal_thoughts || false,
        };
        restoredAttendance[pid] = pd.attendance_status || 'presente';
      }
      setParticipantsData(prev => ({ ...prev, ...restored }));
      setParticipantAttendance(prev => ({ ...prev, ...restoredAttendance }));
    }

    if (data.started_at && !data.finished_at) {
      const start = new Date(data.started_at);
      setStartedAt(start);
      setElapsedSeconds(Math.floor((Date.now() - start.getTime()) / 1000));
      setTimerRunning(true);
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('therapy_sessions')
      .select('id, title, created_at, duration_seconds, status, notes_text, action_plans, next_session_notes, general_comments, participants_data, started_at, finished_at, plan_id, ai_evolution, ai_individual_evolutions')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'finished')
      .order('created_at', { ascending: false });
    if (data) setSessions(data);
  };

  const loadPlans = async () => {
    if (!user) return;
    const { data } = await supabase.from('session_plans')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setPlans(data.filter((p: any) => p.objectives?.includes(`[grupo:${groupId}]`)));
  };

  // ─── Timer ───
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  useEffect(() => {
    if (!sessionId) return;
    autoSaveRef.current = setTimeout(() => saveSession(false), 60000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [notesText, actionPlans, nextSessionNotes, generalComments, title, participantsData, sessionId]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const serializeParticipantsData = () => {
    const out: Record<string, any> = {};
    for (const [pid, pd] of Object.entries(participantsData)) {
      out[pid] = {
        mood_score: pd.moodScore,
        positive_feelings: pd.positiveFeelings,
        negative_feelings: pd.negativeFeelings,
        suicidal_thoughts: pd.suicidalThoughts,
      };
    }
    return out;
  };

  // ─── Session Actions ───
  const startSession = async () => {
    if (!user) return;
    const now = new Date();
    setStartedAt(now);
    setTimerRunning(true);

    if (sessionId) {
      await supabase.from('therapy_sessions').update({ started_at: now.toISOString() } as any).eq('id', sessionId);
    } else {
      const { data, error } = await supabase.from('therapy_sessions').insert({
        user_id: user.id,
        patient_id: members[0]?.id || user.id,
        clinic_id: clinicId,
        group_id: groupId,
        title,
        started_at: now.toISOString(),
        status: 'active',
        price: 0,
        payment_pending: false,
        participants_data: serializeParticipantsData(),
      } as any).select('id').single();
      if (data) setSessionId(data.id);
      if (error) toast.error('Erro ao iniciar sessão');
    }
    setMainView('session');
  };

  const startSessionFromPlan = async (plan: any) => {
    if (!user) return;
    const now = new Date();
    const { data, error } = await supabase.from('therapy_sessions').insert({
      user_id: user.id,
      patient_id: members[0]?.id || user.id,
      clinic_id: clinicId,
      group_id: groupId,
      title: plan.title,
      started_at: now.toISOString(),
      status: 'active',
      plan_id: plan.id,
      price: 0,
      payment_pending: false,
      participants_data: serializeParticipantsData(),
    } as any).select('*').single();

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

  const saveSession = useCallback(async (showToast = true) => {
    if (!user || !sessionId) return;
    setSaving(true);
    const { error } = await supabase.from('therapy_sessions').update({
      title,
      notes_text: notesText,
      action_plans: actionPlans,
      next_session_notes: nextSessionNotes,
      general_comments: generalComments,
      duration_seconds: elapsedSeconds,
      participants_data: serializeParticipantsData(),
      ai_evolution: aiEvolution,
      ai_individual_evolutions: aiIndividualEvolutions,
    } as any).eq('id', sessionId);
    setSaving(false);
    if (error) {
      if (showToast) toast.error('Erro ao salvar');
    } else {
      setLastSaved(new Date());
      if (showToast) toast.success('Sessão salva!');
    }
  }, [user, sessionId, title, notesText, actionPlans, nextSessionNotes, generalComments, elapsedSeconds, participantsData, aiEvolution, aiIndividualEvolutions]);

  const finishSession = async () => {
    if (!user || !sessionId) return;
    setTimerRunning(false);
    const { error } = await supabase.from('therapy_sessions').update({
      title,
      notes_text: notesText,
      action_plans: actionPlans,
      next_session_notes: nextSessionNotes,
      general_comments: generalComments,
      duration_seconds: elapsedSeconds,
      participants_data: serializeParticipantsData(),
      finished_at: new Date().toISOString(),
      status: 'finished',
      ai_evolution: aiEvolution,
      ai_individual_evolutions: aiIndividualEvolutions,
    } as any).eq('id', sessionId);

    if (error) {
      toast.error('Erro ao finalizar sessão');
    } else {
      toast.success('Sessão finalizada!');
      setSessionId(null);
      resetForm();
      await loadHistory();
      setMainView('history');
    }
  };

  const resetForm = () => {
    setTitle('');
    setNotesText('');
    setActionPlans('');
    setNextSessionNotes('');
    setGeneralComments('');
    setElapsedSeconds(0);
    setStartedAt(null);
    setAiEvolution('');
    setActivePlan(null);
    const init: Record<string, ParticipantData> = {};
    members.forEach(m => {
      init[m.id] = { moodScore: null, positiveFeelings: [], negativeFeelings: [], suicidalThoughts: false };
    });
    setParticipantsData(init);
  };

  // ─── Participant helpers ───
  const updateParticipant = (pid: string, updates: Partial<ParticipantData>) => {
    setParticipantsData(prev => ({ ...prev, [pid]: { ...prev[pid], ...updates } }));
  };

  const addFeeling = (pid: string, type: 'positive' | 'negative') => {
    const current = newFeelings[pid];
    if (!current) return;
    const text = type === 'positive' ? current.positive.trim() : current.negative.trim();
    if (!text) return;
    const pd = participantsData[pid];
    if (type === 'positive') {
      updateParticipant(pid, { positiveFeelings: [...pd.positiveFeelings, text] });
      setNewFeelings(prev => ({ ...prev, [pid]: { ...prev[pid], positive: '' } }));
    } else {
      updateParticipant(pid, { negativeFeelings: [...pd.negativeFeelings, text] });
      setNewFeelings(prev => ({ ...prev, [pid]: { ...prev[pid], negative: '' } }));
    }
  };

  const removeFeeling = (pid: string, type: 'positive' | 'negative', index: number) => {
    const pd = participantsData[pid];
    if (type === 'positive') {
      updateParticipant(pid, { positiveFeelings: pd.positiveFeelings.filter((_, i) => i !== index) });
    } else {
      updateParticipant(pid, { negativeFeelings: pd.negativeFeelings.filter((_, i) => i !== index) });
    }
  };

  // ─── AI ───
  const improveFieldText = async (field: 'notes' | 'action_plans' | 'next_session', getText: () => string, setText: (v: string) => void) => {
    const text = getText();
    if (!text.trim()) { toast.error('Preencha o campo antes de melhorar com IA.'); return; }
    setImprovingField(field);
    try {
      const { data, error } = await supabase.functions.invoke('improve-session-text', { body: { text, field } });
      if (error) throw error;
      if (data?.improved) { setText(data.improved); toast.success('Texto melhorado com IA!'); }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao melhorar texto');
    } finally {
      setImprovingField(null);
    }
  };

  // Create text with AI from session context
  const createFieldWithAI = async (field: 'create_action_plans' | 'create_next_session', setText: (v: string) => void) => {
    const participantsSummary = members.map(m => {
      const pd = participantsData[m.id];
      if (!pd) return '';
      return [
        `Participante: ${m.name}`,
        pd.moodScore ? `Humor: ${pd.moodScore}/10` : '',
        pd.positiveFeelings.length > 0 ? `Sentimentos positivos: ${pd.positiveFeelings.join(', ')}` : '',
        pd.negativeFeelings.length > 0 ? `Sentimentos negativos: ${pd.negativeFeelings.join(', ')}` : '',
        pd.suicidalThoughts ? 'ALERTA: Ideação suicida reportada' : '',
      ].filter(Boolean).join('\n');
    }).filter(Boolean).join('\n---\n');

    const context = [
      notesText ? `Anotações: ${notesText}` : '',
      participantsSummary ? `Dados dos participantes:\n${participantsSummary}` : '',
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

  // Send action plans to individual patient portal
  const sendActionPlansToPortal = async (title: string, dueDate: string, attachments: ActivityAttachment[]) => {
    if (!user || !actionPlans.trim() || !sendTargetMemberId) return;
    setSendingToPortal(true);
    try {
      const lines = actionPlans.split('\n').map(l => l.replace(/^[\s\-\*\d\.]+/, '').trim()).filter(Boolean);
      const items = lines.map(text => ({ text, done: false }));

      const { data: portalAccount } = await supabase
        .from('patient_portal_accounts')
        .select('id')
        .eq('patient_id', sendTargetMemberId)
        .eq('therapist_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const { error } = await supabase.from('portal_activities').insert({
        patient_id: sendTargetMemberId,
        therapist_user_id: user.id,
        portal_account_id: portalAccount?.id || null,
        title: title || 'Plano de Ação',
        items: items as any,
        due_date: dueDate || null,
        attachments: attachments as any,
        status: 'pending',
      });

      if (error) throw error;
      const memberName = members.find(m => m.id === sendTargetMemberId)?.name || 'paciente';
      toast.success(`Plano de ação enviado para o portal de ${memberName}!`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar para portal');
    } finally {
      setSendingToPortal(false);
      setShowSendModal(false);
      setSendTargetMemberId(null);
    }
  };

  const generateAIEvolution = async () => {
    if (!notesText && !actionPlans && !generalComments) {
      toast.error('Preencha as anotações da sessão antes de gerar a evolução.'); return;
    }
    setGeneratingAI(true);
    try {
      const participantsSummary = members.map(m => {
        const pd = participantsData[m.id];
        if (!pd) return '';
        return [
          `Participante: ${m.name}`,
          pd.moodScore ? `Humor: ${pd.moodScore}/10` : '',
          pd.positiveFeelings.length > 0 ? `Sentimentos positivos: ${pd.positiveFeelings.join(', ')}` : '',
          pd.negativeFeelings.length > 0 ? `Sentimentos negativos: ${pd.negativeFeelings.join(', ')}` : '',
          pd.suicidalThoughts ? 'ALERTA: Ideação suicida reportada' : '',
        ].filter(Boolean).join('\n');
      }).filter(Boolean).join('\n---\n');

      const { data, error } = await supabase.functions.invoke('generate-evolution', {
        body: {
          patientName: `Grupo: ${groupName} (${members.map(m => m.name).join(', ')})`,
          moodScore: null,
          positiveFeelings: [],
          negativeFeelings: [],
          suicidalThoughts: Object.values(participantsData).some(pd => pd.suicidalThoughts),
          notesText: `${participantsSummary}\n\n${notesText}`,
          actionPlans,
          nextSessionNotes,
          generalComments,
          durationSeconds: elapsedSeconds,
          planObjectives: activePlan?.objectives || '',
          planActivities: activePlan?.activities || '',
        },
      });
      if (error) throw error;
      if (data?.evolution) { setAiEvolution(data.evolution); toast.success('Evolução IA gerada!'); }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar evolução');
    } finally {
      setGeneratingAI(false);
    }
  };

  // Generate individual AI evolutions for each member
  const generateIndividualEvolutions = async () => {
    if (!user) return;
    setGeneratingAI(true);
    try {
      const results: Record<string, string> = {};
      for (const m of members) {
        setGeneratingIndividualFor(m.id);
        const pd = participantsData[m.id];
        const { data, error } = await supabase.functions.invoke('generate-evolution', {
          body: {
            patientName: m.name,
            moodScore: pd?.moodScore || null,
            positiveFeelings: pd?.positiveFeelings || [],
            negativeFeelings: pd?.negativeFeelings || [],
            suicidalThoughts: pd?.suicidalThoughts || false,
            notesText: notesText,
            actionPlans,
            nextSessionNotes,
            generalComments,
            durationSeconds: elapsedSeconds,
            planObjectives: activePlan?.objectives || '',
            planActivities: activePlan?.activities || '',
          },
        });
        if (error) throw error;
        if (data?.evolution) results[m.id] = data.evolution;
      }
      setAiIndividualEvolutions(results);
      setGeneratingIndividualFor(null);
      toast.success(`Evoluções individuais geradas para ${Object.keys(results).length} participante(s)!`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar evoluções individuais');
    } finally {
      setGeneratingAI(false);
      setGeneratingIndividualFor(null);
    }
  };

  const sendToGroupProntuario = async () => {
    if (!user) return;
    setSendingToProntuario(true);
    if (aiEvoMode === 'individual') {
      // Send each individual evolution
      const inserts = members.filter(m => aiIndividualEvolutions[m.id]).map(m => ({
        user_id: user.id,
        patient_id: m.id,
        clinic_id: clinicId,
        group_id: groupId,
        date: new Date().toISOString().slice(0, 10),
        text: aiIndividualEvolutions[m.id],
        attendance_status: 'presente',
        mood: participantsData[m.id]?.moodScore ? moodEmojis[(participantsData[m.id]?.moodScore || 5) - 1] : null,
      }));
      if (inserts.length === 0) { setSendingToProntuario(false); return; }
      const { error } = await supabase.from('evolutions').insert(inserts);
      setSendingToProntuario(false);
      if (error) toast.error('Erro ao enviar para prontuário');
      else { toast.success('Evoluções individuais salvas no prontuário do grupo!'); setAiIndividualEvolutions({}); }
    } else {
      if (!aiEvolution) { setSendingToProntuario(false); return; }
      const inserts = members.map(m => ({
        user_id: user.id,
        patient_id: m.id,
        clinic_id: clinicId,
        group_id: groupId,
        date: new Date().toISOString().slice(0, 10),
        text: aiEvolution,
        attendance_status: 'presente',
        mood: participantsData[m.id]?.moodScore ? moodEmojis[(participantsData[m.id]?.moodScore || 5) - 1] : null,
      }));
      const { error } = await supabase.from('evolutions').insert(inserts);
      setSendingToProntuario(false);
      if (error) toast.error('Erro ao enviar para prontuário');
      else { toast.success('Evolução salva no prontuário do grupo!'); setAiEvolution(''); }
    }
  };

  // sendIndividualMemberId state moved to top-level state block

  const sendToIndividualProntuario = async (memberId: string) => {
    if (!user) return;
    setSendingToProntuario(true);
    const pd = participantsData[memberId];
    const text = aiEvoMode === 'individual' ? aiIndividualEvolutions[memberId] : aiEvolution;
    if (!text) { setSendingToProntuario(false); return; }
    const { error } = await supabase.from('evolutions').insert({
      user_id: user.id,
      patient_id: memberId,
      clinic_id: clinicId,
      date: new Date().toISOString().slice(0, 10),
      text,
      attendance_status: 'presente',
      mood: pd?.moodScore ? moodEmojis[(pd.moodScore || 5) - 1] : null,
    });
    setSendingToProntuario(false);
    if (error) toast.error('Erro ao enviar para prontuário individual');
    else {
      const name = members.find(m => m.id === memberId)?.name || 'paciente';
      toast.success(`Evolução salva no prontuário individual de ${name}!`);
    }
  };

  // Download evolutions for a specific member (group or individual)
  const downloadMemberEvolutions = async (memberId: string, type: 'group' | 'individual') => {
    if (!user) return;
    setGeneratingReport(true);
    try {
      let query = supabase
        .from('evolutions')
        .select('*')
        .eq('patient_id', memberId)
        .eq('clinic_id', clinicId)
        .order('date', { ascending: false });

      if (type === 'group') {
        query = query.eq('group_id', groupId);
      } else {
        query = query.is('group_id', null);
      }

      const { data: evos } = await query;
      if (!evos || evos.length === 0) {
        toast.error('Nenhuma evolução encontrada');
        return;
      }

      const memberName = members.find(m => m.id === memberId)?.name || 'Paciente';
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Header
      doc.setFillColor(99, 102, 241);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(type === 'group' ? `Evoluções de Grupo - ${memberName}` : `Evoluções Individuais - ${memberName}`, margin, 22);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(type === 'group' ? `Grupo: ${groupName}` : 'Prontuário Individual', margin, 30);

      y = 45;
      doc.setTextColor(0, 0, 0);

      for (const evo of evos) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(new Date(evo.date).toLocaleDateString('pt-BR'), margin, y);
        y += 6;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(evo.text || '', pageWidth - margin * 2);
        for (const line of lines) {
          if (y > 275) { doc.addPage(); y = 20; }
          doc.text(line, margin, y);
          y += 5.5;
        }
        y += 6;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y - 3, pageWidth - margin, y - 3);
      }

      doc.save(`evolucoes_${type === 'group' ? 'grupo' : 'individual'}_${memberName.replace(/\s+/g, '_')}.pdf`);
      toast.success('PDF gerado!');
    } catch (e: any) {
      toast.error('Erro ao gerar PDF');
    } finally {
      setGeneratingReport(false);
    }
  };

  // ─── Plans CRUD ───
  const savePlan = async () => {
    if (!user || !planTitle.trim()) { toast.error('Preencha o título do plano'); return; }
    const payload = {
      user_id: user.id,
      clinic_id: clinicId,
      patient_id: members[0]?.id || user.id,
      title: planTitle,
      objectives: `[grupo:${groupId}]\n${planObjectives}`,
      activities: planActivities,
      status: 'active',
    };
    if (editingPlanId) {
      await supabase.from('session_plans').update(payload).eq('id', editingPlanId);
    } else {
      await supabase.from('session_plans').insert(payload);
    }
    toast.success('Plano salvo!');
    setPlanTitle(''); setPlanObjectives(''); setPlanActivities('');
    setEditingPlanId(null); setShowPlanForm(false);
    loadPlans();
  };

  const editPlan = (plan: any) => {
    setPlanTitle(plan.title);
    setPlanObjectives((plan.objectives || '').replace(`[grupo:${groupId}]\n`, ''));
    setPlanActivities(plan.activities || '');
    setEditingPlanId(plan.id);
    setShowPlanForm(true);
  };

  const deletePlan = async (planId: string) => {
    await supabase.from('session_plans').delete().eq('id', planId);
    toast.success('Plano excluído');
    loadPlans();
  };

  // ─── History actions ───
  const handleDeleteSession = async (id: string) => {
    await supabase.from('therapy_sessions').delete().eq('id', id);
    toast.success('Sessão excluída');
    loadHistory();
  };

  const handleEditSession = (session: any) => {
    populateSessionForm(session);
    setTimerRunning(false);
    setStartedAt(null);
    setMainView('session');
  };

  const handleRequestDeclaration = (session: any) => {
    const defaultStamp = stamps.find((s: any) => s.is_default) || stamps[0];
    setDeclarationStampId(defaultStamp?.id || null);
    setDeclarationMemberId(null);
    setDeclarationSession(session);
  };

  const generateDeclaration = async () => {
    const session = declarationSession;
    if (!session || !declarationMemberId) return;
    try {
      const member = members.find(m => m.id === declarationMemberId);
      if (!member) return;

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
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); img.src = clinic.letterhead; });
          const imgWidth = 160;
          const imgHeight = (img.height / img.width) * imgWidth;
          doc.addImage(img, 'PNG', (pageWidth - imgWidth) / 2, y, imgWidth, imgHeight);
          y += imgHeight + 10;
        } catch { y = 30; }
      } else { y = 40; }

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
        : (() => { const end = new Date(sessionDate.getTime() + (session.duration_seconds || 0) * 1000); return end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); })();

      const therapistName = profile?.name || 'Profissional';

      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'normal');

      const bodyText = `Declaro, para os devidos fins, que ${member.name} está em atendimento terapêutico de grupo ("${groupName}") sob meus cuidados, e compareceu à sessão realizada no dia ${dateStr} das ${startTime} às ${endTime}.`;
      const bodyLines: string[] = doc.splitTextToSize(bodyText, contentWidth);
      for (let li = 0; li < bodyLines.length; li++) {
        if (y > 260) { doc.addPage(); y = 20; }
        const isLast = li === bodyLines.length - 1;
        doc.text(bodyLines[li], margin, y, { align: isLast ? 'left' : 'justify', maxWidth: contentWidth });
        y += 7;
      }

      y += 20;
      const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      const now = new Date();
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'italic');
      doc.text(`Documento gerado em: ${String(now.getDate()).padStart(2, '0')} de ${months[now.getMonth()]} de ${now.getFullYear()}`, centerX, y, { align: 'center' });

      // Signature block
      const lineWidth = pageWidth * 0.4;
      const signBlockStartY = pageHeight - 70;
      let sy = signBlockStartY;

      if (chosenStamp?.stamp_image) {
        try {
          const sImg = new window.Image();
          sImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => { sImg.onload = () => resolve(); sImg.onerror = () => reject(); sImg.src = chosenStamp.stamp_image; });
          const maxW = 40; const maxH = 25;
          let sW = maxW; let sH = (sImg.height / sImg.width) * sW;
          if (sH > maxH) { sH = maxH; sW = (sImg.width / sImg.height) * sH; }
          doc.addImage(sImg, 'PNG', centerX - sW / 2, sy - sH, sW, sH);
        } catch { /* skip */ }
      }

      doc.setDrawColor(80, 80, 80);
      doc.line(centerX - lineWidth / 2, sy, centerX + lineWidth / 2, sy);
      sy += 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(99, 102, 241);
      doc.text(therapistName, centerX, sy, { align: 'center' });
      sy += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      if (chosenStamp?.clinical_area) { doc.text(chosenStamp.clinical_area, centerX, sy, { align: 'center' }); sy += 5; }
      if (chosenStamp?.cbo) { doc.text(`CBO: ${chosenStamp.cbo}`, centerX, sy, { align: 'center' }); }

      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.text('Documento confidencial — uso exclusivo profissional', centerX, pageHeight - 10, { align: 'center' });

      doc.save(`declaracao_grupo_${member.name.replace(/\s+/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`);
      toast.success('Declaração gerada!');
      setDeclarationSession(null);
      setDeclarationMemberId(null);
    } catch (e: any) {
      toast.error('Erro ao gerar declaração');
    }
  };

  const generateGroupReport = async (session: any) => {
    setGeneratingReport(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = 20;
      const date = new Date(session.created_at);
      const dateStr = date.toLocaleDateString('pt-BR');

      // Header bar — same as individual
      doc.setFillColor(99, 102, 241);
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

      // Group info box
      doc.setFillColor(245, 245, 250);
      doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Grupo Terapêutico', margin + 5, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(groupName, margin + 5, y + 16);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`${members.length} participantes  |  Sessão: ${session.title || 'Sem título'}  |  Duração: ${formatTime(session.duration_seconds || 0)}`, margin + 5, y + 23);
      y += 35;
      doc.setTextColor(50, 50, 50);

      // Participants mood
      const pData = session.participants_data || {};
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Avaliação de Humor por Participante', margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      members.forEach(m => {
        const pd = pData[m.id];
        if (!pd) return;
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        const moodStr = pd.mood_score ? `${pd.mood_score}/10` : '';
        doc.text(`${m.name}  ${moodStr}`, margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        if (pd.positive_feelings?.length) {
          doc.setFont('helvetica', 'bold'); doc.text('Positivos:', margin, y);
          doc.setFont('helvetica', 'normal'); doc.text(pd.positive_feelings.join(', '), margin + 25, y); y += 5;
        }
        if (pd.negative_feelings?.length) {
          doc.setFont('helvetica', 'bold'); doc.text('Negativos:', margin, y);
          doc.setFont('helvetica', 'normal'); doc.text(pd.negative_feelings.join(', '), margin + 25, y); y += 5;
        }
        if (pd.suicidal_thoughts) {
          doc.setFillColor(254, 226, 226);
          doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F');
          doc.setTextColor(185, 28, 28); doc.setFont('helvetica', 'bold');
          doc.text(`ALERTA: Ideacao suicida - ${m.name}`, margin + 3, y + 6);
          doc.setTextColor(50, 50, 50); y += 12;
        }
        y += 3;
      });

      doc.setDrawColor(200, 200, 220);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Markdown renderer
      const renderMarkdownText = (text: string, xPos: number, maxWidth: number) => {
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
          const fullLineText = segments.map(s => s.text).join('');
          if (!fullLineText.trim()) { y += 3; continue; }
          const wrappedLines = doc.splitTextToSize(fullLineText, maxWidth);
          for (let wi = 0; wi < wrappedLines.length; wi++) {
            if (y > 275) { doc.addPage(); y = 20; }
            let curX = xPos; let consumed = 0;
            for (let pi = 0; pi < wi; pi++) consumed += wrappedLines[pi].length;
            const lineStart = consumed; const lineEnd = consumed + wrappedLines[wi].length;
            let charPos = 0; let rendered = false;
            for (const seg of segments) {
              const segStart = charPos; const segEnd = charPos + seg.text.length; charPos = segEnd;
              const os = Math.max(segStart, lineStart); const oe = Math.min(segEnd, lineEnd);
              if (os >= oe) continue;
              const portion = seg.text.slice(os - segStart, oe - segStart);
              if (!portion) continue;
              doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
              doc.text(portion, curX, y); curX += doc.getTextWidth(portion); rendered = true;
            }
            if (!rendered) { doc.setFont('helvetica', 'normal'); doc.text(wrappedLines[wi], xPos, y, { align: 'justify', maxWidth }); }
            y += 5;
          }
        }
      };

      const addSection = (label: string, text: string) => {
        if (!text) return;
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(99, 102, 241);
        doc.text(label, margin, y); y += 6;
        doc.setFontSize(10); doc.setTextColor(60, 60, 60);
        renderMarkdownText(text, margin, contentWidth); y += 6;
      };

      addSection('Anotações da Sessão', session.notes_text || '');
      addSection('Planos de Ação', session.action_plans || '');
      addSection('Planejamento para Próxima Sessão', session.next_session_notes || '');
      addSection('Comentários Gerais', session.general_comments || '');

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
        doc.text('Documento confidencial — uso exclusivo profissional', pageWidth / 2, 295, { align: 'center' });
      }

      doc.save(`relatorio_grupo_${groupName.replace(/\s+/g, '_')}_${dateStr.replace(/\//g, '-')}.pdf`);
      toast.success('Relatório gerado!');
    } catch {
      toast.error('Erro ao gerar relatório');
    } finally {
      setGeneratingReport(false);
    }
  };

  const hasSuicidalAlerts = Object.values(participantsData).some(pd => pd.suicidalThoughts);

  // Filter plans to only show group plans
  const groupPlans = plans.filter(p => p.objectives?.includes(`[grupo:${groupId}]`));

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation — same as individual */}
      <div className="flex items-center gap-1 border-b border-border pb-2">
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
      </div>

      {/* ═══ PLANNING VIEW ═══ */}
      {mainView === 'planning' && (
        showPlanForm ? (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">{editingPlanId ? 'Editar plano' : 'Novo plano de sessão'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Título do plano *</Label>
                <Input value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="Ex: Dinâmica de confiança" />
              </div>
              <div>
                <Label className="text-sm">Objetivos</Label>
                <Textarea value={planObjectives} onChange={e => setPlanObjectives(e.target.value)} placeholder="O que queremos alcançar nesta sessão?" rows={3} />
              </div>
              <div>
                <Label className="text-sm">Atividades planejadas</Label>
                <Textarea value={planActivities} onChange={e => setPlanActivities(e.target.value)} placeholder="Atividades, dinâmicas, exercícios..." rows={3} />
              </div>
              <div className="flex gap-2">
                <Button onClick={savePlan} className="gap-1"><Plus className="w-4 h-4" /> Salvar plano</Button>
                <Button variant="outline" onClick={() => { setShowPlanForm(false); setEditingPlanId(null); setPlanTitle(''); setPlanObjectives(''); setPlanActivities(''); }}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <Button onClick={() => setShowPlanForm(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Novo plano de sessão
            </Button>
            {groupPlans.length === 0 ? (
              <div className="text-center py-12">
                <Target className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhum plano de sessão criado</p>
                <p className="text-xs text-muted-foreground mt-1">Crie um plano para organizar a próxima sessão do grupo</p>
              </div>
            ) : (
              groupPlans.map(plan => (
                <Card key={plan.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{plan.title}</p>
                        {plan.objectives && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {plan.objectives.replace(`[grupo:${groupId}]\n`, '')}
                          </p>
                        )}
                        {plan.activities && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{plan.activities}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <Button variant="default" size="sm" onClick={() => startSessionFromPlan(plan)} className="gap-1">
                          <Play className="w-3.5 h-3.5" /> Iniciar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => editPlan(plan)}>
                          <PenLine className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deletePlan(plan.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )
      )}

      {/* ═══ SESSION VIEW ═══ */}
      {mainView === 'session' && (
        <>
          {/* Active plan reference */}
          {activePlan && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">Plano: {activePlan.title}</span>
                </div>
                {activePlan.objectives && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {activePlan.objectives.replace(`[grupo:${groupId}]\n`, '')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Header Card */}
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground text-base">{groupName}</h2>
                    <p className="text-xs text-muted-foreground">{members.length} participantes</p>
                    {lastSaved && <p className="text-xs text-muted-foreground">Salvo às {lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTimerRunning(false)}><Pause className="w-4 h-4" /></Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTimerRunning(true)}><Play className="w-4 h-4" /></Button>
                  )}
                  {saving && <span className="text-xs text-muted-foreground ml-auto">Salvando...</span>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Title */}
          <Card className="border-border">
            <CardContent className="p-4">
              <Label className="text-xs">Título da sessão</Label>
              <Input placeholder="Ex: Sessão 05 - Dinâmica de grupo" value={title} onChange={e => setTitle(e.target.value)} />
            </CardContent>
          </Card>

          {/* Mood per participant */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Smile className="w-4 h-4 text-primary" /> Humor do grupo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {members.map(m => {
                const pd = participantsData[m.id];
                if (!pd) return null;
                return (
                  <div key={m.id} className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground">Humor {m.name}</Label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {moodEmojis.map((emoji, i) => (
                        <button key={i} type="button" onClick={() => updateParticipant(m.id, { moodScore: pd.moodScore === i + 1 ? null : i + 1 })}
                          className={cn('text-2xl p-1.5 rounded-lg transition-all hover:scale-110', pd.moodScore === i + 1 ? 'bg-primary/15 ring-2 ring-primary scale-110' : 'hover:bg-muted')}
                          title={`${i + 1}/10`}>{emoji}</button>
                      ))}
                      {pd.moodScore !== null && <span className="text-sm font-semibold text-primary ml-2">{pd.moodScore}/10</span>}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Feelings per participant */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Smile className="w-4 h-4 text-primary" /> Sentimentos do grupo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {members.map(m => {
                const pd = participantsData[m.id];
                const nf = newFeelings[m.id];
                if (!pd || !nf) return null;
                return (
                  <div key={m.id} className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
                    <Label className="text-xs font-semibold text-foreground">Sentimentos {m.name}</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs flex items-center gap-1 mb-1.5"><Smile className="w-3 h-3 text-green-500" /> Positivos</Label>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {pd.positiveFeelings.map((f, i) => (
                            <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 gap-1">
                              {f}<X className="w-3 h-3 cursor-pointer" onClick={() => removeFeeling(m.id, 'positive', i)} />
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <Input value={nf.positive} onChange={e => setNewFeelings(prev => ({ ...prev, [m.id]: { ...prev[m.id], positive: e.target.value } }))}
                            onKeyDown={e => e.key === 'Enter' && addFeeling(m.id, 'positive')} placeholder="Adicionar..." className="h-8 text-xs" />
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => addFeeling(m.id, 'positive')}><Plus className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs flex items-center gap-1 mb-1.5"><Frown className="w-3 h-3 text-red-500" /> Negativos</Label>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {pd.negativeFeelings.map((f, i) => (
                            <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400 gap-1">
                              {f}<X className="w-3 h-3 cursor-pointer" onClick={() => removeFeeling(m.id, 'negative', i)} />
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <Input value={nf.negative} onChange={e => setNewFeelings(prev => ({ ...prev, [m.id]: { ...prev[m.id], negative: e.target.value } }))}
                            onKeyDown={e => e.key === 'Enter' && addFeeling(m.id, 'negative')} placeholder="Adicionar..." className="h-8 text-xs" />
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => addFeeling(m.id, 'negative')}><Plus className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                    <div className={cn('flex items-center gap-3 p-3 rounded-lg border transition-colors', pd.suicidalThoughts ? 'border-red-500/50 bg-red-500/5' : 'border-border')}>
                      <Switch checked={pd.suicidalThoughts} onCheckedChange={v => updateParticipant(m.id, { suicidalThoughts: v })}
                        className={pd.suicidalThoughts ? 'data-[state=checked]:bg-red-500' : ''} />
                      <div className="flex items-center gap-2">
                        {pd.suicidalThoughts && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        <Label className={cn('text-sm', pd.suicidalThoughts ? 'text-red-600 dark:text-red-400 font-semibold' : '')}>Pensamentos suicidas</Label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {hasSuicidalAlerts && (
            <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/5 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="text-sm text-destructive font-semibold">
                ⚠ Pensamentos suicidas reportados por: {members.filter(m => participantsData[m.id]?.suicidalThoughts).map(m => m.name).join(', ')}
              </span>
            </div>
          )}

          {/* Notes / Plans / Next Session */}
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
                    <Textarea value={notesText} onChange={e => setNotesText(e.target.value)} placeholder="Observações, insights e pontos importantes da sessão do grupo." className="min-h-[200px] resize-y" />
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={improvingField === 'notes' || !notesText.trim()} onClick={() => improveFieldText('notes', () => notesText, setNotesText)}>
                      {improvingField === 'notes' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Melhorar com IA
                    </Button>
                  </TabsContent>
                  <TabsContent value="plans" className="mt-0 space-y-2">
                    <Textarea value={actionPlans} onChange={e => setActionPlans(e.target.value)} placeholder="Planos de ação definidos para o grupo." className="min-h-[150px] resize-y" />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={creatingField === 'create_action_plans'} onClick={() => createFieldWithAI('create_action_plans', setActionPlans)}>
                        {creatingField === 'create_action_plans' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />} Criar com IA
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={improvingField === 'action_plans' || !actionPlans.trim()} onClick={() => improveFieldText('action_plans', () => actionPlans, setActionPlans)}>
                        {improvingField === 'action_plans' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Melhorar com IA
                      </Button>
                    </div>
                    {actionPlans.trim() && (
                      <div className="pt-2 border-t border-border space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Enviar plano de ação para portal individual:</p>
                        <div className="flex flex-wrap gap-2">
                          {members.map(m => (
                            <Button key={m.id} variant="outline" size="sm" className="gap-1.5 text-xs" disabled={sendingToPortal}
                              onClick={() => { setSendTargetMemberId(m.id); setShowSendModal(true); }}>
                              <Send className="w-3 h-3" /> {m.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="next" className="mt-0 space-y-2">
                    <Textarea value={nextSessionNotes} onChange={e => setNextSessionNotes(e.target.value)} placeholder="Planejamento para a próxima sessão do grupo." className="min-h-[150px] resize-y" />
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={creatingField === 'create_next_session'} onClick={() => createFieldWithAI('create_next_session', setNextSessionNotes)}>
                        {creatingField === 'create_next_session' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />} Criar com IA
                      </Button>
                      {nextSessionNotes.trim() && (
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={improvingField === 'next_session' || !nextSessionNotes.trim()} onClick={() => improveFieldText('next_session', () => nextSessionNotes, setNextSessionNotes)}>
                          {improvingField === 'next_session' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Melhorar com IA
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* General comments */}
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Comentários gerais</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={generalComments} onChange={e => setGeneralComments(e.target.value)} placeholder="Observações sobre a dinâmica do grupo." className="min-h-[100px] resize-y" />
            </CardContent>
          </Card>

          {/* AI Evolution */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Evolução IA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Mode selector */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={aiEvoMode === 'group' ? 'default' : 'outline'}
                  onClick={() => setAiEvoMode('group')}
                  className="gap-1.5 flex-1"
                >
                  <Users className="w-3.5 h-3.5" /> Evolução única (grupo)
                </Button>
                <Button
                  size="sm"
                  variant={aiEvoMode === 'individual' ? 'default' : 'outline'}
                  onClick={() => setAiEvoMode('individual')}
                  className="gap-1.5 flex-1"
                >
                  <PenLine className="w-3.5 h-3.5" /> Evolução por participante
                </Button>
              </div>

              {aiEvoMode === 'group' ? (
                <>
                  <Button onClick={generateAIEvolution} disabled={generatingAI} className="gap-1.5 w-full">
                    {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Gerar evolução IA do grupo
                  </Button>
                  {aiEvolution && (
                    <div className="space-y-3">
                      <Textarea value={aiEvolution} onChange={e => setAiEvolution(e.target.value)} className="min-h-[200px] resize-y text-sm" />
                      
                      <Button onClick={sendToGroupProntuario} disabled={sendingToProntuario} variant="outline" className="gap-1.5 w-full">
                        {sendingToProntuario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                        Enviar para prontuário do grupo
                      </Button>

                      <div className="border border-border rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Enviar para prontuário individual:</p>
                        <div className="flex flex-wrap gap-2">
                          {members.map(m => (
                            <Button key={m.id} variant="outline" size="sm" className="gap-1.5 text-xs" disabled={sendingToProntuario}
                              onClick={() => sendToIndividualProntuario(m.id)}>
                              <Send className="w-3 h-3" /> {m.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Button onClick={generateIndividualEvolutions} disabled={generatingAI} className="gap-1.5 w-full">
                    {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingAI && generatingIndividualFor
                      ? `Gerando para ${members.find(m => m.id === generatingIndividualFor)?.name || '...'}...`
                      : 'Gerar evolução individual para cada participante'}
                  </Button>

                  {Object.keys(aiIndividualEvolutions).length > 0 && (
                    <div className="space-y-4">
                      {members.filter(m => aiIndividualEvolutions[m.id]).map(m => (
                        <div key={m.id} className="border border-border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                {m.name.charAt(0).toUpperCase()}
                              </span>
                              {m.name}
                            </p>
                            <Button
                              variant="outline" size="sm" className="gap-1 text-xs h-7" disabled={sendingToProntuario}
                              onClick={() => sendToIndividualProntuario(m.id)}
                            >
                              <Send className="w-3 h-3" /> Enviar ao prontuário
                            </Button>
                          </div>
                          <Textarea
                            value={aiIndividualEvolutions[m.id]}
                            onChange={e => setAiIndividualEvolutions(prev => ({ ...prev, [m.id]: e.target.value }))}
                            className="min-h-[120px] resize-y text-sm"
                          />
                        </div>
                      ))}

                      <Button onClick={sendToGroupProntuario} disabled={sendingToProntuario} variant="outline" className="gap-1.5 w-full">
                        {sendingToProntuario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                        Enviar todas para prontuário do grupo
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {sessionId && (
            <Button onClick={() => saveSession(true)} disabled={saving} className="w-full gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar sessão
            </Button>
          )}
        </>
      )}

      {/* ═══ HISTORY VIEW ═══ */}
      {mainView === 'history' && (
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma sessão realizada ainda</p>
            </div>
          ) : (
            sessions.map(s => {
              const date = new Date(s.created_at);
              const pData = s.participants_data || {};
              return (
                <Card key={s.id} className="border-border hover:shadow-sm transition-shadow group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{s.title || `Sessão ${date.toLocaleDateString('pt-BR')}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {date.toLocaleDateString('pt-BR')} às {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Duração: {formatTime(s.duration_seconds || 0)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingSession(s)}>
                            <Eye className="w-4 h-4 mr-2" /> Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditSession(s)}>
                            <Pencil className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => generateGroupReport(s)}>
                            <FileText className="w-4 h-4 mr-2" /> Relatório PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRequestDeclaration(s)}>
                            <ScrollText className="w-4 h-4 mr-2" /> Declaração de Comparecimento
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDeleteSessionId(s.id)} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Mood summary */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {members.map(m => {
                        const pd = pData[m.id];
                        if (!pd) return null;
                        return (
                          <Badge key={m.id} variant="outline" className="gap-1 text-xs">
                            {pd.mood_score ? moodEmojis[(pd.mood_score || 5) - 1] : '—'} {m.name}
                          </Badge>
                        );
                      })}
                    </div>

                    {s.notes_text && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{s.notes_text}</p>}
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Download evolutions per member */}
          {sessions.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Download className="w-4 h-4 text-primary" /> Baixar Evoluções por Paciente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-foreground min-w-[120px]">{m.name}</span>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={generatingReport}
                        onClick={() => downloadMemberEvolutions(m.id, 'group')}>
                        {generatingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Grupo
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={generatingReport}
                        onClick={() => downloadMemberEvolutions(m.id, 'individual')}>
                        {generatingReport ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Individual
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══ Session Detail Modal ═══ */}
      {viewingSession && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingSession(null)}>
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{viewingSession.title || 'Sessão de Grupo'}</CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingSession(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(viewingSession.created_at).toLocaleDateString('pt-BR')} · Duração: {formatTime(viewingSession.duration_seconds || 0)}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Per-participant data */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Avaliação por Participante</Label>
                <div className="space-y-3">
                  {members.map(m => {
                    const pd = (viewingSession.participants_data || {})[m.id];
                    if (!pd) return null;
                    return (
                      <div key={m.id} className="bg-muted/30 rounded-lg p-3 space-y-1">
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        {pd.mood_score && <p className="text-sm">{moodEmojis[(pd.mood_score || 5) - 1]} Humor: {pd.mood_score}/10</p>}
                        {pd.positive_feelings?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {pd.positive_feelings.map((f: string, i: number) => (
                              <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 text-xs">{f}</Badge>
                            ))}
                          </div>
                        )}
                        {pd.negative_feelings?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {pd.negative_feelings.map((f: string, i: number) => (
                              <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400 text-xs">{f}</Badge>
                            ))}
                          </div>
                        )}
                        {pd.suicidal_thoughts && (
                          <div className="flex items-center gap-1 text-red-500 text-xs font-semibold">
                            <AlertTriangle className="w-3 h-3" /> Ideação suicida
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {viewingSession.notes_text && <div><Label className="text-xs text-muted-foreground">Anotações</Label><p className="text-sm mt-1 whitespace-pre-wrap">{viewingSession.notes_text}</p></div>}
              {viewingSession.action_plans && <div><Label className="text-xs text-muted-foreground">Planos de Ação</Label><p className="text-sm mt-1 whitespace-pre-wrap">{viewingSession.action_plans}</p></div>}
              {viewingSession.next_session_notes && <div><Label className="text-xs text-muted-foreground">Próxima Sessão</Label><p className="text-sm mt-1 whitespace-pre-wrap">{viewingSession.next_session_notes}</p></div>}
              {viewingSession.general_comments && <div><Label className="text-xs text-muted-foreground">Comentários Gerais</Label><p className="text-sm mt-1 whitespace-pre-wrap">{viewingSession.general_comments}</p></div>}

              <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => generateGroupReport(viewingSession)} disabled={generatingReport} className="gap-1.5">
                  {generatingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Baixar Relatório PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {showSendModal && sendTargetMemberId && (
        <SendActionPlanModal
          open={showSendModal}
          onOpenChange={(open) => { setShowSendModal(open); if (!open) setSendTargetMemberId(null); }}
          actionPlansText={actionPlans}
          onSend={sendActionPlansToPortal}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteSessionId} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sessão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta sessão? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteSessionId) { handleDeleteSession(deleteSessionId); setDeleteSessionId(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Declaration dialog — select member + stamp */}
      {declarationSession && (
        <Dialog open={!!declarationSession} onOpenChange={(open) => { if (!open) { setDeclarationSession(null); setDeclarationMemberId(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ScrollText className="w-4 h-4 text-primary" /> Declaração de Comparecimento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Selecione o participante</Label>
                <Select value={declarationMemberId || ''} onValueChange={setDeclarationMemberId}>
                  <SelectTrigger><SelectValue placeholder="Escolha o participante" /></SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {stamps.length > 0 && (
                <div>
                  <Label className="text-xs">Carimbo / Assinatura</Label>
                  <Select value={declarationStampId || ''} onValueChange={setDeclarationStampId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o carimbo" /></SelectTrigger>
                    <SelectContent>
                      {stamps.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} — {s.clinical_area}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setDeclarationSession(null); setDeclarationMemberId(null); }}>Cancelar</Button>
              <Button onClick={generateDeclaration} disabled={!declarationMemberId} className="gap-1.5">
                <Download className="w-4 h-4" /> Gerar Declaração
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
