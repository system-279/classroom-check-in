import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type AlertBoxVariant = "warning" | "info" | "success" | "error";

interface AlertBoxProps {
  variant?: AlertBoxVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<AlertBoxVariant, string> = {
  warning:
    "border-amber-200 bg-amber-50 dark:border-amber-700/50 dark:bg-slate-800",
  info: "border-blue-200 bg-blue-50 dark:border-blue-700/50 dark:bg-slate-800",
  success:
    "border-green-200 bg-green-50 dark:border-green-700/50 dark:bg-slate-800",
  error: "border-red-200 bg-red-50 dark:border-red-700/50 dark:bg-slate-800",
};

const variantTitleStyles: Record<AlertBoxVariant, string> = {
  warning: "text-amber-800 dark:text-amber-100",
  info: "text-blue-800 dark:text-blue-100",
  success: "text-green-800 dark:text-green-100",
  error: "text-red-800 dark:text-red-100",
};

const variantTextStyles: Record<AlertBoxVariant, string> = {
  warning: "text-amber-700 dark:text-amber-200/90",
  info: "text-blue-700 dark:text-blue-200",
  success: "text-green-700 dark:text-green-200",
  error: "text-red-700 dark:text-red-200",
};

export function AlertBox({
  variant = "info",
  title,
  children,
  className,
}: AlertBoxProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        variantStyles[variant],
        className
      )}
    >
      {title && (
        <h3
          className={cn(
            "mb-2 text-sm font-semibold",
            variantTitleStyles[variant]
          )}
        >
          {title}
        </h3>
      )}
      <div className={cn("text-sm", variantTextStyles[variant])}>{children}</div>
    </div>
  );
}
