import { useState, useRef, useEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
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
  triggerClassName?: string;
}

export const PatientSearchSelect = forwardRef<HTMLButtonElement, PatientSearchSelectProps>(
  function PatientSearchSelect({ value, onValueChange, patients, placeholder = 'Selecione um paciente', triggerClassName }, ref) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selected = patients.find(p => p.id === value);

    const filtered = patients.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.clinicName && p.clinicName.toLowerCase().includes(search.toLowerCase()))
    );

    // Position dropdown relative to trigger using portal
    const updateDropdownPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const dropdownHeight = Math.min(240, filtered.length * 52 + 52);

      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        // Show above
        setDropdownStyle({
          position: 'fixed',
          top: rect.top - dropdownHeight - 4,
          left: rect.left,
          width: Math.max(rect.width, 240),
          zIndex: 9999,
        });
      } else {
        setDropdownStyle({
          position: 'fixed',
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 240),
          zIndex: 9999,
        });
      }
    };

    useEffect(() => {
      if (open) {
        updateDropdownPosition();
        setTimeout(() => inputRef.current?.focus(), 30);
        setSearch('');
      }
    }, [open]);

    useEffect(() => {
      if (!open) return;
      const handleClose = (e: MouseEvent | KeyboardEvent) => {
        if (e instanceof KeyboardEvent && e.key === 'Escape') {
          setOpen(false);
          return;
        }
        if (e instanceof MouseEvent) {
          const t = e.target as Node;
          if (!triggerRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
            setOpen(false);
          }
        }
      };
      const handleScroll = () => updateDropdownPosition();
      document.addEventListener('mousedown', handleClose);
      document.addEventListener('keydown', handleClose);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      return () => {
        document.removeEventListener('mousedown', handleClose);
        document.removeEventListener('keydown', handleClose);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }, [open]);

    return (
      <>
        {/* Trigger button */}
        <button
          ref={(node) => {
            (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
          }}
          type="button"
          onClick={() => setOpen(o => !o)}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors',
            'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            open && 'ring-2 ring-ring ring-offset-2 border-primary/50',
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
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform duration-150', open && 'rotate-180')} />
          </div>
        </button>

        {/* Portal dropdown */}
        {open && createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="rounded-md border border-border bg-popover shadow-lg"
          >
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
              {search && (
                <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              )}
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
          </div>,
          document.body
        )}
      </>
    );
  }
);
