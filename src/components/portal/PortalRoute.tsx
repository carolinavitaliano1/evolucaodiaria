import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePortal } from '@/contexts/PortalContext';
import { Loader2 } from 'lucide-react';

export function PortalRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, sessionReady } = useAuth();
  const { isPortalUser, loading: portalLoading } = usePortal();

  if (!sessionReady || authLoading || portalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/portal/auth" replace />;
  if (!isPortalUser) return <Navigate to="/portal/auth" replace />;

  return <>{children}</>;
}
