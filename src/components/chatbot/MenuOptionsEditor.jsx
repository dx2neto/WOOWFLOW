import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2 } from "lucide-react";

export default function MenuOptionsEditor({ options, onChange }) {
  const updateOption = (index, field, value) => {
    const next = [...options];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const addOption = () => onChange([...options, { digit: "", label: "", destination: "" }]);
  const removeOption = (index) => onChange(options.filter((_, i) => i !== index));

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const next = [...options];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase">Opções do Menu (URA)</p>
        <button type="button" onClick={addOption} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="menu-options">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">Nenhuma opção de menu adicionada.</p>
              )}
              {options.map((opt, index) => (
                <Draggable key={index} draggableId={`menu-option-${index}`} index={index}>
                  {(dragProvided) => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="flex items-center gap-2">
                      <span {...dragProvided.dragHandleProps} className="cursor-grab text-muted-foreground">
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <input
                        value={opt.digit}
                        onChange={(e) => updateOption(index, "digit", e.target.value)}
                        placeholder="Dígito"
                        className="w-16 px-2 py-2 border border-border rounded-lg text-sm text-center"
                      />
                      <input
                        value={opt.label}
                        onChange={(e) => updateOption(index, "label", e.target.value)}
                        placeholder="Descrição da opção"
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
                      />
                      <input
                        value={opt.destination}
                        onChange={(e) => updateOption(index, "destination", e.target.value)}
                        placeholder="Destino"
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
                      />
                      <button type="button" onClick={() => removeOption(index)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}