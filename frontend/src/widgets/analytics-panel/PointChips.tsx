import { Plus, X } from "lucide-react";
import { pointLabel, type Selection, type SelectionActions } from "@/features/select-point";
import { MAX_POINTS, POINT_COLORS } from "@/shared/config";
import { cn } from "@/shared/lib";
import { Button } from "@/shared/ui";

interface Props {
  selection: Selection;
  actions: SelectionActions;
}

export function PointChips({ selection, actions }: Props) {
  const { points, active, adding } = selection;
  const full = points.length >= MAX_POINTS;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {points.map((p, i) => (
        <div
          key={i}
          className={cn(
            "inline-flex h-7 items-center overflow-hidden rounded-full border text-xs",
            i === active && !adding
              ? "border-foreground/30 bg-secondary text-foreground"
              : "border-border text-muted-foreground"
          )}
        >
          <button
            type="button"
            className="inline-flex h-full items-center gap-1.5 pr-1 pl-2 hover:text-foreground"
            onClick={() => actions.activate(i)}
            title={`Show point ${pointLabel(i)}`}
          >
            <span className="size-2 rounded-full" style={{ background: POINT_COLORS[i] }} />
            <span className="font-semibold">{pointLabel(i)}</span>
            <span className="tabular-nums">{p.lat.toFixed(2)}, {p.lon.toFixed(2)}</span>
          </button>
          <button
            type="button"
            className="inline-flex h-full items-center pr-1.5 pl-0.5 hover:text-destructive"
            onClick={() => actions.remove(i)}
            aria-label={`Remove point ${pointLabel(i)}`}
          >
            <X className="size-3" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-primary/70 pr-1.5 pl-2.5 text-xs text-primary">
          <span className="size-2 animate-pulse rounded-full" style={{ background: POINT_COLORS[points.length] }} />
          Click the Moon to add {pointLabel(points.length)}
          <button type="button" className="inline-flex items-center hover:text-foreground" onClick={actions.cancelAdd} aria-label="Cancel">
            <X className="size-3" />
          </button>
        </div>
      ) : points.length === 0 ? null : (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7 rounded-full text-muted-foreground"
          onClick={actions.startAdd}
          disabled={full}
          title={full ? `Up to ${MAX_POINTS} points` : "Add a point to compare"}
        >
          <Plus /> Add point
        </Button>
      )}
    </div>
  );
}
