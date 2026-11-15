import type { ComponentProps } from "react";
import { Globe, Mountain, PersonStanding } from "lucide-react";
import { cn } from "@/shared/lib";
import { Button } from "./button";

const ICONS = { person: PersonStanding, globe: Globe, mountain: Mountain } as const;

interface Props extends ComponentProps<typeof Button> {
  icon: keyof typeof ICONS;
  pressed?: boolean;
}

export function ViewToggleButton({ icon, pressed, className, children, ...rest }: Props) {
  const Icon = ICONS[icon];
  return (
    <Button
      variant="outline"
      aria-pressed={pressed}
      className={cn(
        "rounded-full bg-card/90 pr-3.5 pl-2.5 shadow-lg shadow-black/50",
        "hover:border-primary hover:text-primary disabled:opacity-45",
        pressed && "border-primary text-primary",
        className
      )}
      {...rest}
    >
      <Icon />
      {children}
    </Button>
  );
}
