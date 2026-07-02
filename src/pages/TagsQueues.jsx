import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/Card";
import { Tags, ListTree, Plus, Pencil, Trash2 } from "lucide-react";
import TagFormModal from "@/components/tagsqueues/TagFormModal";
import QueueFormModal from "@/components/tagsqueues/QueueFormModal";

const colorClasses = {
  blue: "bg-blue-100 text-blue-700", green: "bg-green-100 text-green-700", red: "bg-red-100 text-red-700",
  yellow: "bg-yellow-100 text-yellow-700", purple: "bg-purple-100 text-purple-700", gray: "bg-gray-100 text-gray-700",
  orange: "bg-orange-100 text-orange-700", pink: "bg-pink-100 text-pink-700",
};

export default function TagsQueues() {
  const [tab, setTab] = useState("tags");
  const [tags, setTags] = useState([]);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTagForm, setShowTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [showQueueForm, setShowQueueForm] = useState(false);
  const [editingQueue, setEditingQueue] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [tagsData, queuesData] = await Promise.all([
      base44.entities.Tag.list("-created_date"),
      base44.entities.Queue.list("-created_date"),
    ]);
    setTags(tagsData);
    setQueues(queuesData);
    setLoading(false);
  };

  const saveTag = async (data) => {
    if (editingTag) await base44.entities.Tag.update(editingTag.id, data);
    else await base44.entities.Tag.create(data);
    setShowTagForm(false); setEditingTag(null);
    await loadData();
  };

  const deleteTag = async (id) => { await base44.entities.Tag.delete(id); await loadData(); };

  const saveQueue = async (data) => {
    if (editingQueue) await base44.entities.Queue.update(editingQueue.id, data);
    else await base44.entities.Queue.create(data);
    setShowQueueForm(false); setEditingQueue(null);
    await loadData();
  };

  const deleteQueue = async (id) => { await base44.entities.Queue.delete(id); await loadData(); };

  const tabs = [
    { key: "tags", label: "Etiquetas", icon: Tags },
    { key: "queues", label: "Filas", icon: ListTree },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Etiquetas e Filas</h2>
          <p className="text-sm text-muted-foreground">Organize etiquetas e filas de atendimento</p>
        </div>
        {tab === "tags" ? (
          <button onClick={() => { setEditingTag(null); setShowTagForm(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nova Etiqueta
          </button>
        ) : (
          <button onClick={() => { setEditingQueue(null); setShowQueueForm(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nova Fila
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "tags" && (
        <Card className="p-6">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : tags.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhuma etiqueta cadastrada</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${colorClasses[tag.color] || colorClasses.blue}`}>{tag.name}</span>
                  <div className="flex-1" />
                  <button onClick={() => { setEditingTag(tag); setShowTagForm(true); }} className="p-1.5 hover:bg-muted rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteTag(tag.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "queues" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 font-medium">Nome</th>
                <th className="text-left px-5 py-3 font-medium">Setor</th>
                <th className="text-left px-5 py-3 font-medium">Descrição</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>
              ) : queues.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma fila cadastrada</td></tr>
              ) : (
                queues.map((q) => (
                  <tr key={q.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{q.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{q.sector}</td>
                    <td className="px-5 py-3 text-muted-foreground">{q.description || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${q.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {q.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="px-5 py-3 flex items-center gap-2">
                      <button onClick={() => { setEditingQueue(q); setShowQueueForm(true); }} className="p-1.5 hover:bg-muted rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteQueue(q.id)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {showTagForm && <TagFormModal tag={editingTag} onSave={saveTag} onClose={() => { setShowTagForm(false); setEditingTag(null); }} />}
      {showQueueForm && <QueueFormModal queue={editingQueue} onSave={saveQueue} onClose={() => { setShowQueueForm(false); setEditingQueue(null); }} />}
    </PageContainer>
  );
}