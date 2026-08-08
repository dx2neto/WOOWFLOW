import React from "react";

export default function MetricsBar({ metrics }) {
  return (
    <div className="grid flex-shrink-0 border-t border-border bg-card" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0,1fr))` }}>
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div key={metric.label} className="border-r border-border px-4 py-3 last:border-r-0">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[11px] font-semibold text-muted-foreground">{metric.label}</p>
              <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            </div>
            <p className="mt-0.5 text-xl font-black">{metric.value}</p>
          </div>
        );
      })}
    </div>
  );
}