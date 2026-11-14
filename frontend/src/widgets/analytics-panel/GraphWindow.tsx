import { GRAPH_WINDOWS_DAYS } from "@/shared/config";
import { cn } from "@/shared/lib";

interface Props {
  days: number;
  onChange: (days: number) => void;
}

export function GraphWindow({ days, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5 text-xs" role="radiogroup" aria-label="Graph window">
      {GRAPH_WINDOWS_DAYS.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={d === days}
          className={cn(
            "rounded px-2 py-0.5 tabular-nums transition-colors",
            d === days ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onChange(d)}
        >
          {d} d
        </button>
      ))}
    </div>
  );
}
