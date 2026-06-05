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
import { TelehealthCallProvider } from "@/contexts/TelehealthCallContext";
import { PersistentTelehealthRoom } from "@/components/telehealth/PersistentTelehealthRoom";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

// Retry lazy import once and reload the page on persistent failure.
// Fixes "Importing a module script failed" after a new deploy invalidates old chunk hashes.
function lazyWithReload<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const key = `__chunk_reload_${factory.toString().slice(0, 80)}`;
      if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

// Lazy-loaded heavy routes — keeps initial bundle small for faster startup
const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const Clinics = lazyWithReload(() => import("./pages/Clinics"));
const ClinicDetail = lazyWithReload(() => import("./pages/ClinicDetail"));
const PatientDetail = lazyWithReload(() => import("./pages/PatientDetail"));
const GroupDetail = lazyWithReload(() => import("./pages/GroupDetail"));
const Patients = lazyWithReload(() => import("./pages/Patients"));
const Financial = lazyWithReload(() => import("./pages/Financial"));
const Reports = lazyWithReload(() => import("./pages/Reports"));
const Tasks = lazyWithReload(() => import("./pages/Tasks"));
const CalendarPage = lazyWithReload(() => import("./pages/Calendar"));
const Evolutions = lazyWithReload(() => import("./pages/Evolutions"));
const Profile = lazyWithReload(() => import("./pages/Profile"));
const Pricing = lazyWithReload(() => import("./pages/Pricing"));
const CheckoutSuccess = lazyWithReload(() => import("./pages/CheckoutSuccess"));
const AIReports = lazyWithReload(() => import("./pages/AIReports"));
const DocIA = lazyWithReload(() => import("./pages/DocIA"));
const InstallApp = lazyWithReload(() => import("./pages/InstallApp"));
const Mural = lazyWithReload(() => import("./pages/Mural"));
const Team = lazyWithReload(() => import("./pages/Team"));
const Modules = lazyWithReload(() => import("./pages/Modules"));
const MyCommissions = lazyWithReload(() => import("./pages/MyCommissions"));
const Support = lazyWithReload(() => import("./pages/Support"));
const AdminSupport = lazyWithReload(() => import("./pages/AdminSupport"));
const AdminUsers = lazyWithReload(() => import("./pages/AdminUsers"));
const PatientIntakePublic = lazyWithReload(() => import("./pages/PatientIntakePublic"));
const Enrollment = lazyWithReload(() => import("./pages/Enrollment"));
const WaitlistPublic = lazyWithReload(() => import("./pages/WaitlistPublic"));
const TeamApplicationPublic = lazyWithReload(() => import("./pages/TeamApplicationPublic"));
const PrivacyPolicy = lazyWithReload(() => import("./pages/PrivacyPolicy"));
const TermsOfUse = lazyWithReload(() => import("./pages/TermsOfUse"));
const PortalAuth = lazyWithReload(() => import("./pages/portal/PortalAuth"));
const PortalHome = lazyWithReload(() => import("./pages/portal/PortalHome"));
const PortalMessages = lazyWithReload(() => import("./pages/portal/PortalMessages"));
const PortalIntakeForm = lazyWithReload(() => import("./pages/portal/PortalIntakeForm"));
const PortalNotices = lazyWithReload(() => import("./pages/portal/PortalNotices"));
const PortalContract = lazyWithReload(() => import("./pages/portal/PortalContract"));
const PortalEvolutions = lazyWithReload(() => import("./pages/portal/PortalEvolutions"));
const PortalFinancial = lazyWithReload(() => import("./pages/portal/PortalFinancial"));
const PortalDocuments = lazyWithReload(() => import("./pages/portal/PortalDocuments"));
const PortalMural = lazyWithReload(() => import("./pages/portal/PortalMural"));
const PortalActivities = lazyWithReload(() => import("./pages/portal/PortalActivities"));
const TelehealthPatient = lazyWithReload(() => import("./pages/TelehealthPatient"));
const TelehealthRoomPage = lazyWithReload(() => import("./pages/TelehealthRoomPage"));
const Telechamadas = lazyWithReload(() => import("./pages/Telechamadas"));

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
              <TelehealthCallProvider>
                <PersistentTelehealthRoom />
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
                  {/* Telehealth — public patient page (token-based, no login) */}
                  <Route path="/teleatendimento/:token" element={<TelehealthPatient />} />
                  {/* Telehealth — therapist room (requires login) */}
                  <Route path="/teleatendimento/sala/:sessionId" element={<ProtectedRoute requireSubscription><TelehealthRoomPage /></ProtectedRoute>} />
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
                    <Route path="/evolucoes" element={<Evolutions />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/install" element={<InstallApp />} />
                    <Route path="/mural" element={<Mural />} />
                    <Route path="/team" element={<Team />} />
                    <Route path="/modulos" element={<Modules />} />
                    <Route path="/minhas-comissoes" element={<MyCommissions />} />
                    <Route path="/suporte" element={<Support />} />
                    <Route path="/admin/suporte" element={<AdminSupport />} />
                    <Route path="/admin/usuarios" element={<AdminUsers />} />
                    <Route path="/telechamadas" element={<Telechamadas />} />
                  </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </TelehealthCallProvider>
            </BrowserRouter>
          </AppProvider>
        </PortalProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
