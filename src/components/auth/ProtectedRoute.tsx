import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useOrgMembership } from '@/hooks/useOrgMembership';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

export function ProtectedRoute({ children, requireSubscription = false }: ProtectedRouteProps) {
  const { user, loading, sessionReady } = useAuth();
  const { subscribed, loading: subLoading } = useSubscription();
  const { isOrgMember, loading: orgLoading } = useOrgMembership();

  // Wait until the session is fully restored from storage before redirecting.
  if (!sessionReady || loading || (requireSubscription && subLoading) || (requireSubscription && orgLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Org members (invited professionals) bypass the subscription wall —
  // they are guests of the paying account owner.
  if (requireSubscription && !subscribed && !isOrgMember) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
}
