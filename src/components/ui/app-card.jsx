import React from "react";
import { cn } from "@/utils";

/**
 * @param {{ title?: React.ReactNode, value?: React.ReactNode, icon?: any, trend?: number, color?: string, subtitle?: React.ReactNode }} props
 */
export function StatCard({ title, value, icon: Icon, trend, color = "primary", subtitle }) {
  const colorMap = {
    primary: "from-blue-500 to-blue-600",
    accent: "from-green-500 to-green-600",
    warning: "from-amber-500 to-orange-500",
    danger: "from-red-500 to-rose-600",
    purple: "from-purple-500 to-violet-600",
    indigo: "from-indigo-500 to-blue-600",
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-11 h-11 rounded-lg bg-gradient-to-br flex items-center justify-center", colorMap[color])}>
          {Icon && <Icon className="w-5 h-5 text-white" />}
        </div>
        {trend !== undefined && (
          <span className={cn("text-xs font-semibold", trend >= 0 ? "text-green-600" : "text-red-600")}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold font-heading">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>}
    </div>
  );
}

/**
 * @param {{ children?: React.ReactNode, className?: string, title?: React.ReactNode, action?: React.ReactNode }} props
 */
export function Card({ children, className, title, action }) {
  return (
    <div className={cn("bg-card rounded-xl border border-border", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          {title && <h3 className="font-semibold font-heading">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * @param {{ children?: React.ReactNode, className?: string }} props
 */
export function PageContainer({ children, className }) {
  return (
    <div className={cn("h-full overflow-y-auto scrollbar-thin", className)}>
      <div className="p-6 max-w-[1600px] mx-auto">
        {children}
      </div>
    </div>
  );
}