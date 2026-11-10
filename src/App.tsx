import { Navigate, Route, Routes } from 'react-router-dom';
import { PORTAL } from '@/config/portal';
import { AppShell } from '@/shared/components';
import { RequireAuth } from '@/shared/services/auth';
import { LoginPage } from '@/pages/login/LoginPage';
import { VerifyPage } from '@/pages/verify/VerifyPage';
import { IssuePage } from '@/pages/issue/IssuePage';
import { OverviewPage } from '@/pages/overview/OverviewPage';
import { ElcDetailPage } from '@/pages/elc-detail/ElcDetailPage';
import { InboxPage } from '@/pages/inbox/InboxPage';
import { AuditPage } from '@/pages/audit/AuditPage';
import { DemoProvider } from '@/demo/DemoProvider';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><DemoProvider><AppShell /></DemoProvider></RequireAuth>}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPage />} />
        <Route path="/overview/:vcId" element={<ElcDetailPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        {PORTAL.features.issue && <Route path="/issue" element={<IssuePage />} />}
        <Route path="/issued/*" element={<Navigate to="/overview" replace />} />
        {PORTAL.features.inbox && <Route path="/inbox" element={<InboxPage />} />}
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}
