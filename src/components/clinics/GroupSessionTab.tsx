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
import { Play, Pause, Square, X, AlertTriangle, Plus, Smile, Frown, PenLine, ListTodo, CalendarPlus, Clock, History, Sparkles, Send, Loader2, Wand2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  // Per-participant feeling inputs
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

  // History
  const [sessions, setSessions] = useState<any[]>([]);
  const [mainView, setMainView] = useState<'session' | 'history'>('session');

  // AI
  const [aiEvolution, setAiEvolution] = useState('');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [sendingToProntuario, setSendingToProntuario] = useState(false);
  const [improvingField, setImprovingField] = useState<string | null>(null);

  // Init participants data when members change
  useEffect(() => {
    const init: Record<string, ParticipantData> = {};
    const initFeelings: Record<string, { positive: string; negative: string }> = {};
    members.forEach(m => {
      init[m.id] = participantsData[m.id] || { moodScore: null, positiveFeelings: [], negativeFeelings: [], suicidalThoughts: false };
      initFeelings[m.id] = newFeelings[m.id] || { positive: '', negative: '' };
    });
    setParticipantsData(init);
    setNewFeelings(initFeelings);
  }, [members.map(m => m.id).join(',')]);

  useEffect(() => {
    if (!user || !groupId) return;
    loadActiveSession();
    loadHistory();
  }, [user, groupId]);

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
    setAiEvolution('');

    // Restore participants_data from JSONB
    if (data.participants_data && typeof data.participants_data === 'object') {
      const restored: Record<string, ParticipantData> = {};
      for (const [pid, pd] of Object.entries(data.participants_data as Record<string, any>)) {
        restored[pid] = {
          moodScore: pd.mood_score ?? null,
          positiveFeelings: pd.positive_feelings || [],
          negativeFeelings: pd.negative_feelings || [],
          suicidalThoughts: pd.suicidal_thoughts || false,
        };
      }
      setParticipantsData(prev => ({ ...prev, ...restored }));
    }

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
      .select('id, title, created_at, duration_seconds, status, notes_text, participants_data, started_at, finished_at')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('status', 'finished')
      .order('created_at', { ascending: false });
    if (data) setSessions(data);
  };

  // Timer
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setElapsedSeconds(prev => prev + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  // Auto-save every 60s
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
    } as any).eq('id', sessionId);
    setSaving(false);
    if (error) {
      if (showToast) toast.error('Erro ao salvar');
    } else {
      setLastSaved(new Date());
      if (showToast) toast.success('Sessão salva!');
    }
  }, [user, sessionId, title, notesText, actionPlans, nextSessionNotes, generalComments, elapsedSeconds, participantsData]);

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
    } as any).eq('id', sessionId);

    if (error) {
      toast.error('Erro ao finalizar sessão');
    } else {
      toast.success('Sessão finalizada e salva com sucesso!');
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
    const init: Record<string, ParticipantData> = {};
    members.forEach(m => {
      init[m.id] = { moodScore: null, positiveFeelings: [], negativeFeelings: [], suicidalThoughts: false };
    });
    setParticipantsData(init);
  };

  const updateParticipant = (pid: string, updates: Partial<ParticipantData>) => {
    setParticipantsData(prev => ({
      ...prev,
      [pid]: { ...prev[pid], ...updates },
    }));
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

  const generateAIEvolution = async () => {
    if (!notesText && !actionPlans && !generalComments) {
      toast.error('Preencha as anotações da sessão antes de gerar a evolução.');
      return;
    }
    setGeneratingAI(true);
    try {
      // Build per-participant summary
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
          planObjectives: '',
          planActivities: '',
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

  const sendToProntuario = async () => {
    if (!user || !aiEvolution) return;
    setSendingToProntuario(true);
    // Send evolution to all members
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
    else { toast.success('Evolução salva no prontuário de todos os participantes!'); setAiEvolution(''); }
  };

  const hasSuicidalAlerts = Object.values(participantsData).some(pd => pd.suicidalThoughts);

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 border-b border-border pb-2">
        <Button variant={mainView === 'session' ? 'default' : 'ghost'} size="sm" onClick={() => setMainView('session')} className="gap-1.5">
          <PenLine className="w-3.5 h-3.5" /> Sessão
          {sessionId && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
        </Button>
        <Button variant={mainView === 'history' ? 'default' : 'ghost'} size="sm" onClick={() => setMainView('history')} className="gap-1.5">
          <History className="w-3.5 h-3.5" /> Realizadas
          {sessions.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">{sessions.length}</Badge>}
        </Button>
      </div>

      {mainView === 'session' && (
        <>
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

          {/* === PER-PARTICIPANT CLINICAL ASSESSMENT === */}
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
                        <button
                          key={i}
                          type="button"
                          onClick={() => updateParticipant(m.id, { moodScore: pd.moodScore === i + 1 ? null : i + 1 })}
                          className={cn(
                            'text-2xl p-1.5 rounded-lg transition-all hover:scale-110',
                            pd.moodScore === i + 1 ? 'bg-primary/15 ring-2 ring-primary scale-110' : 'hover:bg-muted'
                          )}
                          title={`${i + 1}/10`}
                        >
                          {emoji}
                        </button>
                      ))}
                      {pd.moodScore !== null && (
                        <span className="text-sm font-semibold text-primary ml-2">{pd.moodScore}/10</span>
                      )}
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
                      {/* Positive */}
                      <div>
                        <Label className="text-xs flex items-center gap-1 mb-1.5">
                          <Smile className="w-3 h-3 text-green-500" /> Sentimentos Positivos
                        </Label>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {pd.positiveFeelings.map((f, i) => (
                            <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 gap-1">
                              {f}<X className="w-3 h-3 cursor-pointer" onClick={() => removeFeeling(m.id, 'positive', i)} />
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <Input
                            value={nf.positive}
                            onChange={e => setNewFeelings(prev => ({ ...prev, [m.id]: { ...prev[m.id], positive: e.target.value } }))}
                            onKeyDown={e => e.key === 'Enter' && addFeeling(m.id, 'positive')}
                            placeholder="Adicionar..."
                            className="h-8 text-xs"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => addFeeling(m.id, 'positive')}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      {/* Negative */}
                      <div>
                        <Label className="text-xs flex items-center gap-1 mb-1.5">
                          <Frown className="w-3 h-3 text-red-500" /> Sentimentos Negativos
                        </Label>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {pd.negativeFeelings.map((f, i) => (
                            <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400 gap-1">
                              {f}<X className="w-3 h-3 cursor-pointer" onClick={() => removeFeeling(m.id, 'negative', i)} />
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <Input
                            value={nf.negative}
                            onChange={e => setNewFeelings(prev => ({ ...prev, [m.id]: { ...prev[m.id], negative: e.target.value } }))}
                            onKeyDown={e => e.key === 'Enter' && addFeeling(m.id, 'negative')}
                            placeholder="Adicionar..."
                            className="h-8 text-xs"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => addFeeling(m.id, 'negative')}>
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Suicidal toggle per participant */}
                    <div className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      pd.suicidalThoughts ? 'border-red-500/50 bg-red-500/5' : 'border-border'
                    )}>
                      <Switch
                        checked={pd.suicidalThoughts}
                        onCheckedChange={v => updateParticipant(m.id, { suicidalThoughts: v })}
                        className={pd.suicidalThoughts ? 'data-[state=checked]:bg-red-500' : ''}
                      />
                      <div className="flex items-center gap-2">
                        {pd.suicidalThoughts && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        <Label className={cn('text-sm', pd.suicidalThoughts ? 'text-red-600 dark:text-red-400 font-semibold' : '')}>
                          Pensamentos suicidas
                        </Label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Global alert banner */}
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
                    <Textarea value={notesText} onChange={e => setNotesText(e.target.value)} placeholder="Registre observações, insights e pontos importantes da sessão do grupo." className="min-h-[200px] resize-y" />
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={improvingField === 'notes' || !notesText.trim()} onClick={() => improveFieldText('notes', () => notesText, setNotesText)}>
                      {improvingField === 'notes' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Melhorar com IA
                    </Button>
                  </TabsContent>
                  <TabsContent value="plans" className="mt-0 space-y-2">
                    <Textarea value={actionPlans} onChange={e => setActionPlans(e.target.value)} placeholder="Planos de ação definidos para o grupo." className="min-h-[150px] resize-y" />
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" disabled={improvingField === 'action_plans' || !actionPlans.trim()} onClick={() => improveFieldText('action_plans', () => actionPlans, setActionPlans)}>
                      {improvingField === 'action_plans' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Melhorar com IA
                    </Button>
                  </TabsContent>
                  <TabsContent value="next" className="mt-0 space-y-2">
                    <Textarea value={nextSessionNotes} onChange={e => setNextSessionNotes(e.target.value)} placeholder="Planejamento para a próxima sessão do grupo." className="min-h-[150px] resize-y" />
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          {/* General comments */}
          <Card className="border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Comentários gerais</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={generalComments} onChange={e => setGeneralComments(e.target.value)} placeholder="Observações adicionais sobre a dinâmica do grupo." className="min-h-[100px] resize-y" />
            </CardContent>
          </Card>

          {/* AI Evolution */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Evolução IA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={generateAIEvolution} disabled={generatingAI} className="gap-1.5 w-full">
                {generatingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar evolução IA do grupo
              </Button>
              {aiEvolution && (
                <div className="space-y-3">
                  <Textarea value={aiEvolution} onChange={e => setAiEvolution(e.target.value)} className="min-h-[200px] resize-y text-sm" />
                  <Button onClick={sendToProntuario} disabled={sendingToProntuario} variant="outline" className="gap-1.5 w-full">
                    {sendingToProntuario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Salvar no prontuário de todos os participantes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save button */}
          {sessionId && (
            <Button onClick={() => saveSession(true)} disabled={saving} className="w-full gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar sessão
            </Button>
          )}
        </>
      )}

      {/* History View */}
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
                <Card key={s.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground text-sm">{s.title || `Sessão ${date.toLocaleDateString('pt-BR')}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {date.toLocaleDateString('pt-BR')} · Duração: {formatTime(s.duration_seconds || 0)}
                        </p>
                      </div>
                    </div>
                    {/* Summary of moods */}
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
        </div>
      )}
    </div>
  );
}
