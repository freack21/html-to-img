import { useEffect, useRef, useState } from "react";
import { Alert, Card, Disclosure, PageHeader, Spinner } from "../../components/ui.jsx";
import { api, formatNumber } from "../../lib/api.js";

function Stat({ label, value, hint }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </Card>
  );
}

/** Fills missing days so the time axis is continuous. */
function last30Days(daily) {
  const counts = Object.fromEntries(daily.map((d) => [d.day, d.renders]));
  return Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
    return { day, renders: counts[day] ?? 0 };
  });
}

function niceMax(value) {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

/** Single-series column chart: one hue, no legend, hover tooltip, table fallback. */
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function DailyChart({ daily }) {
  const [hover, setHover] = useState(null);
  const [ref, W] = useWidth();
  const data = last30Days(daily);
  const max = niceMax(Math.max(...data.map((d) => d.renders)));
  const H = 180;
  const pad = { top: 8, right: 8, bottom: 20, left: 32 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(14, slot - 2);
  const y = (v) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];

  return (
    <div className="relative" ref={ref}>
      <svg width={W} height={H} className="block" role="img" aria-label="Renders per day, last 30 days">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="1" />
            <text x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500 text-[11px] tabular-nums">
              {formatNumber(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const h = Math.max(0, (d.renders / max) * innerH);
          const r = Math.min(4, h, barW / 2);
          const top = y(d.renders);
          const base = pad.top + innerH;
          // Rounded data-end, square at the baseline.
          const path = h
            ? `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`
            : "";
          return (
            <g key={d.day} onMouseEnter={() => setHover({ ...d, x: x + barW / 2 })} onMouseLeave={() => setHover(null)}>
              <rect x={pad.left + i * slot} y={pad.top} width={slot} height={innerH} fill="transparent" />
              {path && (
                <path d={path} className={hover && hover.day !== d.day ? "fill-violet-600/50 dark:fill-violet-500/50" : "fill-violet-600 dark:fill-violet-500"} />
              )}
            </g>
          );
        })}
        {[0, 14, 29].map((i) => (
          <text key={i} x={pad.left + i * slot + slot / 2} y={H - 4} textAnchor="middle" className="fill-zinc-500 text-[11px]">
            {data[i].day.slice(5)}
          </text>
        ))}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute top-0 rounded-md bg-zinc-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow dark:bg-zinc-100 dark:text-zinc-900"
          style={{
            left: hover.x,
            // Keep the tooltip inside the chart near either edge.
            transform: `translateX(${hover.x > W * 0.85 ? "-100%" : hover.x < W * 0.15 ? "0" : "-50%"})`,
          }}
        >
          {hover.day}: <strong>{formatNumber(hover.renders)}</strong> renders
        </div>
      )}
      <Disclosure title="Show as table" className="mt-2" buttonClassName="text-xs font-normal text-zinc-500">
        <table className="text-xs text-zinc-500">
          <tbody>
            {data.filter((d) => d.renders).map((d) => (
              <tr key={d.day}>
                <td className="pr-4">{d.day}</td>
                <td className="tabular-nums">{d.renders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Disclosure>
    </div>
  );
}

function RankedList({ rows, labelKey, valueKey }) {
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row[labelKey]} className="text-sm">
          <div className="flex justify-between">
            <span>{row[labelKey]}</span>
            <span className="tabular-nums text-zinc-500">{formatNumber(row[valueKey])}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-violet-600 dark:bg-violet-500" style={{ width: `${(row[valueKey] / max) * 100}%` }} />
          </div>
        </li>
      ))}
      {rows.length === 0 && <li className="text-sm text-zinc-500">No data yet.</li>}
    </ul>
  );
}

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api("/admin/stats").then(setStats).catch(setError);
  }, []);

  if (error) return <Alert>{error.message}</Alert>;
  if (!stats) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="Overview" description="Activity over the last 30 days." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Renders today" value={formatNumber(stats.rendersToday)} />
        <Stat label="Renders (30d)" value={formatNumber(stats.renders30d)} hint={`${formatNumber(stats.guestRenders30d)} by guests`} />
        <Stat label="Users" value={formatNumber(stats.users)} />
        <Stat label="Avg render time" value={`${stats.avgDurationMs} ms`} hint={`${stats.templates} active templates`} />
      </div>
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Renders per day</h2>
        <DailyChart daily={stats.daily} />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Top templates</h2>
          <RankedList rows={stats.topTemplates} labelKey="template" valueKey="renders" />
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Users by plan</h2>
          <RankedList rows={stats.usersByPlan} labelKey="plan" valueKey="users" />
        </Card>
      </div>
    </div>
  );
}
