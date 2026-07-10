import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/app-card";
import { useToast } from "@/components/ui/use-toast";
import {
  Building2, Users, Calendar, Palette, Save, Plus, Trash2,
  Loader2, Clock, CheckCircle, Globe, Phone, Mail
} from "lucide-react";

// ─── Constantes ────────────────────────────────────────────────────────────────
const SECTOR_COLORS = [
  { label: "Âmbar",  value: "#f59e0b", cls: "bg-amber-500"  },
  { label: "Azul",   value: "#3b82f6", cls: "bg-blue-500"   },
  { label: "Verde",  value: "#22c55e", cls: "bg-green-500"  },
  { label: "Vermelho",value:"#ef4444", cls: "bg-red-500"    },
  { label: "Roxo",   value: "#a855f7", cls: "bg-purple-500" },
  { label: "Índigo", value: "#6366f1", cls: "bg-indigo-500" },
  { label: "Rosa",   value: "#f43f5e", cls: "bg-rose-500"   },
  { label: "Verde-água",value:"#14b8a6",cls:"bg-teal-500"   },
  { label: "Laranja",value: "#f97316", cls: "bg-orange-500" },
  { label: "Céu",    value: "#0ea5e9", cls: "bg-sky-500"    },
];

const DAYS = [
  { key: "monday",    label: "Segunda-feira" },
  { key: "tuesday",   label: "Terça-feira"   },
  { key: "wednesday", label: "Quarta-feira"  },
  { key: "thursday",  label: "Quinta-feira"  },
  { key: "friday",    label: "Sexta-feira"   },
  { key: "saturday",  label: "Sábado"        },
  { key: "sunday",    label: "Domingo"       },
];

const DEFAULT_HOURS = {
  monday:    { start: "08:00", end: "18:00", active: true  },
  tuesday:   { start: "08:00", end: "18:00", active: true  },
  wednesday: { start: "08:00", end: "18:00", active: true  },
  thursday:  { start: "08:00", end: "18:00", active: true  },
  friday:    { start: "08:00", end: "18:00", active: true  },
  saturday:  { start: "08:00", end: "12:00", active: false },
  sunday:    { start: "08:00", end: "12:00", active: false },
};

const DEFAULT_SECTORS = [
  { name: "Comercial",      color: "#f59e0b" },
  { name: "Suporte Técnico",color: "#3b82f6" },
  { name: "Financeiro",     color: "#22c55e" },
  { name: "Cobrança",       color: "#ef4444" },
  { name: "Retenção",       color: "#a855f7" },
  { name: "Pós-venda",      color: "#6366f1" },
  { name: "Ouvidoria",      color: "#f43f5e" },
  { name: "NOC",            color: "#14b8a6" },
];


