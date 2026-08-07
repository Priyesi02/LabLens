import { ReactNode } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";

export function Logo({ size = 38 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div
        className="flex items-center justify-center rounded-md bg-gradient-to-br from-teal-400 to-teal-500 text-white shadow-glow"
        style={{ width: size, height: size, borderRadius: size * 0.32 }}
      >
        <Activity size={size * 0.5} strokeWidth={2.4} />
      </div>
      <span className="font-display text-[19px] font-extrabold tracking-tightish text-ink">
        LabLens
      </span>
    </Link>
  );
}

export function PillBadge({
  children,
  tone = "teal",
}: {
  children: ReactNode;
  tone?: "teal" | "success" | "warning" | "danger" | "critical" | "neutral";
}) {
  const tones: Record<string, string> = {
    teal: "bg-teal-50 text-teal-600",
    success: "bg-status-success-bg text-status-success",
    warning: "bg-status-warning-bg text-status-warning",
    danger: "bg-status-danger-bg text-status-danger",
    critical: "bg-status-critical-bg text-status-critical",
    neutral: "bg-canvas-deep text-muted",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-bold tracking-wideish ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Avatar({
  label,
  size = 44,
}: {
  label: string;
  size?: number;
}) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-teal-50 font-bold text-teal-600"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {label}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-card shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 px-6 py-3 text-[14.5px] font-semibold text-white shadow-glow transition hover:shadow-glow-hover disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  href,
  onClick,
  className = "",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-full border border-line bg-card px-5 py-2.5 text-[13.5px] font-semibold text-ink shadow-sm transition hover:bg-canvas ${className}`;
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}