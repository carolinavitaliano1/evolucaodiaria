import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

interface ActiveCall {
  sessionId: string;
  roomUrl: string;
  userName?: string;
  onLeft?: () => void;
}

interface Ctx {
  call: ActiveCall | null;
  startCall: (c: ActiveCall) => void;
  endCall: () => void;
}

const TelehealthCallContext = createContext<Ctx | null>(null);

export function TelehealthCallProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<ActiveCall | null>(null);
  const startCall = useCallback((c: ActiveCall) => setCall(c), []);
  const endCall = useCallback(() => setCall(null), []);
  return (
    <TelehealthCallContext.Provider value={{ call, startCall, endCall }}>
      {children}
    </TelehealthCallContext.Provider>
  );
}

export function useTelehealthCall() {
  const ctx = useContext(TelehealthCallContext);
  if (!ctx) throw new Error('useTelehealthCall must be used within TelehealthCallProvider');
  return ctx;
}