import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, StatCard, Card } from "@/components/ui/Card";
import { Plus, Send, CheckCircle, Eye, MessageSquare, Calendar, Instagram, Image as ImageIcon, Film, Clock, Trash2 } from "lucide-react";
import InstagramPostForm from "@/components/campaigns/InstagramPostForm";
import ContentCalendar from "@/components/campaigns/ContentCalendar";

const typeConfig = {
  cobranca: { label: "Cobrança", color: "bg-red-100 text-red-700" },
  promocao: { label: "Promoção", color: "bg-green-100 text-green-700" },
  manutencao: { label: "Manutenção", color: "bg-amber-100 text-amber-700" },
  instabilidade: { label: "Instabilidade", color: "bg-orange-100 text-orange-700" },
  pesquisa: { label: "Pesquisa", color: "bg-blue-100 text-blue-700" },
  pos_venda: { label: "Pós-venda", color: "bg-purple-100 text-purple-700" },
  retencao: { label: "Retenção", color: "bg-indigo-100 text-indigo-700" },
  upgrade: { label: "Upgrade", color: "bg-teal-100 text-teal-700" },
  aniversario: { label: "Aniversário", color: "bg-pink-100 text-pink-700" },
  renovacao: { label: "Renovação", color: "bg-sky-100 text-sky-700" },
};

const statusConfig = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-700" },
  agendada: { label: "Agendada", color: "bg-blue-100 text-blue-700" },
  enviando: { label: "Enviando", color: "bg-amber-100 text-amber-700" },
  concluida: { label: "Concluída", color: "bg-green-100 text-green-700" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-700" },
};

