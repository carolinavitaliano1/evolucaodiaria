import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PortalProvider } from "@/contexts/PortalContext";
import { PortalRoute } from "@/components/portal/PortalRoute";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Clinics from "./pages/Clinics";
import ClinicDetail from "./pages/ClinicDetail";
import PatientDetail from "./pages/PatientDetail";
import GroupDetail from "./pages/GroupDetail";
import Patients from "./pages/Patients";
import Financial from "./pages/Financial";
import Reports from "./pages/Reports";
import Tasks from "./pages/Tasks";
import CalendarPage from "./pages/Calendar";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/Pricing";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import AIReports from "./pages/AIReports";
import InstallApp from "./pages/InstallApp";
import Mural from "./pages/Mural";
import Team from "./pages/Team";
import Support from "./pages/Support";
import AdminSupport from "./pages/AdminSupport";
import PatientIntakePublic from "./pages/PatientIntakePublic";
import Enrollment from "./pages/Enrollment";
import WaitlistPublic from "./pages/WaitlistPublic";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import PortalAuth from "./pages/portal/PortalAuth";
import PortalHome from "./pages/portal/PortalHome";
import PortalMessages from "./pages/portal/PortalMessages";
import PortalIntakeForm from "./pages/portal/PortalIntakeForm";
import PortalNotices from "./pages/portal/PortalNotices";
import PortalContract from "./pages/portal/PortalContract";
import PortalEvolutions from "./pages/portal/PortalEvolutions";
import PortalFinancial from "./pages/portal/PortalFinancial";
import PortalDocuments from "./pages/portal/PortalDocuments";
import PortalMural from "./pages/portal/PortalMural";
import PortalActivities from "./pages/portal/PortalActivities";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

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
            </BrowserRouter>
          </AppProvider>
        </PortalProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
