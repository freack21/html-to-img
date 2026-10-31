import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Badge, Icon, Skeleton } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";

const STEPS = [
  { icon: "grid", title: "Pick a template", text: "Chat bubbles, tweets, quotes, certificates, thumbnails and more." },
  { icon: "settings", title: "Customize it", text: "Fill in text, colors and images with a live preview as you type." },
  { icon: "download", title: "Render anywhere", text: "Download from the studio or call one API endpoint from your app." },
];

const FEATURES = [
  { icon: "zap", title: "Fast, no headless browser", text: "Templates render straight to PNG, JPEG or SVG — typically in well under a second." },
  { icon: "layout", title: "Templates as JSON", text: "Admins design and edit templates in the browser with a live preview. No redeploys." },
  { icon: "image", title: "Crisp output", text: "Up to 4× resolution, transparent PNGs, vector SVGs and Twemoji emoji support." },
  { icon: "key", title: "API keys & quotas", text: "Per-user keys, monthly quotas and plans built in. Usage shows up in your dashboard." },
  { icon: "link", title: "Bytes or links", text: "Get the image directly, or a hosted URL that expires on your plan's schedule." },
  { icon: "shield", title: "Safe by default", text: "Typed, validated params and locked-down image fetching keep untrusted input contained." },
];

function GridBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/2 h-[32rem] w-[56rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-400/30 via-fuchsia-400/20 to-sky-400/20 blur-3xl dark:from-violet-600/20 dark:via-fuchsia-600/10 dark:to-sky-600/10" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(0_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0/0.04)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)] bg-[size:48px_48px] dark:bg-[linear-gradient(to_right,rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.05)_1px,transparent_1px)]" />
    </div>
  );
}

function HeroVisual() {
  const origin = window.location.origin;
  return (
    <div className="relative mx-auto mt-14 max-w-5xl">
      <div className="grid overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 shadow-violet-900/10 ring-zinc-200 md:grid-cols-2 dark:bg-zinc-900 dark:shadow-black/40 dark:ring-zinc-800">
        <div className="bg-zinc-950 p-5 text-left">
          <div className="mb-4 flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <pre className="overflow-x-auto text-[12px] leading-relaxed text-zinc-300">
            <span className="text-fuchsia-400">curl</span> -X POST {origin}/api/v1/render \{"\n"}
            {"  "}-H <span className="text-emerald-300">"Authorization: Bearer $KEY"</span> \{"\n"}
            {"  "}-d <span className="text-emerald-300">{`'{"template": "tweet",`}</span>{"\n"}
            {"       "}
            <span className="text-emerald-300">{`"params": {"username": "Fikri"}}'`}</span> \{"\n"}
            {"  "}-o <span className="text-sky-300">tweet.png</span>
          </pre>
        </div>
        <div className="checkerboard grid min-h-56 place-items-center p-6">
          <img src="/api/v1/templates/tweet/thumbnail.png" alt="A rendered tweet card" className="max-h-64 w-auto rounded-md shadow-lg" />
        </div>
      </div>
    </div>
  );
}

function Showcase() {
  const [templates, setTemplates] = useState(null);
  useEffect(() => {
    api("/templates").then(setTemplates).catch(() => setTemplates([]));
  }, []);
  return (
    <section className="py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Templates</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Start from a ready-made design</h2>
        </div>
        <Link to="/studio" className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400">
          Browse all in the studio <Icon name="chevronRight" className="size-4" />
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(templates ?? Array.from({ length: 8 }, () => null)).slice(0, 8).map((t, i) =>
          t ? (
            <Link
              key={t.slug}
              to={`/studio?t=${t.slug}`}
              className="group overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-900/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-zinc-900 dark:ring-zinc-800"
            >
              <div className="checkerboard flex h-40 items-center justify-center overflow-hidden p-4">
                <img src={`/api/v1/templates/${t.slug}/thumbnail.png?v=${t.version}`} alt="" loading="lazy" className="max-h-32 max-w-full object-contain drop-shadow transition group-hover:scale-105" />
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-zinc-500 capitalize">{t.category}</p>
                </div>
                {t.isPremium && <Badge tone="amber">Pro</Badge>}
              </div>
            </Link>
          ) : (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ),
        )}
      </div>
    </section>
  );
}

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="-mt-8 sm:-mt-10">
      <section className="relative isolate pt-16 pb-10 text-center sm:pt-24">
        <GridBackground />
        <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 backdrop-blur dark:bg-zinc-900/70 dark:text-zinc-300 dark:ring-zinc-800">
          <Icon name="sparkles" className="size-3.5 text-violet-500" /> JSON templates · PNG, JPEG & SVG · REST API
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          Turn templates into{" "}
          <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-fuchsia-400">images</span>,
          instantly.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-zinc-600 dark:text-zinc-400">
          Design once, render thousands. Fill in a template in the studio or with one API call and get a pixel-perfect image back.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            Open the studio <Icon name="chevronRight" className="size-4" />
          </Link>
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-zinc-900 dark:ring-zinc-700 dark:hover:bg-zinc-800"
          >
            <Icon name="code" className="size-4" /> Read the API docs
          </Link>
        </div>
        <p className="mt-4 text-xs text-zinc-500">{user ? `Welcome back, ${user.name}.` : "Try it without an account · free plan available"}</p>
        <HeroVisual />
      </section>

      <Showcase />

      <section className="py-16">
        <div className="text-center">
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">How it works</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Three steps to your first image</h2>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-2xl bg-white p-6 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
              <span className="absolute top-6 right-6 text-5xl font-bold text-zinc-100 dark:text-zinc-800">{i + 1}</span>
              <div className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400">
                <Icon name={step.icon} className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Features</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Everything you need to generate images at scale</h2>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-200 sm:grid-cols-2 lg:grid-cols-3 dark:bg-zinc-800 dark:ring-zinc-800">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white p-6 dark:bg-zinc-950">
              <Icon name={f.icon} className="size-5 text-violet-600 dark:text-violet-400" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16">
        <div className="relative isolate overflow-hidden rounded-3xl bg-zinc-950 px-6 py-14 text-center sm:px-16">
          <div aria-hidden="true" className="absolute -top-24 left-1/2 -z-10 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-violet-600/40 blur-3xl" />
          <h2 className="text-3xl font-semibold tracking-tight text-white">Ready to render your first image?</h2>
          <p className="mx-auto mt-3 max-w-md text-zinc-400">Start in the studio as a guest, or create a free account for watermark-free renders and an API key.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={user ? "/studio" : "/register"} className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-200">
              {user ? "Open the studio" : "Create a free account"}
            </Link>
            <Link to="/pricing" className="rounded-xl px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/10">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
