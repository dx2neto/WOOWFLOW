import React, { useState } from "react";
import { X, Send } from "lucide-react";

export default function InviteUserModal({ onInvite, onClose }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    await onInvite(email, role);
    setSending(false);
  };

  const field = "w-full h-10 px-3 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold font-heading">Convidar Usuário</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">E-mail *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              className={field}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Acesso ao sistema *</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1.5">O perfil de permissões específico pode ser definido após o aceite do convite.</p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> {sending ? "Enviando..." : "Enviar convite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}