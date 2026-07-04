import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/app-card";
import { Plus, Search, BookOpen, Tag, Edit, Trash2 } from "lucide-react";

const categoryConfig = {
  financeiro: { label: "Financeiro", color: "bg-green-100 text-green-700" },
  suporte_tecnico: { label: "Suporte Técnico", color: "bg-blue-100 text-blue-700" },
  comercial: { label: "Comercial", color: "bg-amber-100 text-amber-700" },
  planos: { label: "Planos", color: "bg-purple-100 text-purple-700" },
  contratos: { label: "Contratos", color: "bg-indigo-100 text-indigo-700" },
  instalacao: { label: "Instalação", color: "bg-teal-100 text-teal-700" },
  cancelamento: { label: "Cancelamento", color: "bg-red-100 text-red-700" },
  retencao: { label: "Retenção", color: "bg-rose-100 text-rose-700" },
  faq: { label: "FAQ", color: "bg-gray-100 text-gray-700" },
  procedimentos: { label: "Procedimentos", color: "bg-sky-100 text-sky-700" },
};

export default function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => { loadArticles(); }, []);

  const loadArticles = async () => {
    try {
      const data = await base44.entities.KnowledgeArticle.list("-created_date", 100);
      setArticles(data);
    } catch { setArticles([]); } finally { setLoading(false); }
  };

  const filtered = articles.filter((a) => {
    const matchSearch = a.title?.toLowerCase().includes(search.toLowerCase()) || a.content?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "all" || a.category === category;
    return matchSearch && matchCategory;
  });

  const categories = Object.keys(categoryConfig);

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Base de Conhecimento</h2>
          <p className="text-sm text-muted-foreground">Artigos usados pela IA e atendentes</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Novo Artigo
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar artigo..."
            className="w-full h-10 pl-9 pr-4 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((cat) => <option key={cat} value={cat}>{categoryConfig[cat].label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">Carregando artigos...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">Nenhum artigo encontrado</div>
        ) : (
          filtered.map((article) => (
            <Card key={article.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${categoryConfig[article.category]?.color || categoryConfig.faq.color}`}>
                  {categoryConfig[article.category]?.label || article.category}
                </span>
              </div>
              <h3 className="font-semibold mb-2">{article.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{article.content}</p>
              {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {article.tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      <Tag className="w-2.5 h-2.5" /> {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className={`text-xs ${article.active ? "text-green-600" : "text-muted-foreground"}`}>{article.active ? "● Ativo" : "○ Inativo"}</span>
                <div className="flex gap-1">
                  <button className="p-1.5 hover:bg-muted rounded-lg"><Edit className="w-4 h-4 text-muted-foreground" /></button>
                  <button className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}