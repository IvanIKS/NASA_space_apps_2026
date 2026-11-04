import type { ComponentProps } from "react";
import { Globe, PersonStanding } from "lucide-react";
import { cn } from "@/shared/lib";
import { Button } from "./button";

const ICONS = { person: PersonStanding, globe: Globe } as const;

interface Props extends ComponentProps<typeof Button> {
  icon: keyof typeof ICONS;
}

/** Google-Maps-style pill in the bottom-right corner that switches between the globe and the surface view. */
export function ViewToggleButton({ icon, className, children, ...rest }: Props) {
  const Icon = ICONS[icon];
  return (
    <Button
      variant="outline"
      className={cn(
        "absolute right-4 bottom-4 rounded-full bg-card/90 pr-3.5 pl-2.5 shadow-lg shadow-black/50",
        "hover:border-primary hover:text-primary disabled:opacity-45",
        className
      )}
      {...rest}
    >
      <Icon />
      {children}
    </Button>
  );
}