// ─── Componente principal ──────────────────────────────────────────────────────
export default function Settings() {
  const [tab, setTab] = useState("company");
  const [, setSettings] = useState(null);
  const [settingsId, setSettingsId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulário de empresa
  const [company, setCompany] = useState({
    company_name: "", cnpj: "", phone: "", whatsapp: "",
    email: "", support_email: "", city: "", state: "", address: "", website: "",
  });

  // Setores
  const [sectors, setSectors] = useState(DEFAULT_SECTORS);
  const [newSector, setNewSector] = useState({ name: "", color: "#3b82f6" });
  const [editingSector, setEditingSector] = useState(null);

  // Horários
  const [businessHours, setBusinessHours] = useState(DEFAULT_HOURS);

  // Feriados
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ name: "", date: "", recurring: true });
  const [addingHoliday, setAddingHoliday] = useState(false);

  // Aparência
  const [appearance, setAppearance] = useState({ primary_color: "#3b82f6", theme: "light" });

  const { toast } = useToast();

  // ── Carrega configurações ao montar ────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.TenantSettings.list("-updated_at", 1);
      if (data.length > 0) {
        const s = data[0];
        setSettings(s);
        setSettingsId(s.id);
        setCompany({
          company_name:  s.company_name  || "",
          cnpj:          s.cnpj          || "",
          phone:         s.phone         || "",
          whatsapp:      s.whatsapp      || "",
          email:         s.email         || "",
          support_email: s.support_email || "",
          city:          s.city          || "",
          state:         s.state         || "",
          address:       s.address       || "",
          website:       s.website       || "",
        });
        if (s.sectors?.length)       setSectors(s.sectors);
        if (s.business_hours)        setBusinessHours({ ...DEFAULT_HOURS, ...s.business_hours });
        if (s.appearance)            setAppearance({ ...appearance, ...s.appearance });
      }
    } catch {
      // silencia — primeiro acesso sem configurações salvas ainda
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Carrega feriados do banco ───────────────────────────────────────────────
  const loadHolidays = useCallback(async () => {
    setLoadingHolidays(true);
    try {
      const data = await base44.entities.Holiday.list("date", 100);
      setHolidays(data);
    } catch {
      setHolidays([]);
    } finally {
      setLoadingHolidays(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadHolidays();
  }, [loadSettings, loadHolidays]);


  // ── Salva dados da empresa ──────────────────────────────────────────────────
  const saveCompany = async () => {
    if (!company.company_name.trim()) {
      toast({ title: "Nome da empresa é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...company, sectors, business_hours: businessHours, appearance, updated_at: new Date().toISOString() };
      if (settingsId) {
        await base44.entities.TenantSettings.update(settingsId, payload);
      } else {
        const created = await base44.entities.TenantSettings.create(payload);
        setSettingsId(created.id);
      }
      toast({ title: "Configurações salvas com sucesso!" });
    } catch {
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Salva setores ───────────────────────────────────────────────────────────
  const saveSectors = async (updatedSectors) => {
    setSaving(true);
    try {
      const payload = { sectors: updatedSectors, updated_at: new Date().toISOString() };
      if (settingsId) {
        await base44.entities.TenantSettings.update(settingsId, payload);
      } else {
        const created = await base44.entities.TenantSettings.create({ company_name: company.company_name || "Minha Empresa", ...payload });
        setSettingsId(created.id);
      }
      toast({ title: "Setores salvos!" });
    } catch {
      toast({ title: "Erro ao salvar setores", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Salva horários e aparência ──────────────────────────────────────────────
  const saveSchedule = async () => {
    setSaving(true);
    try {
      const payload = { business_hours: businessHours, updated_at: new Date().toISOString() };
      if (settingsId) {
        await base44.entities.TenantSettings.update(settingsId, payload);
      } else {
        const created = await base44.entities.TenantSettings.create({ company_name: company.company_name || "Minha Empresa", ...payload });
        setSettingsId(created.id);
      }
      toast({ title: "Horários salvos!" });
    } catch {
      toast({ title: "Erro ao salvar horários", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveAppearance = async () => {
    setSaving(true);
    try {
      const payload = { appearance, updated_at: new Date().toISOString() };
      if (settingsId) {
        await base44.entities.TenantSettings.update(settingsId, payload);
      } else {
        const created = await base44.entities.TenantSettings.create({ company_name: company.company_name || "Minha Empresa", ...payload });
        setSettingsId(created.id);
      }
      toast({ title: "Aparência salva!" });
    } catch {
      toast({ title: "Erro ao salvar aparência", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── CRUD de setores ─────────────────────────────────────────────────────────
  const handleAddSector = async () => {
    if (!newSector.name.trim()) return;
    const updated = [...sectors, { name: newSector.name.trim(), color: newSector.color }];
    setSectors(updated);
    setNewSector({ name: "", color: "#3b82f6" });
    await saveSectors(updated);
  };

  const handleRemoveSector = async (index) => {
    const updated = sectors.filter((_, i) => i !== index);
    setSectors(updated);
    await saveSectors(updated);
  };

  const handleUpdateSector = async (index, field, value) => {
    const updated = sectors.map((s, i) => i === index ? { ...s, [field]: value } : s);
    setSectors(updated);
    return updated;
  };

  const handleSaveSectorEdit = async (_index) => {
    setEditingSector(null);
    await saveSectors(sectors);
  };

  // ── CRUD de feriados ────────────────────────────────────────────────────────
  const handleAddHoliday = async () => {
    if (!newHoliday.name.trim() || !newHoliday.date) {
      toast({ title: "Nome e data são obrigatórios", variant: "destructive" });
      return;
    }
    setAddingHoliday(true);
    try {
      await base44.entities.Holiday.create(newHoliday);
      setNewHoliday({ name: "", date: "", recurring: true });
      await loadHolidays();
      toast({ title: "Feriado adicionado!" });
    } catch {
      toast({ title: "Erro ao adicionar feriado", variant: "destructive" });
    } finally {
      setAddingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id) => {
    try {
      await base44.entities.Holiday.delete(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      toast({ title: "Feriado removido" });
    } catch {
      toast({ title: "Erro ao remover feriado", variant: "destructive" });
    }
  };


  // ── Render ──────────────────────────────────────────────────────────────────
  const tabs = [
    { key: "company",    label: "Empresa",             icon: Building2 },
    { key: "sectors",    label: "Setores",              icon: Users     },
    { key: "schedule",   label: "Horários e Feriados",  icon: Calendar  },
    { key: "appearance", label: "Aparência",            icon: Palette   },
  ];

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando configurações...
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading">Configurações</h2>
          <p className="text-sm text-muted-foreground">Gerencie as configurações da sua empresa na plataforma</p>
        </div>
        {settingsId && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Configurações salvas
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto scrollbar-thin">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── ABA: EMPRESA ─────────────────────────────────────────────────────── */}
      {tab === "company" && (
        <Card className="p-6 max-w-3xl">
          <h3 className="font-semibold text-base mb-5 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Dados da Empresa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">
                Nome da Empresa <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={company.company_name}
                onChange={(e) => setCompany((p) => ({ ...p, company_name: e.target.value }))}
                placeholder="Ex: NetProvedor Telecom"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">CNPJ</label>
              <input
                type="text"
                value={company.cnpj}
                onChange={(e) => setCompany((p) => ({ ...p, cnpj: e.target.value }))}
                placeholder="00.000.000/0001-00"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                <Phone className="w-3.5 h-3.5 inline mr-1" />Telefone Fixo
              </label>
              <input
                type="text"
                value={company.phone}
                onChange={(e) => setCompany((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(00) 0000-0000"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                <Phone className="w-3.5 h-3.5 inline mr-1 text-green-600" />WhatsApp Oficial
              </label>
              <input
                type="text"
                value={company.whatsapp}
                onChange={(e) => setCompany((p) => ({ ...p, whatsapp: e.target.value }))}
                placeholder="(00) 00000-0000"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                <Mail className="w-3.5 h-3.5 inline mr-1" />E-mail principal
              </label>
              <input
                type="email"
                value={company.email}
                onChange={(e) => setCompany((p) => ({ ...p, email: e.target.value }))}
                placeholder="contato@empresa.com.br"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                <Mail className="w-3.5 h-3.5 inline mr-1" />E-mail de suporte
              </label>
              <input
                type="email"
                value={company.support_email}
                onChange={(e) => setCompany((p) => ({ ...p, support_email: e.target.value }))}
                placeholder="suporte@empresa.com.br"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Cidade</label>
              <input
                type="text"
                value={company.city}
                onChange={(e) => setCompany((p) => ({ ...p, city: e.target.value }))}
                placeholder="São Paulo"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Estado (UF)</label>
              <input
                type="text"
                value={company.state}
                onChange={(e) => setCompany((p) => ({ ...p, state: e.target.value }))}
                placeholder="SP"
                maxLength={2}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary uppercase"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Endereço completo</label>
              <input
                type="text"
                value={company.address}
                onChange={(e) => setCompany((p) => ({ ...p, address: e.target.value }))}
                placeholder="Av. Principal, 1000 - Bairro - Cidade/UF"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">
                <Globe className="w-3.5 h-3.5 inline mr-1" />Website
              </label>
              <input
                type="text"
                value={company.website}
                onChange={(e) => setCompany((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://www.suaempresa.com.br"
                className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t border-border">
            <button
              onClick={saveCompany}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Salvando..." : "Salvar Dados"}
            </button>
          </div>
        </Card>
      )}

      {/* ── ABA: SETORES ─────────────────────────────────────────────────────── */}
      {tab === "sectors" && (
        <div className="max-w-3xl space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold text-base mb-1 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Setores de Atendimento
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              Configure os setores para roteamento de atendimentos. Os setores são usados no Inbox, CRM e relatórios.
            </p>

            <div className="space-y-2 mb-4">
              {sectors.map((s, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/20 group">
                  <div className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20 shadow-sm" style={{ backgroundColor: s.color }} />

                  {editingSector === index ? (
                    <>
                      <input
                        autoFocus
                        value={s.name}
                        onChange={(e) => handleUpdateSector(index, "name", e.target.value)}
                        className="flex-1 h-8 px-2 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="flex gap-1">
                        {SECTOR_COLORS.map((c) => (
                          <button
                            key={c.value}
                            onClick={() => handleUpdateSector(index, "color", c.value)}
                            title={c.label}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${s.color === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                            style={{ backgroundColor: c.value }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => handleSaveSectorEdit(index)}
                        className="text-xs font-semibold text-primary hover:underline px-2"
                      >
                        Salvar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{s.name}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingSector(index)}
                          className="text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded hover:bg-muted"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleRemoveSector(index)}
                          className="text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {sectors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum setor cadastrado</p>
              )}
            </div>

            {/* Adicionar novo setor */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Adicionar setor</p>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <input
                    value={newSector.name}
                    onChange={(e) => setNewSector((p) => ({ ...p, name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSector()}
                    placeholder="Nome do setor"
                    className="w-full h-10 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div className="flex gap-1 items-center">
                  {SECTOR_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewSector((p) => ({ ...p, color: c.value }))}
                      title={c.label}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${newSector.color === c.value ? "border-foreground scale-125" : "border-transparent"}`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleAddSector}
                  disabled={saving || !newSector.name.trim()}
                  className="flex items-center gap-1.5 px-4 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Adicionar
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── ABA: HORÁRIOS E FERIADOS ──────────────────────────────────────────── */}
      {tab === "schedule" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
          {/* Horários */}
          <Card className="p-6">
            <h3 className="font-semibold text-base mb-1 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Horário de Atendimento
            </h3>
            <p className="text-sm text-muted-foreground mb-4">Defina quando sua equipe está disponível para atendimento.</p>

            <div className="space-y-3">
              {DAYS.map((day) => {
                const h = businessHours[day.key] || { start: "08:00", end: "18:00", active: false };
                return (
                  <div key={day.key} className="flex items-center gap-3">
                    <button
                      onClick={() => setBusinessHours((p) => ({ ...p, [day.key]: { ...h, active: !h.active } }))}
                      className={`w-10 h-5 rounded-full flex items-center transition-colors flex-shrink-0 ${h.active ? "bg-primary justify-end" : "bg-muted justify-start"} px-0.5`}
                    >
                      <span className="w-4 h-4 bg-white rounded-full shadow" />
                    </button>
                    <span className={`w-28 text-sm font-medium ${!h.active ? "text-muted-foreground" : ""}`}>{day.label}</span>
                    <input
                      type="time"
                      value={h.start}
                      disabled={!h.active}
                      onChange={(e) => setBusinessHours((p) => ({ ...p, [day.key]: { ...h, start: e.target.value } }))}
                      className="h-9 px-2 border border-border rounded text-sm disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-muted-foreground text-sm">até</span>
                    <input
                      type="time"
                      value={h.end}
                      disabled={!h.active}
                      onChange={(e) => setBusinessHours((p) => ({ ...p, [day.key]: { ...h, end: e.target.value } }))}
                      className="h-9 px-2 border border-border rounded text-sm disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end mt-5 pt-4 border-t border-border">
              <button
                onClick={saveSchedule}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Horários
              </button>
            </div>
          </Card>

          {/* Feriados */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> Feriados
              </h3>
              <span className="text-xs font-semibold bg-muted px-2 py-0.5 rounded-full">
                {holidays.length} cadastrado{holidays.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Feriados são respeitados pelo Chatbot no horário de atendimento.</p>

            <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin mb-4">
              {loadingHolidays ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                </div>
              ) : holidays.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum feriado cadastrado</p>
              ) : (
                holidays.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg group">
                    <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium w-24 flex-shrink-0">
                      {h.date ? new Date(h.date + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
                    </span>
                    <span className="text-sm text-muted-foreground flex-1 truncate">{h.name}</span>
                    {h.recurring && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">Recorrente</span>
                    )}
                    <button
                      onClick={() => handleDeleteHoliday(h.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Adicionar feriado */}
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adicionar feriado</p>
              <input
                type="text"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome do feriado"
                className="w-full h-9 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday((p) => ({ ...p, date: e.target.value }))}
                  className="flex-1 h-9 px-3 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newHoliday.recurring}
                    onChange={(e) => setNewHoliday((p) => ({ ...p, recurring: e.target.checked }))}
                    className="rounded"
                  />
                  Recorrente
                </label>
              </div>
              <button
                onClick={handleAddHoliday}
                disabled={addingHoliday || !newHoliday.name.trim() || !newHoliday.date}
                className="w-full flex items-center justify-center gap-2 h-9 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {addingHoliday ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Adicionar Feriado
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ── ABA: APARÊNCIA ────────────────────────────────────────────────────── */}
      {tab === "appearance" && (
        <Card className="p-6 max-w-xl">
          <h3 className="font-semibold text-base mb-5 flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" /> Personalização Visual
          </h3>
          <div className="space-y-6">
            {/* Cor primária */}
            <div>
              <label className="text-sm font-medium mb-3 block">Cor Primária da Plataforma</label>
              <div className="flex gap-2 flex-wrap">
                {SECTOR_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setAppearance((p) => ({ ...p, primary_color: c.value }))}
                    title={c.label}
                    className={`w-10 h-10 rounded-xl border-4 transition-all ${appearance.primary_color === c.value ? "border-foreground scale-110 shadow-md" : "border-transparent"}`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            {/* Tema */}
            <div>
              <label className="text-sm font-medium mb-3 block">Modo do Tema</label>
              <div className="grid grid-cols-3 gap-2">
                {[["light","Claro","☀️"],["dark","Escuro","🌙"],["auto","Automático","🔄"]].map(([val, label, icon]) => (
                  <button
                    key={val}
                    onClick={() => setAppearance((p) => ({ ...p, theme: val }))}
                    className={`flex flex-col items-center gap-1 p-3 border-2 rounded-xl text-sm transition-all ${
                      appearance.theme === val
                        ? "border-primary bg-primary/5 font-semibold"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <span className="text-xl">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t border-border">
            <button
              onClick={saveAppearance}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Aparência
            </button>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
