import React, { useState, useEffect } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { useEntityList, useEntityCreate, useEntityUpdate } from "@/hooks/useEntityQueries";
import { PageContainer } from "@/components/ui/app-card";
import AutomationColumn from "@/components/automations/AutomationColumn";

const TRIGGERS = [
  { trigger: "contrato_assinado", title: "Contrato Assinado", description: "Ações executadas quando o contrato é assinado no ZapSign" },
  { trigger: "pagamento_confirmado", title: "Pagamento Confirmado", description: "Ações executadas quando o pagamento é confirmado no IXC" },
];

export default function CrmAutomations() {
  const { data: allFlows = [], isLoading } = useEntityList("AutomationFlow", "-created_date", 50);
  const flowCreate = useEntityCreate("AutomationFlow");
  const flowUpdate = useEntityUpdate("AutomationFlow");

  // Index flows by trigger
  const [flows, setFlows] = useState({});
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isLoading || creating) return;
    const map = {};
    allFlows.forEach((f) => { map[f.trigger] = f; });
    const missing = TRIGGERS.filter((t) => !map[t.trigger]);
    if (missing.length > 0) {
      setCreating(true);
      Promise.all(
        missing.map((t) =>
          flowCreate.mutateAsync({
            name: t.title,
            trigger: t.trigger,
            active: true,
            steps: [{ type: "avancar_crm", label: "Avançar CRM" }],
          })
        )
      ).finally(() => setCreating(false));
    } else {
      setFlows(map);
    }
  }, [allFlows, isLoading]);

  const persist = async (trigger, steps) => {
    setFlows((prev) => ({ ...prev, [trigger]: { ...prev[trigger], steps } }));
    await flowUpdate.mutateAsync({ id: flows[trigger].id, data: { steps } });
  };

  const handleAddStep = (trigger, type) => {
    const steps = [...(flows[trigger].steps || []), { type, message: type === "enviar_whatsapp" ? "" : undefined }];
    persist(trigger, steps);
  };

  const handleChangeMessage = (trigger, index, message) => {
    const steps = flows[trigger].steps.map((s, i) => (i === index ? { ...s, message } : s));
    persist(trigger, steps);
  };

  const handleRemoveStep = (trigger, index) => {
    const steps = flows[trigger].steps.filter((_, i) => i !== index);
    persist(trigger, steps);
  };

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination || source.droppableId !== destination.droppableId) return;
    const trigger = source.droppableId;
    const steps = Array.from(flows[trigger].steps);
    const [moved] = steps.splice(source.index, 1);
    steps.splice(destination.index, 0, moved);
    persist(trigger, steps);
  };

  if (isLoading) {
    return (
      <PageContainer>
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Automações do CRM</h2>
        <p className="text-sm text-muted-foreground">Arraste e solte para definir a ordem das ações automáticas de cada gatilho</p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex flex-col md:flex-row gap-4">
          {TRIGGERS.map((t) => (
            <AutomationColumn
              key={t.trigger}
              title={t.title}
              description={t.description}
              droppableId={t.trigger}
              steps={flows[t.trigger]?.steps || []}
              onAddStep={(type) => handleAddStep(t.trigger, type)}
              onChangeMessage={(index, message) => handleChangeMessage(t.trigger, index, message)}
              onRemoveStep={(index) => handleRemoveStep(t.trigger, index)}
            />
          ))}
        </div>
      </DragDropContext>
    </PageContainer>
  );
}