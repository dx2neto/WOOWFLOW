import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, ArrowRightCircle, MessageCircle } from "lucide-react";

const typeConfig = {
  avancar_crm: { label: "Avançar CRM para Venda Fechada", icon: ArrowRightCircle, color: "text-green-600 bg-green-50" },
  enviar_whatsapp: { label: "Enviar mensagem WhatsApp", icon: MessageCircle, color: "text-blue-600 bg-blue-50" },
};

export default function AutomationStepCard({ step, index, onChangeMessage, onRemove }) {
  const cfg = typeConfig[step.type] || typeConfig.avancar_crm;
  const Icon = cfg.icon;

  return (
    <Draggable draggableId={`${step.type}-${index}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`bg-card border border-border rounded-lg p-3 mb-2 ${snapshot.isDragging ? "shadow-lg" : ""}`}
        >
          <div className="flex items-start gap-2">
            <span {...provided.dragHandleProps} className="cursor-grab pt-1">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{cfg.label}</p>
              {step.type === "enviar_whatsapp" && (
                <textarea
                  value={step.message || ""}
                  onChange={(e) => onChangeMessage(index, e.target.value)}
                  placeholder="Digite a mensagem que será enviada..."
                  className="w-full mt-2 text-sm p-2 bg-muted/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  rows={2}
                />
              )}
            </div>
            <button onClick={() => onRemove(index)} className="p-1.5 hover:bg-muted rounded-lg flex-shrink-0">
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
}