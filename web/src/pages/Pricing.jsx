import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, Card, PageHeader, Spinner, cx } from "../components/ui.jsx";
import { api, formatNumber, formatPrice } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

function features(plan) {
  return [
    `${formatNumber(plan.monthlyQuota)} renders / month`,
    `Up to ${plan.maxScale}x resolution`,
    `Image links kept ${plan.retentionHours >= 48 ? `${plan.retentionHours / 24} days` : `${plan.retentionHours} hours`}`,
    plan.watermark ? "Watermarked output" : "No watermark",
    plan.premiumTemplates ? "Premium templates" : "Standard templates",
    plan.apiAccess ? "API access" : "Web studio only",
  ];
}

export default function Pricing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/plans").then(setPlans).catch(setError);
  }, []);

  if (error) return <Alert>{error.message}</Alert>;
  if (!plans) return <Spinner />;

  return (
    <div>
      <PageHeader title="Pricing" description="Start free. Upgrade when you need more renders, resolution or premium templates." />
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const current = user?.planId === plan.id;
          return (
            <Card key={plan.id} className={cx("flex flex-col p-6", current && "ring-2 ring-violet-500")}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {current && <Badge tone="violet">Current plan</Badge>}
              </div>
              <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>
              <p className="mt-4 text-3xl font-semibold">
                {formatPrice(plan.price)}
                {plan.price > 0 && <span className="text-sm font-normal text-zinc-500"> / month</span>}
              </p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {features(plan).map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-violet-600">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {!user ? (
                  <Link to="/register" className="block rounded-lg bg-violet-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-violet-500">
                    Get started
                  </Link>
                ) : current ? null : (
                  <p className="rounded-lg bg-zinc-100 px-4 py-2 text-center text-sm text-zinc-500 dark:bg-zinc-800">
                    Online payment is coming soon — contact the admin to switch plans.
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="mt-6 p-6 text-sm text-zinc-600 dark:text-zinc-400">
        <strong className="text-zinc-900 dark:text-zinc-100">Guests</strong> can render a few watermarked images per day
        without an account. Quotas reset on the 1st of every month (UTC).
      </Card>
    </div>
  );
}
