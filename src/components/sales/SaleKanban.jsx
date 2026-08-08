import React from "react";
import { KANBAN_COLUMNS } from "./saleConstants";
import SaleCard from "./SaleCard";

export default function SaleKanban({ sales, onSelect, selectedId, loading }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  const columns = KANBAN_COLUMNS.map(col => ({
    ...col,
    sales: sales.filter(s => s.stage === col.key),
  }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 h-full">
      {columns.map(col => (
        <div key={col.key} className={`flex flex-col min-w-[240px] w-[240px] bg-muted/40 rounded-xl border-t-4 ${col.color}`}>
          <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
            <span className="text-xs font-semibold text-foreground">{col.label}</span>
            <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">{col.sales.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
            {col.sales.map(sale => (
              <SaleCard
                key={sale.id}
                sale={sale}
                onClick={() => onSelect(sale)}
                selected={selectedId === sale.id}
              />
            ))}
            {col.sales.length === 0 && (
              <div className="text-center text-xs text-muted-foreground/50 py-8">Vazio</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}