import { Palette } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        "h-9 w-9 rounded-lg",
        theme === 'lilas' && "bg-primary/10 text-primary"
      )}
      title={theme === 'clean' ? 'Mudar para tema Lilás' : 'Mudar para tema Clean'}
    >
      <Palette className="h-4 w-4" />
    </Button>
  );
}
