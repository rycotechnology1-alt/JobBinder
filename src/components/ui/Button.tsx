import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-brand text-white hover:bg-brand-hover shadow-lg shadow-brand/20",
      secondary: "bg-zinc-800 text-zinc-50 hover:bg-zinc-700",
      outline: "border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-300",
      ghost: "bg-transparent hover:bg-zinc-800 text-zinc-300",
      danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
    };

    const sizes = {
      sm: "h-9 px-3 text-sm",
      md: "h-11 px-4",
      lg: "h-14 px-6 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
