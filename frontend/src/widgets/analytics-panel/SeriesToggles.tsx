import type { SeriesVisibility } from "@/entities/insolation";
import { Checkbox, Label } from "@/shared/ui";

interface Props {
  visible: SeriesVisibility;
  onChange: (visible: SeriesVisibility) => void;
}

export function SeriesToggles({ visible, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <div className="flex items-center gap-1.5">
        <Checkbox
          id="show-insolation"
          checked={visible.insolation}
          disabled={visible.insolation && !visible.earth}
          onCheckedChange={(v) => onChange({ ...visible, insolation: v === true })}
        />
        <Label htmlFor="show-insolation" className="text-xs">Insolation</Label>
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox
          id="show-earth"
          checked={visible.earth}
          disabled={visible.earth && !visible.insolation}
          onCheckedChange={(v) => onChange({ ...visible, earth: v === true })}
        />
        <Label htmlFor="show-earth" className="text-xs">Earth elevation</Label>
      </div>
    </div>
  );
}
