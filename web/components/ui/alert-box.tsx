import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type AlertBoxVariant = "warning" | "info" | "success" | "error";

interface AlertBoxProps {
  variant?: AlertBoxVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

// Tailwind公式パターン: bg-{color}-100 + border-{color}-400 + text-{color}-700
const variantStyles: Record<AlertBoxVariant, string> = {
  warning:
    "border-orange-400 bg-orange-100 text-orange-700 dark:border-orange-500 dark:bg-orange-900/20 dark:text-orange-200",
  info: "border-blue-400 bg-blue-100 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-200",
  success:
    "border-green-400 bg-green-100 text-green-700 dark:border-green-500 dark:bg-green-900/20 dark:text-green-200",
  error: "border-red-400 bg-red-100 text-red-700 dark:border-red-500 dark:bg-red-900/20 dark:text-red-200",
};

const variantTitleStyles: Record<AlertBoxVariant, string> = {
  warning: "text-orange-800 dark:text-orange-100",
  info: "text-blue-800 dark:text-blue-100",
  success: "text-green-800 dark:text-green-100",
  error: "text-red-800 dark:text-red-100",
};

const variantTextStyles: Record<AlertBoxVariant, string> = {
  warning: "text-orange-700 dark:text-orange-200",
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
