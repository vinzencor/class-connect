import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import DashboardLayout from "./components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/UsersPage";
import ClassesPage from "./pages/ClassesPage";
import BatchesPage from "./pages/BatchesPage";
import AttendancePage from "./pages/AttendancePage";
import ModulesPage from "./pages/ModulesPage";
import CRMPage from "./pages/CRMPage";
import PaymentsPage from "./pages/PaymentsPage";
import SettingsPage from "./pages/SettingsPage";
import LeaveRequestPage from "./pages/LeaveRequestPage";
import CreateSessionPage from "./pages/CreateSessionPage";
import IDCardPage from "./pages/IDCardPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="users" element={<UsersPage />} />
              <Route
                path="batches"
                element={
                  <ProtectedRoute allowedRoles={["admin", "faculty"]}>
                    <BatchesPage />
                  </ProtectedRoute>
                }
              />
              <Route path="classes" element={<ClassesPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="modules" element={<ModulesPage />} />
              <Route path="crm" element={<CRMPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="leave-requests" element={<LeaveRequestPage />} />
              <Route path="create-session" element={<CreateSessionPage />} />
              <Route
                path="id-cards"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <IDCardPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
