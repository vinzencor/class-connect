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
import ConvertedLeadsPage from "./pages/ConvertedLeadsPage";
import PaymentsPage from "./pages/PaymentsPage";
import SettingsPage from "./pages/SettingsPage";
import LeaveRequestPage from "./pages/LeaveRequestPage";
import CreateSessionPage from "./pages/CreateSessionPage";
import IDCardPage from "./pages/IDCardPage";
import RolesPage from "./pages/RolesPage";
import StudentRegistrationPage from "./pages/StudentRegistrationPage";
import ResetPassword from "./pages/ResetPassword";
import GoogleCallbackPage from "./pages/GoogleCallbackPage";
import ReportsPage from "./pages/ReportsPage";
import CoursesPage from "./pages/CoursesPage";
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
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/register/:token" element={<StudentRegistrationPage />} />
            <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route
                path="users"
                element={
                  <ProtectedRoute requiredPermission="users">
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="batches"
                element={
                  <ProtectedRoute requiredPermission="batches">
                    <BatchesPage />
                  </ProtectedRoute>
                }
              />
              <Route path="classes" element={<ClassesPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route
                path="courses"
                element={
                  <ProtectedRoute requiredPermission="courses">
                    <CoursesPage />
                  </ProtectedRoute>
                }
              />
              <Route path="modules" element={<ModulesPage />} />
              <Route
                path="crm"
                element={
                  <ProtectedRoute requiredPermission="crm">
                    <CRMPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="converted-leads"
                element={
                  <ProtectedRoute requiredPermission="converted_leads">
                    <ConvertedLeadsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="payments"
                element={
                  <ProtectedRoute requiredPermission="payments">
                    <PaymentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="id-cards"
                element={
                  <ProtectedRoute requiredPermission="id_cards">
                    <IDCardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="roles"
                element={
                  <ProtectedRoute requiredPermission="roles">
                    <RolesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute requiredPermission="reports">
                    <ReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="leave-requests" element={<LeaveRequestPage />} />
              <Route path="create-session" element={<CreateSessionPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
