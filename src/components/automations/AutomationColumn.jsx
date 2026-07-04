import React, { useState } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Plus } from "lucide-react";
import AutomationStepCard from "./AutomationStepCard";

export default function AutomationColumn({ title, description, droppableId, steps, onAddStep, onChangeMessage, onRemoveStep }) {
  const [showAdd, setShowAdd] = useState(false);

  const handleAdd = (type) => {
    onAddStep(type);
    setShowAdd(false);
  };

  return (
    <div className="flex-1 min-w-[320px] bg-muted/30 rounded-xl p-4">
      <h3 className="font-semibold font-heading">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>

      <Droppable droppableId={droppableId}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[60px]">
            {steps.map((step, index) => (
              <AutomationStepCard
                key={index}
                step={step}
                index={index}
                onChangeMessage={onChangeMessage}
                onRemove={onRemoveStep}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <div className="relative">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-2 mt-1 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50"
        >
          <Plus className="w-4 h-4" /> Adicionar ação
        </button>
        {showAdd && (
          <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <button onClick={() => handleAdd("avancar_crm")} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50">
              Avançar CRM para Venda Fechada
            </button>
            <button onClick={() => handleAdd("enviar_whatsapp")} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50">
              Enviar mensagem WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}