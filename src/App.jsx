import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import Inbox from '@/pages/Inbox';
import CRM from '@/pages/CRM';
import Customers from '@/pages/Customers';
import Charges from '@/pages/Charges';
import Campaigns from '@/pages/Campaigns';
import Chatbot from '@/pages/Chatbot';
import Signatures from '@/pages/Signatures';
import KnowledgeBase from '@/pages/KnowledgeBase';
import Reports from '@/pages/Reports';
import Integrations from '@/pages/Integrations';
import UsersPage from '@/pages/Users';
import TagsQueues from '@/pages/TagsQueues';
import Holidays from '@/pages/Holidays';
import AuditLogs from '@/pages/AuditLogs';
import SystemLogs from '@/pages/SystemLogs';
import Telephony from '@/pages/Telephony';
import Settings from '@/pages/Settings';
import { Navigate } from 'react-router-dom';

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
      <Route path="/" element={<Landing />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/charges" element={<Charges />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/signatures" element={<Signatures />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/tags-queues" element={<TagsQueues />} />
          <Route path="/holidays" element={<Holidays />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/system-logs" element={<SystemLogs />} />
          <Route path="/telephony" element={<Telephony />} />
          <Route path="/settings" element={<Settings />} />
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