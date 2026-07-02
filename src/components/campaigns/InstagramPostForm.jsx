import React, { useState } from "react";
import { X, Image as ImageIcon, Film, Instagram, Calendar as CalendarIcon } from "lucide-react";

const postTypeConfig = {
  feed: { label: "Post (Feed)", icon: ImageIcon, color: "bg-purple-100 text-purple-700" },
  reel: { label: "Reel", icon: Film, color: "bg-pink-100 text-pink-700" },
  story: { label: "Story", icon: Instagram, color: "bg-orange-100 text-orange-700" },
};

export default function InstagramPostForm({ onSave, onClose }) {
  const [form, setForm] = useState({
    name: "",
    caption: "",
    hashtags: "",
    media_url: "",
    instagram_post_type: "feed",
    scheduled_date: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.caption || !form.scheduled_date) return;
    setSaving(true);
    await onSave({
      ...form,
      channel: "instagram",
      type: "promocao",
      status: "agendada",
    });
    setSaving(false);
  };

  const field = "w-full h-10 px-3 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
              <Instagram className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold font-heading">Agendar Postagem Instagram</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Título da postagem *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Promoção de Verão 50% OFF"
              className={field}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo de postagem *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(postTypeConfig).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const active = form.instagram_post_type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, instagram_post_type: key })}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                      active ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Legenda *</label>
            <textarea
              required
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              placeholder="Escreva a legenda do post..."
              rows={4}
              className="w-full px-3 py-2.5 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Hashtags</label>
            <input
              type="text"
              value={form.hashtags}
              onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
              placeholder="#woow #internet #promo"
              className={field}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">URL da mídia</label>
            <input
              type="url"
              value={form.media_url}
              onChange={(e) => setForm({ ...form, media_url: e.target.value })}
              placeholder="https://exemplo.com/imagem.jpg"
              className={field}
            />
            {form.media_url && (
              <div className="mt-2 rounded-lg overflow-hidden border border-border max-h-40">
                <img src={form.media_url} alt="Preview" className="w-full object-cover" onError={(e) => e.target.style.display = "none"} />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Data e hora de publicação *</label>
            <input
              type="datetime-local"
              required
              value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              className={field}
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-10 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CalendarIcon className="w-4 h-4" />
              {saving ? "Agendando..." : "Agendar Postagem"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}