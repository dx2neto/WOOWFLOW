import React, { useState } from "react";
import { PageContainer, Card } from "@/components/ui/app-card";
import { Plus, Pencil, Trash2, MessageSquareText } from "lucide-react";
import TemplateFormModal from "@/components/templates/TemplateFormModal";
import { useEntityList, useEntityCreate, useEntityUpdate, useEntityDelete } from "@/hooks/useEntityQueries";

const categoryLabels = {
  saudacao: "Saudação",
  financeiro: "Financeiro",
  cobranca: "Cobrança (Lembretes)",
  suporte_tecnico: "Suporte Técnico",
  comercial: "Comercial",
  despedida: "Despedida",
  outro: "Outro",
};

export default function MessageTemplates() {
  const { data: templates = [], isLoading: loading } = useEntityList("MessageTemplate", "-created_date", 200);
  const createMut = useEntityCreate("MessageTemplate");
  const updateMut = useEntityUpdate("MessageTemplate");
  const deleteMut = useEntityDelete("MessageTemplate");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const handleSave = async (data) => {
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data });
    } else {
      await createMut.mutateAsync(data);
    }
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    await deleteMut.mutateAsync(id);
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Templates de Mensagem</h2>
          <p className="text-sm text-muted-foreground">Textos padrão para agilizar o atendimento no chat</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Novo Template
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum template cadastrado ainda.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                  <MessageSquareText className="w-4 h-4 text-white" />
                </div>
                <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                  {categoryLabels[tpl.category] || tpl.category}
                </span>
              </div>
              <h3 className="font-semibold mb-1">{tpl.title}</h3>
              {tpl.shortcut && <p className="text-xs text-primary font-mono mb-2">{tpl.shortcut}</p>}
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3 whitespace-pre-wrap">{tpl.content}</p>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(tpl); setShowModal(true); }} className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border rounded-lg text-xs font-medium hover:bg-muted">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => handleDelete(tpl.id)} className="flex items-center justify-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <TemplateFormModal
          template={editing}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </PageContainer>
  );
}