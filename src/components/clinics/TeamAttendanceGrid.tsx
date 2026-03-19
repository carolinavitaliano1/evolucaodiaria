import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle, Calendar, Paperclip, X, FileText, ExternalLink } from 'lucide-react';
import { format, startOfWeek, addDays, subWeeks, addWeeks, isToday, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  user_id: string | null;
  email: string;
  role_label: string | null;
  role: string;
  status: string;
  profile?: { name: string | null; avatar_url: string | null };
}

interface AttendanceRecord {
  id: string;
  member_id: string;
  date: string;
  status: 'present' | 'absent' | 'justified';
  justification: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
}

interface TeamAttendanceGridProps {
  organizationId: string;
  members: TeamMember[];
  canManage: boolean;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const STATUS_CONFIG = {
  present:   { label: 'Presente',   icon: CheckCircle2, color: 'text-success',    bg: 'bg-success/10 border-success/30' },
  absent:    { label: 'Falta',      icon: XCircle,      color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30' },
  justified: { label: 'Justificada', icon: AlertCircle,  color: 'text-warning',    bg: 'bg-warning/10 border-warning/30' },
};

function getInitials(member: TeamMember): string {
  const name = member.profile?.name;
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() || '?';
  }
  return member.email[0]?.toUpperCase() || '?';
}

export function TeamAttendanceGrid({ organizationId, members, canManage }: TeamAttendanceGridProps) {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Dialog for absence justification
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMember, setDialogMember] = useState<TeamMember | null>(null);
  const [dialogDate, setDialogDate] = useState('');
  const [dialogStatus, setDialogStatus] = useState<'absent' | 'justified'>('absent');
  const [dialogJustification, setDialogJustification] = useState('');
  const [dialogSaving, setDialogSaving] = useState(false);

  // Attachment state
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
  const [existingAttachmentName, setExistingAttachmentName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const activeMembers = members.filter(m => m.status === 'active');

  const loadAttendance = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
    const memberIds = activeMembers.map(m => m.id);
    if (!memberIds.length) { setLoading(false); return; }

    const { data } = await supabase
      .from('team_attendance')
      .select('id, member_id, date, status, justification, attachment_url, attachment_name')
      .eq('organization_id', organizationId)
      .in('member_id', memberIds)
      .gte('date', startStr)
      .lte('date', endStr);

    setAttendance((data || []) as AttendanceRecord[]);
    setLoading(false);
  }, [organizationId, weekStart, members]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  function getRecord(memberId: string, dateStr: string): AttendanceRecord | undefined {
    return attendance.find(a => a.member_id === memberId && a.date === dateStr);
  }

  async function markPresent(member: TeamMember, dateStr: string) {
    if (!canManage) return;
    const key = `${member.id}::${dateStr}`;
    setSavingKey(key);
    const existing = getRecord(member.id, dateStr);
    if (existing) {
      if (existing.status === 'present') {
        // Toggle off (remove)
        const { error } = await supabase.from('team_attendance').delete().eq('id', existing.id);
        if (!error) setAttendance(prev => prev.filter(a => a.id !== existing.id));
      } else {
        const { error } = await supabase.from('team_attendance').update({ status: 'present', justification: null }).eq('id', existing.id);
        if (!error) setAttendance(prev => prev.map(a => a.id === existing.id ? { ...a, status: 'present', justification: null } : a));
      }
    } else {
      const { data, error } = await supabase.from('team_attendance').insert({
        organization_id: organizationId,
        member_id: member.id,
        date: dateStr,
        status: 'present',
        created_by: user!.id,
      }).select().single();
      if (!error && data) setAttendance(prev => [...prev, data as AttendanceRecord]);
    }
    setSavingKey(null);
  }

  function openAbsenceDialog(member: TeamMember, dateStr: string, type: 'absent' | 'justified') {
    if (!canManage) return;
    const existing = getRecord(member.id, dateStr);
    setDialogMember(member);
    setDialogDate(dateStr);
    setDialogStatus(type);
    setDialogJustification(existing?.justification || '');
    setDialogOpen(true);
  }

