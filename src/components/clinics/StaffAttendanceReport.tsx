import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface StaffAttendanceReportProps {
  organizationId: string;
  members: any[];
}

interface AttendanceRecord {
  member_id: string;
  date: string;
  status: 'present' | 'absent' | 'justified';
}

export function StaffAttendanceReport({ organizationId, members }: StaffAttendanceReportProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const activeMembers = members.filter(m => m.status === 'active');

  const loadAttendance = async () => {
    if (!organizationId) return;
    setLoading(true);
    const startStr = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
    const endStr = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .from('team_attendance')
        .select('member_id, date, status')
        .eq('organization_id', organizationId)
        .gte('date', startStr)
        .lte('date', endStr);

      if (error) throw error;
      setAttendance(data as AttendanceRecord[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [organizationId, selectedDate]);

  const getMemberStats = (memberId: string) => {
    const memberAttendance = attendance.filter(a => a.member_id === memberId);
    return {
      worked: memberAttendance.filter(a => a.status === 'present').length,
      absences: memberAttendance.filter(a => a.status === 'absent').length,
      justified: memberAttendance.filter(a => a.status === 'justified').length,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-foreground">Relatório Mensal de Frequência</h3>
          <p className="text-sm text-muted-foreground">Acompanhamento de dias trabalhados e faltas da equipe</p>
        </div>
        <div className="flex items-center gap-3 bg-card border border-border p-1 rounded-xl">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => subMonths(prev, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-2 capitalize">
            {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => addMonths(prev, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeMembers.map(member => {
            const stats = getMemberStats(member.id);
            return (
              <div key={member.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/50 transition-all group">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {member.profile?.name?.[0] || member.email?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                      {member.profile?.name || member.email}
                    </h4>
                    <p className="text-xs text-muted-foreground">{member.role_label || member.role}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-success/5 border border-success/10 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-success font-medium uppercase mb-1">Trabalhados</p>
                    <p className="text-xl font-bold text-success">{stats.worked}</p>
                  </div>
                  <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-destructive font-medium uppercase mb-1">Faltas</p>
                    <p className="text-xl font-bold text-destructive">{stats.absences}</p>
                  </div>
                  <div className="bg-warning/5 border border-warning/10 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-warning font-medium uppercase mb-1">Justificadas</p>
                    <p className="text-xl font-bold text-warning">{stats.justified}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground pt-4 border-t border-border/50">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Frequência Total: {((stats.worked / (stats.worked + stats.absences + stats.justified || 1)) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}

          {activeMembers.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed border-border">
              Nenhum profissional ativo na equipe.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
