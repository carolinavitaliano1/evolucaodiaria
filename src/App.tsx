import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppProvider } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalProvider } from "@/contexts/PortalContext";
import { PortalRoute } from "@/components/portal/PortalRoute";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Lazy-loaded heavy routes — keeps initial bundle small for faster startup
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clinics = lazy(() => import("./pages/Clinics"));
const ClinicDetail = lazy(() => import("./pages/ClinicDetail"));
const PatientDetail = lazy(() => import("./pages/PatientDetail"));
const GroupDetail = lazy(() => import("./pages/GroupDetail"));
const Patients = lazy(() => import("./pages/Patients"));
const Financial = lazy(() => import("./pages/Financial"));
const Reports = lazy(() => import("./pages/Reports"));
const Tasks = lazy(() => import("./pages/Tasks"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const Profile = lazy(() => import("./pages/Profile"));
const Pricing = lazy(() => import("./pages/Pricing"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const AIReports = lazy(() => import("./pages/AIReports"));
const DocIA = lazy(() => import("./pages/DocIA"));
const InstallApp = lazy(() => import("./pages/InstallApp"));
const Mural = lazy(() => import("./pages/Mural"));
const Team = lazy(() => import("./pages/Team"));
const Support = lazy(() => import("./pages/Support"));
const AdminSupport = lazy(() => import("./pages/AdminSupport"));
const PatientIntakePublic = lazy(() => import("./pages/PatientIntakePublic"));
const Enrollment = lazy(() => import("./pages/Enrollment"));
const WaitlistPublic = lazy(() => import("./pages/WaitlistPublic"));
const TeamApplicationPublic = lazy(() => import("./pages/TeamApplicationPublic"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/TermsOfUse"));
const PortalAuth = lazy(() => import("./pages/portal/PortalAuth"));
const PortalHome = lazy(() => import("./pages/portal/PortalHome"));
const PortalMessages = lazy(() => import("./pages/portal/PortalMessages"));
const PortalIntakeForm = lazy(() => import("./pages/portal/PortalIntakeForm"));
const PortalNotices = lazy(() => import("./pages/portal/PortalNotices"));
const PortalContract = lazy(() => import("./pages/portal/PortalContract"));
const PortalEvolutions = lazy(() => import("./pages/portal/PortalEvolutions"));
const PortalFinancial = lazy(() => import("./pages/portal/PortalFinancial"));
const PortalDocuments = lazy(() => import("./pages/portal/PortalDocuments"));
const PortalMural = lazy(() => import("./pages/portal/PortalMural"));
const PortalActivities = lazy(() => import("./pages/portal/PortalActivities"));

// Tuned defaults: avoid refetch storms when user switches tabs/windows.
// Most app data is loaded via AppContext + Supabase realtime, so we keep
// queries fresh for 5 min and cached for 30 min, and disable refetch on focus.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes — data considered fresh
      gcTime: 30 * 60 * 1000,          // 30 minutes — kept in memory
      refetchOnWindowFocus: false,     // don't refetch when user returns to tab
      refetchOnReconnect: 'always',    // do refetch when network reconnects
      retry: 1,                        // retry failed queries once
    },
    mutations: {
      retry: 0,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Smart root: logged-in → /dashboard, visitor → Landing page
function RootRedirect() {
  const { user, loading, sessionReady } = useAuth();
  if (!sessionReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PortalProvider>
          <AppProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<RootRedirect />} />
                  <Route path="/landing" element={<Landing />} />
                  <Route path="/privacidade" element={<PrivacyPolicy />} />
                  <Route path="/termos" element={<TermsOfUse />} />
                  <Route path="/auth" element={<Auth />} />
                  {/* Portal routes (patient-facing) */}
                  <Route path="/portal/auth" element={<PortalAuth />} />
                  <Route path="/portal/home" element={<PortalRoute><PortalHome /></PortalRoute>} />
                  <Route path="/portal/mensagens" element={<PortalRoute><PortalMessages /></PortalRoute>} />
                  <Route path="/portal/fichas" element={<PortalRoute><PortalIntakeForm /></PortalRoute>} />
                  <Route path="/portal/ficha" element={<Navigate to="/portal/fichas" replace />} />
                  <Route path="/portal/avisos" element={<PortalRoute><PortalNotices /></PortalRoute>} />
                  <Route path="/portal/contrato" element={<PortalRoute><PortalContract /></PortalRoute>} />
                  <Route path="/portal/evolucoes" element={<PortalRoute><PortalEvolutions /></PortalRoute>} />
                  <Route path="/portal/financeiro" element={<PortalRoute><PortalFinancial /></PortalRoute>} />
                  <Route path="/portal/documentos" element={<PortalRoute><PortalDocuments /></PortalRoute>} />
                  <Route path="/portal/mural" element={<PortalRoute><PortalMural /></PortalRoute>} />
                  <Route path="/portal/atividades" element={<PortalRoute><PortalActivities /></PortalRoute>} />
                  {/* Public intake form — no auth required */}
                  <Route path="/cadastro-paciente/:token" element={<PatientIntakePublic />} />
                  {/* Self-service enrollment — no auth required */}
                  <Route path="/matricula/:clinicId" element={<Enrollment />} />
                  <Route path="/lista-espera/:clinicId" element={<WaitlistPublic />} />
                  <Route path="/candidatura-equipe/:organizationId" element={<TeamApplicationPublic />} />
                  <Route path="/checkout-success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
                  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/pricing" element={<Pricing />} />
                  </Route>
                  <Route element={<ProtectedRoute requireSubscription><AppLayout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/clinics" element={<Clinics />} />
                    <Route path="/clinics/:id" element={<ClinicDetail />} />
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/patients/:id" element={<PatientDetail />} />
                    <Route path="/groups/:id" element={<GroupDetail />} />
                    <Route path="/financial" element={<Financial />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/ai-reports" element={<AIReports />} />
                    <Route path="/doc-ia" element={<DocIA />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/install" element={<InstallApp />} />
                    <Route path="/mural" element={<Mural />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/suporte" element={<Support />} />
                    <Route path="/admin/suporte" element={<AdminSupport />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AppProvider>
        </PortalProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
