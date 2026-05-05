import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamAttendanceGrid } from '@/components/clinics/TeamAttendanceGrid';
import { StaffAttendanceReport } from '@/components/clinics/StaffAttendanceReport';
import { Loader2 } from 'lucide-react';

interface Props {
  clinicId: string;
  organizationId: string | null;
}

interface MemberRow {
  id: string;
  user_id: string | null;
  email: string;
  role: string;
  role_label: string | null;
  status: string;
  profile?: { name: string | null; avatar_url: string | null };
}

export function TeamAttendancePanel({ organizationId }: Props) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const { data: membersData } = await supabase
        .from('organization_members')
        .select('id, user_id, email, role, role_label, status')
        .eq('organization_id', organizationId);

      const userIds = (membersData || []).filter(m => m.user_id).map(m => m.user_id!);
      const profilesMap: Record<string, any> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, name, avatar_url')
          .in('user_id', userIds);
        profs?.forEach((p: any) => { profilesMap[p.user_id] = { name: p.name, avatar_url: p.avatar_url }; });
      }
      setMembers((membersData || []).map((m: any) => ({
        ...m,
        profile: m.user_id ? profilesMap[m.user_id] : undefined,
      })));
      setLoading(false);
    })();
  }, [organizationId]);

  if (!organizationId) {
    return <div className="text-center py-12 text-muted-foreground">Esta clínica ainda não pertence a uma organização.</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold mb-3 text-foreground">Frequência da semana</h3>
        <TeamAttendanceGrid
          organizationId={organizationId}
          members={members as any}
          canManage={true}
        />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-semibold mb-3 text-foreground">Resumo mensal</h3>
        <StaffAttendanceReport
          organizationId={organizationId}
          members={members}
        />
      </div>
    </div>
  );
}