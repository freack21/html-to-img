import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import Layout from "./components/Layout.jsx";
import { ConfirmProvider, EmptyState, Spinner, ToastProvider } from "./components/ui.jsx";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
import { ThemeProvider } from "./lib/theme.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminOverview from "./pages/admin/Overview.jsx";
import AdminPlans from "./pages/admin/Plans.jsx";
import AdminSettings from "./pages/admin/Settings.jsx";
import TemplateEditor from "./pages/admin/TemplateEditor.jsx";
import AdminTemplates from "./pages/admin/Templates.jsx";
import AdminUsers from "./pages/admin/Users.jsx";
import { Login, Register } from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Docs from "./pages/Docs.jsx";
import Landing from "./pages/Landing.jsx";
import Pricing from "./pages/Pricing.jsx";
import Studio from "./pages/Studio.jsx";
import "./index.css";

function RequireAuth({ admin = false }) {
  const { loading, user, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-zinc-400">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Pricing is hidden while plans are switched off by the admin. */
function PricingPage() {
  const { loading, pricing } = useAuth();
  if (loading) return null;
  return pricing ? <Pricing /> : <Navigate to="/" replace />;
}

/** "/" is the landing page; old studio links (/?t=slug) keep working. */
function Home() {
  const { search } = useLocation();
  if (new URLSearchParams(search).has("t")) return <Navigate to={`/studio${search}`} replace />;
  return <Landing />;
}

function NotFound() {
  return (
    <EmptyState
      icon="search"
      title="Page not found"
      description="The page you are looking for doesn't exist or has moved."
      action={
        <Link to="/" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          Back home
        </Link>
      }
    />
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route element={<Layout fullBleed />}>
                  <Route path="studio" element={<Studio />} />
                </Route>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="pricing" element={<PricingPage />} />
                  <Route path="docs" element={<Docs />} />
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  <Route element={<RequireAuth />}>
                    <Route path="dashboard" element={<Dashboard />} />
                  </Route>
                  <Route element={<RequireAuth admin />}>
                    <Route path="admin" element={<AdminLayout />}>
                      <Route index element={<AdminOverview />} />
                      <Route path="templates" element={<AdminTemplates />} />
                      <Route path="templates/:id" element={<TemplateEditor />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="plans" element={<AdminPlans />} />
                      <Route path="settings" element={<AdminSettings />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
