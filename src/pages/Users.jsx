import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, StatCard, Card } from "@/components/ui/Card";
import { UserCog, Users as UsersIcon, ShieldCheck, Plus, Pencil, UserCheck } from "lucide-react";
import InviteUserModal from "@/components/users/InviteUserModal";
import EditUserModal from "@/components/users/EditUserModal";
import ProfileForm from "@/components/users/ProfileForm";
import ProfileCard from "@/components/users/ProfileCard";

export default function Users() {
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [usersData, profilesData] = await Promise.all([
        base44.entities.User.list("-created_date", 100),
        base44.entities.Profile.list(),
      ]);
      setUsers(usersData);
      setProfiles(profilesData);
    } catch (e) {
      setUsers([]);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (email, role) => {
    try {
      await base44.users.inviteUser(email, role);
      setShowInvite(false);
      await loadData();
    } catch (e) {
      console.error("Erro ao convidar usuário:", e);
    }
  };

  const handleSaveUser = async (userId, data) => {
    try {
      await base44.entities.User.update(userId, data);
      setEditingUser(null);
      await loadData();
    } catch (e) {
      console.error("Erro ao atualizar usuário:", e);
    }
  };

  const handleSaveProfile = async (data) => {
    try {
      if (editingProfile) {
        await base44.entities.Profile.update(editingProfile.id, data);
      } else {
        await base44.entities.Profile.create(data);
      }
      setShowProfileForm(false);
      setEditingProfile(null);
      await loadData();
    } catch (e) {
      console.error("Erro ao salvar perfil:", e);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    try {
      await base44.entities.Profile.delete(profileId);
      await loadData();
    } catch (e) {
      console.error("Erro ao excluir perfil:", e);
    }
  };

  const getProfileName = (key) => profiles.find((p) => p.key === key)?.name || "—";

  const activeUsers = users.filter((u) => (u.status || "ativo") === "ativo").length;
  const adminUsers = users.filter((u) => u.role === "admin").length;

  const tabs = [
    { key: "users", label: "Usuários", icon: UsersIcon },
    { key: "profiles", label: "Perfis e Permissões", icon: ShieldCheck },
  ];

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Usuários e Permissões</h2>
          <p className="text-sm text-muted-foreground">Gerencie acessos, perfis e permissões da equipe</p>
        </div>
        {tab === "users" ? (
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Convidar Usuário
          </button>
        ) : (
          <button onClick={() => { setEditingProfile(null); setShowProfileForm(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Novo Perfil
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "users" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard title="Total de Usuários" value={users.length} icon={UsersIcon} color="primary" />
            <StatCard title="Ativos" value={activeUsers} icon={UserCheck} color="accent" />
            <StatCard title="Administradores" value={adminUsers} icon={ShieldCheck} color="purple" />
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 font-medium">Nome</th>
                  <th className="text-left px-5 py-3 font-medium">E-mail</th>
                  <th className="text-left px-5 py-3 font-medium">Perfil</th>
                  <th className="text-left px-5 py-3 font-medium">Setor</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Carregando usuários...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum usuário encontrado</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-5 py-3 font-medium">{u.full_name || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                          {u.profile_key ? getProfileName(u.profile_key) : "Sem perfil"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{u.sector || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${(u.status || "ativo") === "ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {(u.status || "ativo") === "ativo" ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => setEditingUser(u)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {tab === "profiles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">Carregando perfis...</div>
          ) : profiles.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <UserCog className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum perfil cadastrado</p>
            </div>
          ) : (
            profiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                onEdit={(prof) => { setEditingProfile(prof); setShowProfileForm(true); }}
                onDelete={handleDeleteProfile}
              />
            ))
          )}
        </div>
      )}

      {showInvite && <InviteUserModal onInvite={handleInvite} onClose={() => setShowInvite(false)} />}
      {editingUser && <EditUserModal user={editingUser} profiles={profiles} onSave={handleSaveUser} onClose={() => setEditingUser(null)} />}
      {showProfileForm && (
        <ProfileForm
          profile={editingProfile}
          onSave={handleSaveProfile}
          onClose={() => { setShowProfileForm(false); setEditingProfile(null); }}
        />
      )}
    </PageContainer>
  );
}