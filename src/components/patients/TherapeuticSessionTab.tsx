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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { toast } from 'sonner';
import { Play, Pause, Square, X, AlertTriangle, Plus, FileText, Smile, Frown, PenLine, ListTodo, CalendarPlus, MessageSquare, Upload, Clock, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import { SessionHistory } from './SessionHistory';

interface TherapeuticSessionTabProps {
  patientId: string;
  patientName: string;
  patientAvatar?: string | null;
  clinicId: string;
  paymentValue?: number;
}

export function TherapeuticSessionTab({ patientId, patientName, patientAvatar, clinicId, paymentValue }: TherapeuticSessionTabProps) {
  const { user } = useAuth();

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState(paymentValue?.toString() || '0');
  const [paymentPending, setPaymentPending] = useState(false);
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

  // Session history
  const [sessions, setSessions] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'session' | 'history'>('session');
  const [viewingSession, setViewingSession] = useState<any | null>(null);

  // Load active session or history
  useEffect(() => {
    if (!user || !patientId) return;
    loadActiveSession();
    loadHistory();
  }, [user, patientId]);

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
      setSessionId(data.id);
      setTitle(data.title || '');
      setPrice(data.price?.toString() || '0');
      setPaymentPending(data.payment_pending);
      setMoodScore(data.mood_score);
      setPositiveFeelings(data.positive_feelings || []);
      setNegativeFeelings(data.negative_feelings || []);
      setSuicidalThoughts(data.suicidal_thoughts);
      setNotesText(data.notes_text || '');
      setActionPlans(data.action_plans || '');
      setNextSessionNotes(data.next_session_notes || '');
      setGeneralComments(data.general_comments || '');
      setElapsedSeconds(data.duration_seconds || 0);
      if (data.started_at && !data.finished_at) {
        const start = new Date(data.started_at);
        setStartedAt(start);
        const diff = Math.floor((Date.now() - start.getTime()) / 1000);
        setElapsedSeconds(diff);
        setTimerRunning(true);
      }
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('therapy_sessions')
      .select('id, title, created_at, duration_seconds, status, mood_score, notes_text, action_plans, next_session_notes, general_comments, positive_feelings, negative_feelings, suicidal_thoughts, price, payment_pending, started_at')
      .eq('patient_id', patientId)
      .eq('user_id', user.id)
      .eq('status', 'finished')
      .order('created_at', { ascending: false });
    if (data) setSessions(data);
  };

  // Timer logic
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  // Auto-save every 60 seconds
  useEffect(() => {
    if (!sessionId) return;
    autoSaveRef.current = setTimeout(() => {
      saveSession(false);
    }, 60000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [notesText, actionPlans, nextSessionNotes, generalComments, title, price, paymentPending, moodScore, positiveFeelings, negativeFeelings, suicidalThoughts, sessionId]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
        price: parseFloat(price) || 0,
        payment_pending: paymentPending,
        started_at: now.toISOString(),
        status: 'active',
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
      price: parseFloat(price) || 0,
      payment_pending: paymentPending,
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
  }, [user, sessionId, title, price, paymentPending, moodScore, positiveFeelings, negativeFeelings, suicidalThoughts, notesText, actionPlans, nextSessionNotes, generalComments, elapsedSeconds]);

  const finishSession = async () => {
    if (!user || !sessionId) return;
    setTimerRunning(false);
    const { error } = await supabase.from('therapy_sessions').update({
      title,
      price: parseFloat(price) || 0,
      payment_pending: paymentPending,
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
      toast.success('Sessão finalizada!');
      setSessionId(null);
      resetForm();
      loadHistory();
    }
  };

  const exitSession = () => {
    if (sessionId) saveSession(false);
    setTimerRunning(false);
    setSessionId(null);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setPrice(paymentValue?.toString() || '0');
    setPaymentPending(false);
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

  const generateReport = () => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text(`Relatório da Sessão`, 20, y); y += 10;
    doc.setFontSize(11);
    doc.text(`Paciente: ${patientName}`, 20, y); y += 7;
    doc.text(`Título: ${title || 'Sem título'}`, 20, y); y += 7;
    doc.text(`Duração: ${formatTime(elapsedSeconds)}`, 20, y); y += 7;
    doc.text(`Valor: R$ ${price}`, 20, y); y += 7;
    doc.text(`Pagamento pendente: ${paymentPending ? 'Sim' : 'Não'}`, 20, y); y += 10;

    if (moodScore !== null) {
      doc.text(`Humor: ${moodScore}/10`, 20, y); y += 7;
    }
    if (positiveFeelings.length > 0) {
      doc.text(`Sentimentos positivos: ${positiveFeelings.join(', ')}`, 20, y); y += 7;
    }
    if (negativeFeelings.length > 0) {
      doc.text(`Sentimentos negativos: ${negativeFeelings.join(', ')}`, 20, y); y += 7;
    }
    if (suicidalThoughts) {
      doc.setTextColor(220, 38, 38);
      doc.text('⚠ ALERTA: Pensamentos suicidas reportados', 20, y); y += 7;
      doc.setTextColor(0, 0, 0);
    }
    y += 5;

    if (notesText) {
      doc.setFontSize(13);
      doc.text('Anotações:', 20, y); y += 7;
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(notesText, 170);
      doc.text(lines, 20, y); y += lines.length * 5 + 5;
    }
    if (actionPlans) {
      doc.setFontSize(13);
      doc.text('Planos de Ação:', 20, y); y += 7;
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(actionPlans, 170);
      doc.text(lines, 20, y); y += lines.length * 5 + 5;
    }
    if (nextSessionNotes) {
      doc.setFontSize(13);
      doc.text('Próxima Sessão:', 20, y); y += 7;
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(nextSessionNotes, 170);
      doc.text(lines, 20, y); y += lines.length * 5 + 5;
    }
    if (generalComments) {
      doc.setFontSize(13);
      doc.text('Comentários Gerais:', 20, y); y += 7;
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(generalComments, 170);
      doc.text(lines, 20, y);
    }

    doc.save(`sessao_${patientName.replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Relatório gerado!');
  };

  const handleDeleteSession = async (sessionId: string) => {
    const { error } = await supabase.from('therapy_sessions').delete().eq('id', sessionId);
    if (error) {
      toast.error('Erro ao excluir sessão');
    } else {
      toast.success('Sessão excluída');
      loadHistory();
    }
  };

  const handleDuplicateSession = async (session: any) => {
    if (!user) return;
    const { data, error } = await supabase.from('therapy_sessions').insert({
      user_id: user.id,
      patient_id: patientId,
      clinic_id: clinicId,
      title: `${session.title || 'Sessão'} (cópia)`,
      notes_text: session.notes_text || '',
      action_plans: session.action_plans || '',
      next_session_notes: session.next_session_notes || '',
      general_comments: session.general_comments || '',
      positive_feelings: session.positive_feelings || [],
      negative_feelings: session.negative_feelings || [],
      mood_score: session.mood_score,
      suicidal_thoughts: session.suicidal_thoughts || false,
      price: session.price || 0,
      payment_pending: false,
      status: 'active',
      duration_seconds: 0,
    }).select('id').single();

    if (error) {
      toast.error('Erro ao duplicar sessão');
    } else if (data) {
      toast.success('Sessão duplicada! Abrindo para edição...');
      // Load the duplicated session as active
      setSessionId(data.id);
      setTitle(`${session.title || 'Sessão'} (cópia)`);
      setNotesText(session.notes_text || '');
      setActionPlans(session.action_plans || '');
      setNextSessionNotes(session.next_session_notes || '');
      setGeneralComments(session.general_comments || '');
      setPositiveFeelings(session.positive_feelings || []);
      setNegativeFeelings(session.negative_feelings || []);
      setMoodScore(session.mood_score);
      setSuicidalThoughts(session.suicidal_thoughts || false);
      setElapsedSeconds(0);
      setViewMode('session');
    }
  };

  const handleViewSession = (session: any) => {
    setViewingSession(session);
  };

  const handleEditSession = (session: any) => {
    // Load session data into form
    setSessionId(session.id);
    setTitle(session.title || '');
    setNotesText(session.notes_text || '');
    setActionPlans(session.action_plans || '');
    setNextSessionNotes(session.next_session_notes || '');
    setGeneralComments(session.general_comments || '');
    setPositiveFeelings(session.positive_feelings || []);
    setNegativeFeelings(session.negative_feelings || []);
    setMoodScore(session.mood_score);
    setSuicidalThoughts(session.suicidal_thoughts || false);
    setElapsedSeconds(session.duration_seconds || 0);
    setPrice(session.price?.toString() || '0');
    setPaymentPending(session.payment_pending || false);
    setViewMode('session');
  };

  const moodEmojis = ['😭', '😢', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'];

  // View session detail dialog
  const renderViewDialog = () => {
    if (!viewingSession) return null;
    const s = viewingSession;
    const date = new Date(s.created_at);
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingSession(null)}>
        <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{s.title || `Sessão ${date.toLocaleDateString('pt-BR')}`}</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingSession(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {date.toLocaleDateString('pt-BR')} às {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · Duração: {formatTime(s.duration_seconds || 0)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {s.mood_score && (
              <div>
                <Label className="text-xs text-muted-foreground">Humor</Label>
                <p className="text-lg">{moodEmojis[s.mood_score - 1]} {s.mood_score}/10</p>
              </div>
            )}
            {s.positive_feelings?.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Sentimentos Positivos</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.positive_feelings.map((f: string, i: number) => (
                    <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">{f}</Badge>
                  ))}
                </div>
              </div>
            )}
            {s.negative_feelings?.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Sentimentos Negativos</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.negative_feelings.map((f: string, i: number) => (
                    <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400">{f}</Badge>
                  ))}
                </div>
              </div>
            )}
            {s.suicidal_thoughts && (
              <div className="p-3 rounded-lg border border-red-500/50 bg-red-500/5 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400 font-semibold">Pensamentos suicidas reportados</span>
              </div>
            )}
            {s.notes_text && (
              <div>
                <Label className="text-xs text-muted-foreground">Anotações</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{s.notes_text}</p>
              </div>
            )}
            {s.action_plans && (
              <div>
                <Label className="text-xs text-muted-foreground">Planos de Ação</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{s.action_plans}</p>
              </div>
            )}
            {s.next_session_notes && (
              <div>
                <Label className="text-xs text-muted-foreground">Próxima Sessão</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{s.next_session_notes}</p>
              </div>
            )}
            {s.general_comments && (
              <div>
                <Label className="text-xs text-muted-foreground">Comentários Gerais</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{s.general_comments}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toggle between session and history */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Button
          variant={viewMode === 'session' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('session')}
          className="gap-1.5"
        >
          <PenLine className="w-3.5 h-3.5" /> Sessão
        </Button>
        <Button
          variant={viewMode === 'history' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('history')}
          className="gap-1.5"
        >
          <History className="w-3.5 h-3.5" /> Histórico
          {sessions.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px] h-5 px-1.5">{sessions.length}</Badge>
          )}
        </Button>
      </div>

      {viewMode === 'history' ? (
        <>
          <SessionHistory
            sessions={sessions}
            onView={handleViewSession}
            onEdit={handleEditSession}
            onDelete={handleDeleteSession}
            onDuplicate={handleDuplicateSession}
            onNewSession={() => { resetForm(); setViewMode('session'); }}
            onGenerateReport={generateReport}
          />
          {renderViewDialog()}
        </>
      ) : (
        <>
      {/* Header */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                {patientAvatar && <AvatarImage src={patientAvatar} />}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {patientName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-foreground text-base">{patientName}</h2>
                {lastSaved && (
                  <p className="text-xs text-muted-foreground">
                    Salvo às {lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sessionId && (
                <Button variant="outline" size="sm" onClick={exitSession}>
                  Sair da sessão
                </Button>
              )}
              {!sessionId ? (
                <Button size="sm" onClick={startSession} className="gap-1.5">
                  <Play className="w-3.5 h-3.5" /> Iniciar sessão
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={finishSession}
                  className="gap-1.5"
                >
                  <Square className="w-3.5 h-3.5" />
                  Finalizar {formatTime(elapsedSeconds)}
                </Button>
              )}
            </div>
          </div>

          {/* Timer controls */}
          {sessionId && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-lg font-semibold text-foreground">{formatTime(elapsedSeconds)}</span>
              {timerRunning ? (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={pauseTimer}>
                  <Pause className="w-4 h-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resumeTimer}>
                  <Play className="w-4 h-4" />
                </Button>
              )}
              {saving && <span className="text-xs text-muted-foreground ml-auto">Salvando...</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata & Financial */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Dados da Sessão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Título da sessão</Label>
            <Input
              placeholder="Ex: Sessão 05 - Ansiedade no trabalho"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Preço (R$)</Label>
              <Input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={paymentPending} onCheckedChange={setPaymentPending} />
              <Label className="text-xs">Pagamento pendente</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Assessment */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Smile className="w-4 h-4 text-primary" /> Avaliação Clínica Rápida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mood scale */}
          <div>
            <Label className="text-xs mb-2 block">Humor do paciente</Label>
            <div className="flex items-center gap-1 flex-wrap">
              {moodEmojis.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => setMoodScore(i + 1)}
                  className={cn(
                    'text-2xl p-1.5 rounded-lg transition-all hover:scale-110',
                    moodScore === i + 1
                      ? 'bg-primary/15 ring-2 ring-primary scale-110'
                      : 'hover:bg-muted'
                  )}
                  title={`${i + 1}/10`}
                >
                  {emoji}
                </button>
              ))}
              {moodScore !== null && (
                <span className="text-sm font-semibold text-primary ml-2">{moodScore}/10</span>
              )}
            </div>
          </div>

          {/* Feelings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs flex items-center gap-1 mb-1.5">
                <Smile className="w-3 h-3 text-green-500" /> Sentimentos Positivos
              </Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {positiveFeelings.map((f, i) => (
                  <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 gap-1">
                    {f}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => removeFeeling('positive', i)} />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={newPositive}
                  onChange={e => setNewPositive(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addFeeling('positive')}
                  placeholder="Adicionar..."
                  className="h-8 text-xs"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => addFeeling('positive')}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1 mb-1.5">
                <Frown className="w-3 h-3 text-red-500" /> Sentimentos Negativos
              </Label>
              <div className="flex flex-wrap gap-1 mb-2">
                {negativeFeelings.map((f, i) => (
                  <Badge key={i} variant="secondary" className="bg-red-500/10 text-red-700 dark:text-red-400 gap-1">
                    {f}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => removeFeeling('negative', i)} />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  value={newNegative}
                  onChange={e => setNewNegative(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addFeeling('negative')}
                  placeholder="Adicionar..."
                  className="h-8 text-xs"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => addFeeling('negative')}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Suicidal thoughts alert */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg border transition-colors',
            suicidalThoughts ? 'border-red-500/50 bg-red-500/5' : 'border-border'
          )}>
            <Switch
              checked={suicidalThoughts}
              onCheckedChange={setSuicidalThoughts}
              className={suicidalThoughts ? 'data-[state=checked]:bg-red-500' : ''}
            />
            <div className="flex items-center gap-2">
              {suicidalThoughts && <AlertTriangle className="w-4 h-4 text-red-500" />}
              <Label className={cn('text-sm', suicidalThoughts ? 'text-red-600 dark:text-red-400 font-semibold' : '')}>
                Pensamentos suicidas
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Notes Area - Tabs */}
      <Card className="border-border">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-muted/50 rounded-none border-b border-border h-auto p-0">
              {[
                { value: 'notes', icon: PenLine, label: 'Anotações' },
                { value: 'plans', icon: ListTodo, label: 'Planos de Ação' },
                { value: 'next', icon: CalendarPlus, label: 'Próxima Sessão' },
              ].map(({ value, icon: Icon, label }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex-1 rounded-none border-b-2 border-transparent py-3 text-xs sm:text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none gap-1.5"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="p-4">
              <TabsContent value="notes" className="mt-0">
                <Textarea
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                  placeholder="Registre observações, insights e pontos importantes da sessão atual."
                  className="min-h-[200px] resize-y"
                />
              </TabsContent>
              <TabsContent value="plans" className="mt-0">
                <Textarea
                  value={actionPlans}
                  onChange={e => setActionPlans(e.target.value)}
                  placeholder="Liste tarefas, exercícios ou atividades para o paciente fazer em casa."
                  className="min-h-[200px] resize-y"
                />
              </TabsContent>
              <TabsContent value="next" className="mt-0">
                <Textarea
                  value={nextSessionNotes}
                  onChange={e => setNextSessionNotes(e.target.value)}
                  placeholder="O que trabalhar na próxima sessão? Planejamento e temas pendentes."
                  className="min-h-[200px] resize-y"
                />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* General Comments */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Comentários Gerais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={generalComments}
            onChange={e => setGeneralComments(e.target.value)}
            placeholder="Use este espaço para anotar lembretes, dicas, revisões das anotações, etc."
            className="min-h-[80px] resize-y"
          />
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" /> Arquivos da Sessão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FileUpload
            existingFiles={attachedFiles}
            onUpload={(files) => setAttachedFiles(prev => [...prev, ...files])}
            onRemove={(fileId) => setAttachedFiles(prev => prev.filter(f => f.id !== fileId))}
            parentId={sessionId || 'temp'}
            parentType="therapy_session"
            multiple
          />
          <p className="text-xs text-muted-foreground mt-2">
            Envie qualquer tipo de arquivo (máx 20MB por arquivo).
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {sessionId && (
          <Button variant="outline" onClick={() => saveSession(true)} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar sessão'}
          </Button>
        )}
        <Button variant="outline" onClick={generateReport} className="gap-1.5">
          <FileText className="w-4 h-4" /> Gerar Relatório da Sessão
        </Button>
      </div>
      </>
      )}
    </div>
  );
}