  async function saveAbsence() {
    if (!dialogMember) return;
    setDialogSaving(true);
    const existing = getRecord(dialogMember.id, dialogDate);
    if (existing) {
      const { error } = await supabase.from('team_attendance')
        .update({ status: dialogStatus, justification: dialogJustification || null })
        .eq('id', existing.id);
      if (!error) {
        setAttendance(prev => prev.map(a => a.id === existing.id
          ? { ...a, status: dialogStatus, justification: dialogJustification || null }
          : a));
        toast.success('Falta registrada');
        setDialogOpen(false);
      } else {
        toast.error('Erro ao salvar');
      }
    } else {
      const { data, error } = await supabase.from('team_attendance').insert({
        organization_id: organizationId,
        member_id: dialogMember.id,
        date: dialogDate,
        status: dialogStatus,
        justification: dialogJustification || null,
        created_by: user!.id,
      }).select().single();
      if (!error && data) {
        setAttendance(prev => [...prev, data as AttendanceRecord]);
        toast.success('Falta registrada');
        setDialogOpen(false);
      } else {
        toast.error('Erro ao salvar');
      }
    }
    setDialogSaving(false);
  }

  async function removeRecord(member: TeamMember, dateStr: string) {
    if (!canManage) return;
    const existing = getRecord(member.id, dateStr);
    if (!existing) return;
    const { error } = await supabase.from('team_attendance').delete().eq('id', existing.id);
    if (!error) {
      setAttendance(prev => prev.filter(a => a.id !== existing.id));
      toast.success('Registro removido');
    }
  }

