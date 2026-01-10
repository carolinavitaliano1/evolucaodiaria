import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, DollarSign, Building2, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { MiniCalendar } from '@/components/dashboard/MiniCalendar';
import { Timeline } from '@/components/dashboard/Timeline';
import { TaskList } from '@/components/dashboard/TaskList';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { ServiceDialog } from '@/components/services/ServiceDialog';
import { useApp } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { selectedDate, appointments, tasks } = useApp();
  const navigate = useNavigate();
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const todayAppointments = appointments.filter(a => a.date === dateStr);
  const pendingTasks = tasks.filter(t => !t.completed);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl lg:text-2xl font-semibold text-foreground mb-0.5">
              Bom dia! 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2"
              onClick={() => navigate('/financial')}
            >
              <DollarSign className="w-4 h-4" />
              Financeiro
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2"
              onClick={() => navigate('/clinics')}
            >
              <Building2 className="w-4 h-4" />
              Clínicas
            </Button>
            <Button 
              size="sm"
              className="gap-2"
              onClick={() => setServiceDialogOpen(true)}
            >
              <Briefcase className="w-4 h-4" />
              Serviço Particular
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mb-6">
        <StatsCards />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column - Calendar */}
        <div className="lg:col-span-3 space-y-5">
          <MiniCalendar />
          
          {/* Day Summary */}
          <div className="bg-card rounded-xl p-4 border border-border">
            <h3 className="font-medium text-foreground mb-3 text-sm">Resumo do Dia</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Atendimentos</span>
                <span className="text-foreground font-semibold">{todayAppointments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Tarefas Pendentes</span>
                <span className="text-foreground font-semibold">{pendingTasks.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column - Timeline */}
        <div className="lg:col-span-6">
          <Timeline />
        </div>

        {/* Right Column - Tasks & Notifications */}
        <div className="lg:col-span-3 space-y-6">
          <NotificationSettings />
          <TaskList />
        </div>
      </div>

      {/* Service Dialog */}
      <ServiceDialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen} />
    </div>
  );
}
