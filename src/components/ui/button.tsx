"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type UiButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type UiButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiButtonVariant;
  children: ReactNode;
};

const variantClassName: Record<UiButtonVariant, string> = {
  primary: "primary-button",
  secondary: "secondary-button",
  ghost: "ghost-button",
  danger: "danger-button"
};

export function UiButton({ variant = "ghost", className = "", children, ...props }: UiButtonProps) {
  const classes = [variantClassName[variant], className].filter(Boolean).join(" ");

  return (
    <button className={classes} type="button" {...props}>
      {children}
    </button>
  );
}
