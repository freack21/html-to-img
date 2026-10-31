import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { Logo } from "../components/Layout.jsx";
import { Alert, Button, Field, Icon, Input, PasswordInput } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { fieldErrors } from "../lib/usePreview.js";

const PERKS = [
  ["sparkles", "13 ready-made templates, plus your own"],
  ["zap", "Fast rendering to PNG, JPEG and SVG"],
  ["key", "API keys and a usage dashboard"],
];

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 shadow-zinc-900/5 ring-zinc-200 md:grid-cols-2 dark:bg-zinc-900 dark:shadow-black/30 dark:ring-zinc-800">
      <div className="relative isolate hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white md:flex">
        <div aria-hidden="true" className="absolute -top-24 -left-24 -z-10 size-80 rounded-full bg-violet-600/50 blur-3xl" />
        <div aria-hidden="true" className="absolute -right-24 -bottom-24 -z-10 size-80 rounded-full bg-fuchsia-600/30 blur-3xl" />
        <Logo />
        <div>
          <p className="text-2xl font-semibold tracking-tight">Design once. Render thousands.</p>
          <ul className="mt-6 space-y-3 text-sm text-zinc-300">
            {PERKS.map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-white/10">
                  <Icon name={icon} className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <img src="/api/v1/templates/qc/thumbnail.png" alt="" className="w-64 opacity-90" />
      </div>
      <div className="p-8 sm:p-10">
        <div className="mb-8 md:hidden">
          <Logo />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 mb-8 text-sm text-zinc-500">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function useAuthForm(action, initial) {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm({ ...form, [name]: e.target.value }) });
  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await action(form);
      // Return to the page that required login, if any.
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  return { bind, error, errors: fieldErrors(error), loading, onSubmit };
}

export function Login() {
  const { user, login } = useAuth();
  const { bind, error, errors, loading, onSubmit } = useAuthForm(login, { email: "", password: "" });
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <AuthCard title="Welcome back" subtitle="Log in to your account.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && !error.details.length && <Alert>{error.message}</Alert>}
        <Field label="Email" error={errors.email}>
          <Input type="email" autoComplete="email" {...bind("email")} />
        </Field>
        <Field label="Password" error={errors.password}>
          <PasswordInput autoComplete="current-password" {...bind("password")} />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-500">
        No account?{" "}
        <Link to="/register" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
          Sign up
        </Link>
      </p>
    </AuthCard>
  );
}

export function Register() {
  const { user, session, register } = useAuth();
  const { bind, error, errors, loading, onSubmit } = useAuthForm(register, { name: "", email: "", password: "" });
  if (user) return <Navigate to="/dashboard" replace />;
  if (session && !session.registrationOpen) {
    return (
      <AuthCard title="Registration closed" subtitle="New sign-ups are currently disabled.">
        <Link to="/login" className="text-sm font-medium text-violet-600 hover:underline">
          Log in instead
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Create your account" subtitle="Free plan included. No credit card needed.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && !error.details.length && <Alert>{error.message}</Alert>}
        <Field label="Name" error={errors.name}>
          <Input autoComplete="name" {...bind("name")} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" autoComplete="email" {...bind("email")} />
        </Field>
        <Field label="Password" hint="At least 8 characters." error={errors.password}>
          <PasswordInput autoComplete="new-password" {...bind("password")} />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
