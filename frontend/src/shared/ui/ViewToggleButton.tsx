import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./view-toggle.css";

type Icon = "person" | "globe";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: Icon;
  children: ReactNode;
}

const ICONS: Record<Icon, ReactNode> = {
  person: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="4.5" r="2.5" fill="currentColor" />
      <path d="M9 8h6l2 7h-2.2L14 11v10h-2v-6h-1v6H9V11l-.8 4H6z" fill="currentColor" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ),
};

/** Google-Maps-style pill in the bottom-right corner that switches between the globe and the surface view. */
export function ViewToggleButton({ icon, children, ...rest }: Props) {
  return (
    <button type="button" className="view-toggle" {...rest}>
      {ICONS[icon]}
      {children}
    </button>
  );
}