const igTypeConfig = {
  feed: { label: "Feed", icon: ImageIcon, color: "bg-purple-100 text-purple-700" },
  reel: { label: "Reel", icon: Film, color: "bg-pink-100 text-pink-700" },
  story: { label: "Story", icon: Instagram, color: "bg-orange-100 text-orange-700" },
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("whatsapp");
  const [showPostForm, setShowPostForm] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try {
      const data = await base44.entities.Campaign.list("-created_date", 50);
      setCampaigns(data);
    } catch (e) { setCampaigns([]); } finally { setLoading(false); }
  };

  const handleSavePost = async (postData) => {
    try {
      await base44.entities.Campaign.create(postData);
      await loadCampaigns();
      setShowPostForm(false);
    } catch (e) {
      console.error("Erro ao agendar postagem:", e);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await base44.entities.Campaign.delete(postId);
      setSelectedPost(null);
      await loadCampaigns();
    } catch (e) {
      console.error("Erro ao excluir postagem:", e);
    }
  };

  const whatsappCampaigns = campaigns.filter((c) => !c.channel || c.channel === "whatsapp");
  const instagramPosts = campaigns.filter((c) => c.channel === "instagram");

  const totalSent = whatsappCampaigns.reduce((s, c) => s + (c.total_sent || 0), 0);
  const totalDelivered = whatsappCampaigns.reduce((s, c) => s + (c.total_delivered || 0), 0);
  const totalRead = whatsappCampaigns.reduce((s, c) => s + (c.total_read || 0), 0);
  const totalReplied = whatsappCampaigns.reduce((s, c) => s + (c.total_replied || 0), 0);

  const igScheduled = instagramPosts.filter((p) => p.status === "agendada").length;
  const igDrafts = instagramPosts.filter((p) => p.status === "rascunho").length;
  const igPublished = instagramPosts.filter((p) => p.status === "concluida").length;

  const tabs = [
    { key: "whatsapp", label: "Campanhas WhatsApp", icon: Send },
    { key: "instagram", label: "Instagram", icon: Instagram },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Campanhas</h2>
          <p className="text-sm text-muted-foreground">Disparos em massa e gestão de conteúdo</p>
        </div>
        {activeTab === "whatsapp" ? (
          <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nova Campanha
          </button>
        ) : (
          <button
            onClick={() => setShowPostForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Nova Postagem
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "whatsapp" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total Enviado" value={totalSent} icon={Send} color="primary" />
            <StatCard title="Entregues" value={totalDelivered} icon={CheckCircle} color="accent" />
            <StatCard title="Lidos" value={totalRead} icon={Eye} color="indigo" />
            <StatCard title="Respondidos" value={totalReplied} icon={MessageSquare} color="purple" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">Carregando campanhas...</div>
            ) : whatsappCampaigns.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">Nenhuma campanha encontrada</div>
            ) : (
              whatsappCampaigns.map((c) => (
                <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${typeConfig[c.type]?.color || typeConfig.promocao.color}`}>
                        {typeConfig[c.type]?.label || c.type}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusConfig[c.status]?.color || statusConfig.rascunho.color}`}>
                        {statusConfig[c.status]?.label || c.status}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2">{c.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{c.message_template || "Sem template definido"}</p>
                  {c.segment && <p className="text-xs text-muted-foreground mb-3">📋 Segmento: {c.segment}</p>}

                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="text-center p-2 bg-muted/40 rounded-lg">
                      <p className="text-sm font-bold">{c.total_sent || 0}</p>
                      <p className="text-xs text-muted-foreground">Enviado</p>
                    </div>
                    <div className="text-center p-2 bg-muted/40 rounded-lg">
                      <p className="text-sm font-bold">{c.total_delivered || 0}</p>
                      <p className="text-xs text-muted-foreground">Entregue</p>
                    </div>
                    <div className="text-center p-2 bg-muted/40 rounded-lg">
                      <p className="text-sm font-bold">{c.total_read || 0}</p>
                      <p className="text-xs text-muted-foreground">Lido</p>
                    </div>
                    <div className="text-center p-2 bg-muted/40 rounded-lg">
                      <p className="text-sm font-bold">{c.total_replied || 0}</p>
                      <p className="text-xs text-muted-foreground">Resp.</p>
                    </div>
                  </div>

                  {c.scheduled_date && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(c.scheduled_date).toLocaleString("pt-BR")}
                    </p>
                  )}
                </Card>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === "instagram" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Total de Posts" value={instagramPosts.length} icon={Instagram} color="purple" />
            <StatCard title="Agendadas" value={igScheduled} icon={Clock} color="primary" />
            <StatCard title="Rascunhos" value={igDrafts} icon={ImageIcon} color="warning" />
            <StatCard title="Publicadas" value={igPublished} icon={CheckCircle} color="accent" />
          </div>

          <Card className="p-6 mb-6">
            <ContentCalendar posts={instagramPosts} onSelectPost={setSelectedPost} />
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">Carregando postagens...</div>
            ) : instagramPosts.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Instagram className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground mb-1">Nenhuma postagem agendada</p>
                <p className="text-sm text-muted-foreground/70">Clique em "Nova Postagem" para agendar seu primeiro conteúdo</p>
              </div>
            ) : (
              instagramPosts.map((p) => {
                const IgIcon = igTypeConfig[p.instagram_post_type]?.icon || Instagram;
                return (
                  <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    {p.media_url && (
                      <div className="h-40 bg-muted overflow-hidden">
                        <img src={p.media_url} alt={p.name} className="w-full h-full object-cover" onError={(e) => e.target.parentElement.style.display = "none"} />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${igTypeConfig[p.instagram_post_type]?.color || igTypeConfig.feed.color}`}>
                          <IgIcon className="w-3 h-3" />
                          {igTypeConfig[p.instagram_post_type]?.label || "Feed"}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusConfig[p.status]?.color || statusConfig.rascunho.color}`}>
                          {statusConfig[p.status]?.label || p.status}
                        </span>
                      </div>
                      <h3 className="font-semibold mb-2">{p.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{p.caption || "Sem legenda"}</p>
                      {p.hashtags && (
                        <p className="text-xs text-primary mb-3 line-clamp-1">{p.hashtags}</p>
                      )}
                      {p.scheduled_date && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {new Date(p.scheduled_date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {showPostForm && (
        <InstagramPostForm onSave={handleSavePost} onClose={() => setShowPostForm(false)} />
      )}

      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedPost(null)}>
          <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {selectedPost.media_url && (
              <div className="h-56 bg-muted">
                <img src={selectedPost.media_url} alt={selectedPost.name} className="w-full h-full object-cover" onError={(e) => e.target.parentElement.style.display = "none"} />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${igTypeConfig[selectedPost.instagram_post_type]?.color || igTypeConfig.feed.color}`}>
                  {igTypeConfig[selectedPost.instagram_post_type]?.label || "Feed"}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusConfig[selectedPost.status]?.color || statusConfig.rascunho.color}`}>
                  {statusConfig[selectedPost.status]?.label || selectedPost.status}
                </span>
              </div>
              <h3 className="font-bold text-lg mb-2">{selectedPost.name}</h3>
              <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{selectedPost.caption}</p>
              {selectedPost.hashtags && <p className="text-sm text-primary mb-3">{selectedPost.hashtags}</p>}
              {selectedPost.scheduled_date && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-4">
                  <Clock className="w-4 h-4" /> {new Date(selectedPost.scheduled_date).toLocaleString("pt-BR")}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setSelectedPost(null)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                  Fechar
                </button>
                <button
                  onClick={() => handleDeletePost(selectedPost.id)}
                  className="h-10 px-4 border border-destructive/30 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/5 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}