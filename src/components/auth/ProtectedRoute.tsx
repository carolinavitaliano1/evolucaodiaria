import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

export function ProtectedRoute({ children, requireSubscription = false }: ProtectedRouteProps) {
  const { user, loading, sessionReady } = useAuth();
  const { subscribed, loading: subLoading } = useSubscription();

  // Wait until the session is fully restored from storage before redirecting.
  // This prevents Google OAuth users from being bounced to /auth on page load.
  if (!sessionReady || loading || (requireSubscription && subLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireSubscription && !subscribed) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
}
