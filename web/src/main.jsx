import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import Layout from "./components/Layout.jsx";
import { Spinner } from "./components/ui.jsx";
import { AuthProvider, useAuth } from "./lib/auth.jsx";
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
import Pricing from "./pages/Pricing.jsx";
import Studio from "./pages/Studio.jsx";
import "./index.css";

function RequireAuth({ admin = false }) {
  const { loading, user, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-5xl font-semibold">404</p>
      <p className="mt-2 text-zinc-500">This page does not exist.</p>
      <Link to="/" className="mt-4 inline-block text-violet-600 hover:underline">
        Back to the studio
      </Link>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Studio />} />
            <Route path="pricing" element={<Pricing />} />
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
  </StrictMode>,
);
