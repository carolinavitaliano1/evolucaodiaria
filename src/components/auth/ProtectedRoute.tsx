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
  const { isOrgMember, loading: orgLoading } = useOrgMembership();
  // Only check subscription if we already know the user is NOT an org member,
  // to avoid the subscription edge-function call for invited collaborators.
  const { subscribed, loading: subLoading } = useSubscription();

  // Wait until auth session is restored
  if (!sessionReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireSubscription) {
    // CRITICAL: Always wait for org membership check first.
    // If orgLoading is still true we must not redirect yet.
    if (orgLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // Org members (invited professionals) bypass the subscription wall entirely —
    // they are guests of the paying account owner and must never see /pricing.
    if (isOrgMember) {
      return <>{children}</>;
    }

    // Not an org member: now wait for subscription check
    if (subLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!subscribed) {
      return <Navigate to="/pricing" replace />;
    }
  }

  return <>{children}</>;
}

