import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2 } from "lucide-react";

export default function GreetingMessagesEditor({ messages, onChange }) {
  const updateMessage = (index, value) => {
    const next = [...messages];
    next[index] = value;
    onChange(next);
  };

  const addMessage = () => onChange([...messages, ""]);
  const removeMessage = (index) => onChange(messages.filter((_, i) => i !== index));

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const next = [...messages];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase">Mensagens de Saudação</p>
        <button type="button" onClick={addMessage} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="greeting-messages">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">Nenhuma mensagem de saudação adicionada.</p>
              )}
              {messages.map((msg, index) => (
                <Draggable key={index} draggableId={`greeting-${index}`} index={index}>
                  {(dragProvided) => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} className="flex items-center gap-2">
                      <span {...dragProvided.dragHandleProps} className="cursor-grab text-muted-foreground">
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <input
                        value={msg}
                        onChange={(e) => updateMessage(index, e.target.value)}
                        placeholder={`Mensagem ${index + 1}`}
                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm"
                      />
                      <button type="button" onClick={() => removeMessage(index)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg">
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