  if (activeMembers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhum membro ativo para registrar presença.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(w => subWeeks(w, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-sm font-medium text-foreground">
          {format(weekStart, "d 'de' MMM", { locale: ptBR })} – {format(addDays(weekStart, 6), "d 'de' MMM yyyy", { locale: ptBR })}
        </div>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1">
            <cfg.icon className={cn('w-3.5 h-3.5', cfg.color)} />
            {cfg.label}
          </span>
        ))}
        {canManage && <span className="text-muted-foreground/60">· Clique nas células para registrar</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium text-foreground min-w-[160px]">Profissional</th>
                {weekDays.map((d, i) => (
                  <th key={i} className={cn(
                    "text-center px-2 py-2.5 font-medium min-w-[80px]",
                    isToday(d) ? 'text-primary' : 'text-foreground'
                  )}>
                    <div>{WEEKDAYS[d.getDay()]}</div>
                    <div className={cn(
                      "text-xs font-normal",
                      isToday(d) ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {format(d, 'd/MM')}
                    </div>
                  </th>
                ))}
                <th className="text-center px-3 py-2.5 font-medium text-foreground min-w-[70px]">Faltas</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map((member, mi) => {
                const memberAbsences = attendance.filter(a =>
                  a.member_id === member.id &&
                  (a.status === 'absent' || a.status === 'justified')
                );
                return (
                  <tr key={member.id} className={cn("border-t border-border", mi % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                    {/* Member info */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 overflow-hidden">
                          {member.profile?.avatar_url
                            ? <img src={member.profile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                            : getInitials(member)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate text-xs">{member.profile?.name || member.email}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{member.role_label || member.role}</p>
                        </div>
                      </div>
                    </td>

                    {/* Day cells */}
                    {weekDays.map((d, di) => {
                      const dateStr = format(d, 'yyyy-MM-dd');
                      const record = getRecord(member.id, dateStr);
                      const isFutureDay = isFuture(addDays(d, 1)) && !isToday(d);
                      const key = `${member.id}::${dateStr}`;
                      const cfg = record ? STATUS_CONFIG[record.status] : null;

                      return (
                        <td key={di} className="text-center px-2 py-2">
                          {isFutureDay ? (
                            <div className="w-8 h-8 mx-auto rounded-full bg-muted/30 flex items-center justify-center">
                              <span className="text-muted-foreground/30 text-xs">–</span>
                            </div>
                          ) : (
                            <div className="relative group">
                              {savingKey === key ? (
                                <div className="w-8 h-8 mx-auto flex items-center justify-center">
                                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </div>
                              ) : record ? (
                                <div className="relative">
                                  <div
                                    title={record.justification || cfg?.label}
                                    className={cn(
                                      "w-8 h-8 mx-auto rounded-full border flex items-center justify-center",
                                      cfg?.bg,
                                      canManage && 'cursor-pointer hover:opacity-80'
                                    )}
                                    onClick={() => canManage && removeRecord(member, dateStr)}
                                  >
                                    {cfg && <cfg.icon className={cn('w-4 h-4', cfg.color)} />}
                                  </div>
                                  {record.justification && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 bg-popover border border-border rounded-lg px-2 py-1 text-xs text-foreground whitespace-nowrap shadow-md max-w-[200px] text-left">
                                      {record.justification}
                                    </div>
                                  )}
                                </div>
                              ) : canManage ? (
                                <div className="flex items-center justify-center gap-1">
                                  {/* Quick actions on hover */}
                                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                    <button
                                      title="Presente"
                                      onClick={() => markPresent(member, dateStr)}
                                      className="w-6 h-6 rounded-full bg-success/10 hover:bg-success/30 flex items-center justify-center transition-colors"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                                    </button>
                                    <button
                                      title="Falta"
                                      onClick={() => openAbsenceDialog(member, dateStr, 'absent')}
                                      className="w-6 h-6 rounded-full bg-destructive/10 hover:bg-destructive/30 flex items-center justify-center transition-colors"
                                    >
                                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                                    </button>
                                    <button
                                      title="Justificada"
                                      onClick={() => openAbsenceDialog(member, dateStr, 'justified')}
                                      className="w-6 h-6 rounded-full bg-warning/10 hover:bg-warning/30 flex items-center justify-center transition-colors"
                                    >
                                      <AlertCircle className="w-3.5 h-3.5 text-warning" />
                                    </button>
                                  </div>
                                  <div className="group-hover:hidden w-8 h-8 rounded-full border border-dashed border-border/50 flex items-center justify-center">
                                    <span className="text-muted-foreground/40 text-xs">·</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-8 h-8 mx-auto rounded-full border border-dashed border-border/40" />
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Absence count */}
                    <td className="text-center px-3 py-2.5">
                      {memberAbsences.length > 0 ? (
                        <Badge variant="outline" className="text-xs border-destructive/40 text-destructive bg-destructive/5">
                          {memberAbsences.length}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Absence dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogStatus === 'absent'
                ? <XCircle className="w-5 h-5 text-destructive" />
                : <AlertCircle className="w-5 h-5 text-warning" />}
              {dialogStatus === 'absent' ? 'Registrar Falta' : 'Falta Justificada'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {dialogMember && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium text-foreground">{dialogMember.profile?.name || dialogMember.email}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {dialogDate ? format(new Date(dialogDate + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR }) : ''}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setDialogStatus('absent')}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  dialogStatus === 'absent'
                    ? 'bg-destructive/10 border-destructive/40 text-destructive'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                <XCircle className="w-4 h-4" /> Falta
              </button>
              <button
                onClick={() => setDialogStatus('justified')}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  dialogStatus === 'justified'
                    ? 'bg-warning/10 border-warning/40 text-warning'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                <AlertCircle className="w-4 h-4" /> Justificada
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Justificativa {dialogStatus === 'absent' ? '(opcional)' : '(recomendado)'}
              </label>
              <Textarea
                placeholder="Ex: Atestado médico, evento pessoal..."
                value={dialogJustification}
                onChange={e => setDialogJustification(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={saveAbsence}
                disabled={dialogSaving}
                className={dialogStatus === 'absent' ? 'bg-destructive hover:bg-destructive/90' : ''}
              >
                {dialogSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
