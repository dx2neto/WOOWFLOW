import React from "react";
import { Card } from "@/components/ui/app-card";
import { ShieldCheck, Pencil, Trash2, Lock } from "lucide-react";
import { MODULES, SPECIAL_PERMISSIONS } from "./permissionsConfig";

export default function ProfileCard({ profile, onEdit, onDelete }) {
  const moduleCount = Object.values(profile.module_permissions || {}).filter((a) => a.length > 0).length;
  const specialCount = (profile.special_permissions || []).length;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{profile.name}</h3>
            {profile.description && <p className="text-xs text-muted-foreground">{profile.description}</p>}
          </div>
        </div>
        {profile.is_system && (
          <span title="Perfil padrão do sistema" className="p-1">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span>{moduleCount} de {MODULES.length} módulos</span>
        <span>{specialCount} de {SPECIAL_PERMISSIONS.length} permissões especiais</span>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <button onClick={() => onEdit(profile)} className="flex-1 flex items-center justify-center gap-1.5 h-8 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors">
          <Pencil className="w-3.5 h-3.5" /> Editar
        </button>
        {!profile.is_system && (
          <button onClick={() => onDelete(profile.id)} className="flex items-center justify-center gap-1.5 h-8 px-3 border border-destructive/30 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/5 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </Card>
  );
}