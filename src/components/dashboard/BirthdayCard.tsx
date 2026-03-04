import { useApp } from '@/contexts/AppContext';
import { Cake } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

function isBirthdayToday(birthdate: string): boolean {
  const today = new Date();
  const birth = new Date(birthdate + 'T12:00:00');
  return birth.getMonth() === today.getMonth() && birth.getDate() === today.getDate();
}

function calculateAge(birthdate: string): number {
  const today = new Date();
  const birth = new Date(birthdate + 'T12:00:00');
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function BirthdayCard() {
  const { patients } = useApp();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const birthdays = patients.filter(p => !p.isArchived && p.birthdate && isBirthdayToday(p.birthdate));

  if (birthdays.length === 0) return null;

  return (
    <div className={cn(
      'rounded-xl p-4 border animate-scale-in',
      theme === 'lilas' ? 'calendar-grid border-0 shadow-md' : 'bg-card border-border'
    )}>
      <h3 className="font-medium text-foreground mb-3 text-sm flex items-center gap-2">
        <Cake className="w-4 h-4 text-primary" />
        🎂 Aniversariantes de Hoje
      </h3>
      <div className="space-y-2">
        {birthdays.map(p => (
          <button
            key={p.id}
            onClick={() => navigate(`/patients/${p.id}`)}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/5 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {p.avatarUrl ? (
                <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-base">🎂</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{calculateAge(p.birthdate)} anos hoje 🎉</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
