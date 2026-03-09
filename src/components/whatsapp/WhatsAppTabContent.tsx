import { useState } from 'react';
import { Send, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhatsAppSendPanel } from './WhatsAppSendPanel';
import { MessageTemplatesManager } from './MessageTemplatesManager';
import { Patient } from '@/types';

interface ClinicInfo {
  name?: string;
  address?: string;
  phone?: string;
}

interface WhatsAppTabContentProps {
  clinicPatients: Patient[];
  clinic?: ClinicInfo;
}

type SubTab = 'send' | 'templates';

export function WhatsAppTabContent({ clinicPatients, clinic }: WhatsAppTabContentProps) {
  const [subTab, setSubTab] = useState<SubTab>('send');

  const subTabs: { value: SubTab; label: string; icon: React.ReactNode }[] = [
    { value: 'send',      label: 'Enviar',  icon: <Send          className="w-3.5 h-3.5" /> },
    { value: 'templates', label: 'Modelos', icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-nav */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {subTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setSubTab(tab.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              subTab === tab.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Send sub-tab */}
      {subTab === 'send' && (
        <WhatsAppSendPanel
          patients={clinicPatients.map(p => ({
            id:                   p.id,
            name:                 p.name,
            phone:                p.phone,
            whatsapp:             p.whatsapp,
            email:                p.email,
            birthdate:            p.birthdate,
            responsible_name:     p.responsibleName,
            responsible_whatsapp: p.responsibleWhatsapp,
          }))}
          clinic={clinic}
          onGoToTemplates={() => setSubTab('templates')}
        />
      )}

      {/* Templates sub-tab */}
      {subTab === 'templates' && (
        <div className="bg-card rounded-xl border border-border p-4 lg:p-6">
          <MessageTemplatesManager />
        </div>
      )}
    </div>
  );
}
