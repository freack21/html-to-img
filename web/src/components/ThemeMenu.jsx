import { useTheme } from "../lib/theme.jsx";
import { Icon, Menu } from "./ui.jsx";

const OPTIONS = [
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
  { id: "system", label: "System", icon: "monitor" },
];

export function ThemeMenu() {
  const { theme, resolved, setTheme } = useTheme();
  return (
    <Menu
      aria-label="Color theme"
      items={OPTIONS.map((o) => ({ ...o, selected: theme === o.id, onSelect: () => setTheme(o.id) }))}
      trigger={(props) => (
        <button
          {...props}
          className="grid size-8 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Icon name={resolved === "dark" ? "moon" : "sun"} className="size-[18px]" />
        </button>
      )}
    />
  );
}
