import React, { useState } from "react";
import { X, Save } from "lucide-react";
import { MODULES, ACTIONS, SPECIAL_PERMISSIONS } from "./permissionsConfig";

export default function ProfileForm({ profile, onSave, onClose }) {
  const [name, setName] = useState(profile?.name || "");
  const [description, setDescription] = useState(profile?.description || "");
  const [modulePerms, setModulePerms] = useState(profile?.module_permissions || {});
  const [specialPerms, setSpecialPerms] = useState(profile?.special_permissions || []);
  const [saving, setSaving] = useState(false);

  const toggleAction = (moduleKey, actionKey) => {
    setModulePerms((prev) => {
      const current = prev[moduleKey] || [];
      const has = current.includes(actionKey);
      const updated = has ? current.filter((a) => a !== actionKey) : [...current, actionKey];
      return { ...prev, [moduleKey]: updated };
    });
  };

  const toggleSpecial = (key) => {
    setSpecialPerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;
    setSaving(true);
    await onSave({
      name,
      description,
      key: profile?.key || name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      module_permissions: modulePerms,
      special_permissions: specialPerms,
      is_system: profile?.is_system || false,
    });
    setSaving(false);
  };

  const field = "w-full h-10 px-3 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="font-semibold font-heading">{profile ? "Editar Perfil" : "Novo Perfil"}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nome do perfil *</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Atendente" className={field} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Descrição</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição do perfil" className={field} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Permissões por módulo</label>
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">Módulo</th>
                    {ACTIONS.map((a) => (
                      <th key={a.key} className="px-2 py-2 font-medium text-center whitespace-nowrap">{a.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((m) => (
                    <tr key={m.key} className="border-t border-border">
                      <td className="px-3 py-2 whitespace-nowrap">{m.label}</td>
                      {ACTIONS.map((a) => (
                        <td key={a.key} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={(modulePerms[m.key] || []).includes(a.key)}
                            onChange={() => toggleAction(m.key, a.key)}
                            className="w-4 h-4 accent-primary cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Permissões especiais</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SPECIAL_PERMISSIONS.map((sp) => (
                <label key={sp.key} className="flex items-center gap-2 p-2.5 border border-border rounded-lg cursor-pointer hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={specialPerms.includes(sp.key)}
                    onChange={() => toggleSpecial(sp.key)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="text-sm">{sp.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 sticky bottom-0 bg-card">
            <button type="button" onClick={onClose} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar Perfil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}