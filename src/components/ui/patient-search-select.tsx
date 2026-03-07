import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PatientOption {
  id: string;
  name: string;
  clinicName?: string;
}

interface PatientSearchSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  patients: PatientOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}

export function PatientSearchSelect({
  value,
  onValueChange,
  patients,
  placeholder = 'Selecione um paciente',
  triggerClassName,
}: PatientSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = patients.find(p => p.id === value);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.clinicName && p.clinicName.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
    }
  }, [open]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors',
          'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          triggerClassName
        )}
      >
        <span className={cn('flex-1 truncate text-left', !selected && 'text-muted-foreground')}>
          {selected
            ? selected.clinicName
              ? `${selected.name} — ${selected.clinicName}`
              : selected.name
            : placeholder}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onValueChange(''); setSearch(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onValueChange(''); } }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-md border border-border bg-popover shadow-lg">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar paciente..."
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum paciente encontrado</p>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onValueChange(p.id); setOpen(false); setSearch(''); }}
                  className={cn(
                    'w-full flex flex-col items-start px-3 py-2 text-sm hover:bg-accent transition-colors',
                    value === p.id && 'bg-primary/10 text-primary font-medium'
                  )}
                >
                  <span className="font-medium">{p.name}</span>
                  {p.clinicName && (
                    <span className="text-xs text-muted-foreground">{p.clinicName}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
