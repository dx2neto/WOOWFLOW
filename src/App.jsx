import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import RequirePermission from '@/components/RequirePermission';
import LoginRedirect from '@/components/LoginRedirect';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
// Paginas de autenticacao (rotas publicas)
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Inbox = lazy(() => import('@/pages/Inbox'));
const WorkQueue = lazy(() => import('@/pages/WorkQueue'));
const CRM = lazy(() => import('@/pages/CRM'));
const CrmAutomations = lazy(() => import('@/pages/CrmAutomations'));
const Customers = lazy(() => import('@/pages/Customers'));
const CustomerProfile = lazy(() => import('@/pages/CustomerProfile'));
const Charges = lazy(() => import('@/pages/Charges'));
const Campaigns = lazy(() => import('@/pages/Campaigns'));
const Chatbot = lazy(() => import('@/pages/Chatbot'));
const MessageTemplates = lazy(() => import('@/pages/MessageTemplates'));
const Signatures = lazy(() => import('@/pages/Signatures'));
const KnowledgeBase = lazy(() => import('@/pages/KnowledgeBase'));
const Reports = lazy(() => import('@/pages/Reports'));
const Integrations = lazy(() => import('@/pages/Integrations'));
const UsersPage = lazy(() => import('@/pages/Users'));
const TagsQueues = lazy(() => import('@/pages/TagsQueues'));
const Holidays = lazy(() => import('@/pages/Holidays'));
const AuditLogs = lazy(() => import('@/pages/AuditLogs'));
const SystemLogs = lazy(() => import('@/pages/SystemLogs'));
const EvolutionSyncLogs = lazy(() => import('@/pages/EvolutionSyncLogs'));
const Telephony = lazy(() => import('@/pages/Telephony'));
const LaraLogs = lazy(() => import('@/pages/LaraLogs'));
const LaraDashboard = lazy(() => import('@/pages/LaraDashboard'));
const LaraReports = lazy(() => import('@/pages/LaraReports'));
const Settings = lazy(() => import('@/pages/Settings'));
const Contracts = lazy(() => import('@/pages/Contracts'));
const Plans = lazy(() => import('@/pages/Plans'));
const Financial = lazy(() => import('@/pages/Financial'));
const WorkOrders = lazy(() => import('@/pages/WorkOrders'));
const NOC = lazy(() => import('@/pages/NOC'));
const Vendors = lazy(() => import('@/pages/Vendors'));
const IxcTest = lazy(() => import('@/pages/IxcTest'));
const Agreements = lazy(() => import('@/pages/Agreements'));
const AgreementDetail = lazy(() => import('@/pages/AgreementDetail'));
const AgreementSettings = lazy(() => import('@/pages/AgreementSettings'));
const SystemAudit = lazy(() => import('@/pages/SystemAudit'));
const AuditCenter = lazy(() => import('@/pages/AuditCenter'));
const SalesPipeline = lazy(() => import('@/pages/SalesPipeline'));
const Resellers = lazy(() => import('@/pages/Resellers'));
const AIAssistant = lazy(() => import('@/pages/AIAssistant'));
const AIPanels = lazy(() => import('@/pages/AIPanels'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <Routes>
      {/* Rotas publicas */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Rotas protegidas (exigem login e usam o Layout com sidebar) */}
      <Route element={<ProtectedRoute unauthenticatedElement={<LoginRedirect />} />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/work-queue" element={<WorkQueue />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/crm-automations" element={<CrmAutomations />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerProfile />} />
          <Route path="/charges" element={<Charges />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/message-templates" element={<MessageTemplates />} />
          <Route path="/signatures" element={<Signatures />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/tags-queues" element={<TagsQueues />} />
          <Route path="/holidays" element={<Holidays />} />
          <Route path="/telephony" element={<Telephony />} />

          {/* Relatórios / Lara — exigem permissão de relatórios */}
          <Route element={<RequirePermission module="reports" />}>
            <Route path="/reports" element={<Reports />} />
            <Route path="/lara-logs" element={<LaraLogs />} />
            <Route path="/lara-dashboard" element={<LaraDashboard />} />
            <Route path="/lara-reports" element={<LaraReports />} />
          </Route>

          {/* Áreas administrativas — apenas admin */}
          <Route element={<RequirePermission adminOnly />}>
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/system-logs" element={<SystemLogs />} />
            <Route path="/evolution-sync-logs" element={<EvolutionSyncLogs />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          {/* IXCSoft pages */}
          <Route path="/contracts"   element={<Contracts />} />
          <Route path="/plans"       element={<Plans />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/noc"         element={<NOC />} />
          <Route path="/vendors"     element={<Vendors />} />
          <Route path="/ixc-test"    element={<IxcTest />} />

          {/* Dados financeiros — exigem permissão especial */}
          <Route element={<RequirePermission special="access_financial_data" />}>
            <Route path="/financial"   element={<Financial />} />
          </Route>

          {/* Módulo de Verificação de Acordo */}
          <Route path="/agreements"          element={<Agreements />} />
          <Route path="/agreements/:id"      element={<AgreementDetail />} />
          <Route element={<RequirePermission adminOnly />}>
            <Route path="/agreements/settings" element={<AgreementSettings />} />
          </Route>

          {/* Painel de Auditoria do Sistema */}
          <Route element={<RequirePermission adminOnly />}>
            <Route path="/system-audit" element={<SystemAudit />} />
            <Route path="/audit-center" element={<AuditCenter />} />
          </Route>

          {/* Módulo de Vendas */}
          <Route path="/sales-pipeline" element={<SalesPipeline />} />
          <Route path="/resellers" element={<Resellers />} />

          {/* Assistente IA */}
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/ai-panels" element={<AIPanels />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App