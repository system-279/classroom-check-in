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
    "border-amber-300 bg-white dark:border-amber-600 dark:bg-gray-900",
  info: "border-blue-300 bg-white dark:border-blue-600 dark:bg-gray-900",
  success:
    "border-green-300 bg-white dark:border-green-600 dark:bg-gray-900",
  error: "border-red-300 bg-white dark:border-red-600 dark:bg-gray-900",
};

const variantTitleStyles: Record<AlertBoxVariant, string> = {
  warning: "text-amber-900 dark:text-amber-300",
  info: "text-blue-900 dark:text-blue-300",
  success: "text-green-900 dark:text-green-300",
  error: "text-red-900 dark:text-red-300",
};

const variantTextStyles: Record<AlertBoxVariant, string> = {
  warning: "text-gray-700 dark:text-gray-300",
  info: "text-gray-700 dark:text-gray-300",
  success: "text-gray-700 dark:text-gray-300",
  error: "text-gray-700 dark:text-gray-300",
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
