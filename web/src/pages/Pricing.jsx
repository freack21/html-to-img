import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, Disclosure, Icon, Skeleton, cx } from "../components/ui.jsx";
import { api, formatNumber, formatPrice } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

function features(plan) {
  return [
    [true, `${formatNumber(plan.monthlyQuota)} renders / month`],
    [true, `Up to ${plan.maxScale}× resolution`],
    [true, `Links kept ${plan.retentionHours >= 48 ? `${plan.retentionHours / 24} days` : `${plan.retentionHours} hours`}`],
    [!plan.watermark, "No watermark"],
    [plan.premiumTemplates, "Premium templates"],
    [plan.apiAccess, "API access"],
  ];
}

const FAQ = [
  ["Can I try it without an account?", "Yes. Guests can render a few watermarked images per day in the studio and through the API."],
  ["When do quotas reset?", "Monthly quotas reset on the 1st of every month (UTC). Unused renders don't roll over."],
  ["How do I upgrade?", "Online payment is coming soon. Until then, contact the admin and they can switch your plan right away."],
  ["What counts as a render?", "Every image you download or turn into a link. Live previews in the studio are free and don't count."],
];

export default function Pricing() {
  const { user } = useAuth();
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("/plans").then(setPlans).catch(setError);
  }, []);

  // Highlight the middle plan of three (the usual "most popular" tier).
  const popularId = plans?.length === 3 ? plans[1].id : null;

  return (
    <div>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Pricing</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">Simple plans that grow with you</h1>
        <p className="mt-3 text-zinc-500">Start free. Upgrade when you need more renders, higher resolution or premium templates.</p>
      </div>

      {error && (
        <div className="mx-auto mt-8 max-w-md">
          <Alert>{error.message}</Alert>
        </div>
      )}

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {(plans ?? [null, null, null]).map((plan, i) => {
          if (!plan) return <Skeleton key={i} className="h-[30rem] rounded-2xl" />;
          const current = user?.planId === plan.id;
          const popular = plan.id === popularId;
          return (
            <div
              key={plan.id}
              className={cx(
                "relative flex flex-col rounded-2xl p-7",
                popular
                  ? "bg-zinc-950 text-white shadow-2xl ring-1 shadow-violet-900/20 ring-zinc-800 md:-my-4 md:py-11 dark:bg-zinc-900 dark:ring-violet-500/50"
                  : "bg-white ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800",
              )}
            >
              {popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1 text-xs font-semibold text-white shadow">
                  Most popular
                </span>
              )}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {current && <Badge tone="violet">Current plan</Badge>}
              </div>
              <p className={cx("mt-1 text-sm", popular ? "text-zinc-400" : "text-zinc-500")}>{plan.description}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{formatPrice(plan.price)}</span>
                {plan.price > 0 && <span className={cx("text-sm", popular ? "text-zinc-400" : "text-zinc-500")}>/ month</span>}
              </p>
              <ul className="mt-8 flex-1 space-y-3 text-sm">
                {features(plan).map(([included, text]) => (
                  <li key={text} className={cx("flex items-center gap-3", !included && "opacity-45")}>
                    <span
                      className={cx(
                        "grid size-5 shrink-0 place-items-center rounded-full",
                        included ? (popular ? "bg-violet-500 text-white" : "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300") : "bg-zinc-200/60 dark:bg-zinc-700/50",
                      )}
                    >
                      <Icon name={included ? "check" : "minus"} className="size-3" strokeWidth={3} />
                    </span>
                    <span className={cx(!included && "line-through")}>{text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {!user ? (
                  <Link
                    to="/register"
                    className={cx(
                      "block rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-colors",
                      popular ? "bg-white text-zinc-900 hover:bg-zinc-200" : "bg-violet-600 text-white hover:bg-violet-500",
                    )}
                  >
                    {plan.price === 0 ? "Start for free" : `Get ${plan.name}`}
                  </Link>
                ) : current ? (
                  <Link to="/dashboard" className={cx("block rounded-xl px-4 py-2.5 text-center text-sm font-semibold ring-1", popular ? "ring-white/20 hover:bg-white/10" : "ring-zinc-300 hover:bg-zinc-50 dark:ring-zinc-700 dark:hover:bg-zinc-800")}>
                    View usage
                  </Link>
                ) : (
                  <p className={cx("rounded-xl px-4 py-2.5 text-center text-xs", popular ? "bg-white/10 text-zinc-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800")}>
                    Online payment coming soon — ask the admin to switch plans.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mx-auto mt-20 max-w-2xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-8 divide-y divide-zinc-200 rounded-2xl bg-white ring-1 ring-zinc-200 dark:divide-zinc-800 dark:bg-zinc-900 dark:ring-zinc-800">
          {FAQ.map(([q, a]) => (
            <Disclosure key={q} title={q} className="px-5 py-4" buttonClassName="w-full text-left text-zinc-900 dark:text-zinc-100">
              <p className="pl-6 text-sm text-zinc-500 dark:text-zinc-400">{a}</p>
            </Disclosure>
          ))}
        </div>
      </div>
    </div>
  );
}
