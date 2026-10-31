import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { Logo } from "../components/Layout.jsx";
import { Alert, Button, Card, Field, Input, PasswordInput } from "../components/ui.jsx";
import { useAuth } from "../lib/auth.jsx";
import { fieldErrors } from "../lib/usePreview.js";

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="mb-6 flex justify-center">
        <Logo />
      </div>
      <Card className="p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-500">{subtitle}</p>
        {children}
      </Card>
    </div>
  );
}

function useAuthForm(action, initial) {
  const navigate = useNavigate();
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
      navigate("/dashboard");
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
