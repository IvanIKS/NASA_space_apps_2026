import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { clampDays } from "@/features/select-point";
import { MAX_GRAPH_DAYS, MIN_GRAPH_DAYS } from "@/shared/config";
import { Input, Label } from "@/shared/ui";

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

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Label htmlFor="graph-days" className="text-xs text-muted-foreground">Window</Label>
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
        className="h-7 w-16 px-2 text-right text-xs tabular-nums"
        aria-label="Graph window in days"
      />
      <span>days</span>
    </div>
  );
}
