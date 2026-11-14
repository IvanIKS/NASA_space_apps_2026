import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { clampDays } from "@/features/select-point";
import { MAX_GRAPH_DAYS, MIN_GRAPH_DAYS } from "@/shared/config";
import { Minus, Plus } from "lucide-react";
import { Button, Input, Label } from "@/shared/ui";

interface Props {
  days: number;
  onChange: (days: number) => void;
}

const COMMIT_DELAY_MS = 500;

export function GraphWindow({ days, onChange }: Props) {
  const [text, setText] = useState(String(days));
  const timer = useRef<number>();

  useEffect(() => {
    setText(String(days));
  }, [days]);

  const commit = (raw: string) => {
    window.clearTimeout(timer.current);
    const next = clampDays(parseInt(raw, 10));
    setText(String(next));
    if (next !== days) onChange(next);
  };

  const handleChange = (raw: string) => {
    setText(raw);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(raw), COMMIT_DELAY_MS);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit(e.currentTarget.value);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const step = (delta: number) => commit(String(days + delta));

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Label htmlFor="graph-days" className="text-xs text-muted-foreground">Window</Label>
      <div className="inline-flex h-7 items-stretch overflow-hidden rounded-md border border-input bg-transparent">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-full w-6 rounded-none text-muted-foreground"
          onClick={() => step(-1)}
          disabled={days <= MIN_GRAPH_DAYS}
          aria-label="One day less"
        >
          <Minus />
        </Button>
        <Input
          id="graph-days"
          type="number"
          inputMode="numeric"
          min={MIN_GRAPH_DAYS}
          max={MAX_GRAPH_DAYS}
          step={1}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={handleKey}
          className="h-full w-11 rounded-none border-0 border-x border-input bg-transparent px-1 text-center text-xs tabular-nums shadow-none focus-visible:ring-0"
          aria-label="Graph window in days"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-full w-6 rounded-none text-muted-foreground"
          onClick={() => step(1)}
          disabled={days >= MAX_GRAPH_DAYS}
          aria-label="One day more"
        >
          <Plus />
        </Button>
      </div>
      <span>days</span>
    </div>
  );
}
