import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageContainer, Card } from "@/components/ui/Card";
import { Calendar, Plus, Trash2 } from "lucide-react";
import HolidayFormModal from "@/components/tagsqueues/HolidayFormModal";
import { format } from "date-fns";

const DAYS = [
  { key: "segunda", label: "Segunda" }, { key: "terca", label: "Terça" }, { key: "quarta", label: "Quarta" },
  { key: "quinta", label: "Quinta" }, { key: "sexta", label: "Sexta" }, { key: "sabado", label: "Sábado" }, { key: "domingo", label: "Domingo" },
];

export default function Holidays() {
  const [holidays, setHolidays] = useState([]);
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [holidaysData, hoursData] = await Promise.all([
      base44.entities.Holiday.list("date"),
      base44.entities.BusinessHours.list(),
    ]);
    setHolidays(holidaysData);

    if (hoursData.length === 0) {
      const created = await base44.entities.BusinessHours.bulkCreate(
        DAYS.map((d) => ({ day: d.key, open_time: "08:00", close_time: "18:00", active: d.key !== "domingo" }))
      );
      setHours(created);
    } else {
      setHours(hoursData);
    }
    setLoading(false);
  };

  const addHoliday = async (data) => {
    await base44.entities.Holiday.create(data);
    setShowForm(false);
    await loadData();
  };

  const deleteHoliday = async (id) => { await base44.entities.Holiday.delete(id); await loadData(); };

  const updateHour = async (id, field, value) => {
    setHours((prev) => prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
    await base44.entities.BusinessHours.update(id, { [field]: value });
  };

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Feriados e Horários</h2>
        <p className="text-sm text-muted-foreground">Configure o horário de atendimento e os feriados da empresa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Horário de Atendimento" className="p-6">
          {loading ? (
            <p className="text-center py-6 text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-3">
              {DAYS.map((d) => {
                const h = hours.find((x) => x.day === d.key);
                if (!h) return null;
                return (
                  <div key={d.key} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 w-28">
                      <input type="checkbox" checked={h.active} onChange={(e) => updateHour(h.id, "active", e.target.checked)} className="w-4 h-4 accent-primary" />
                      <span className="text-sm font-medium">{d.label}</span>
                    </label>
                    <input type="time" value={h.open_time} onChange={(e) => updateHour(h.id, "open_time", e.target.value)} disabled={!h.active} className="h-9 px-2 border border-border rounded text-sm disabled:opacity-40" />
                    <span className="text-muted-foreground">até</span>
                    <input type="time" value={h.close_time} onChange={(e) => updateHour(h.id, "close_time", e.target.value)} disabled={!h.active} className="h-9 px-2 border border-border rounded text-sm disabled:opacity-40" />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Feriados Cadastrados"
          className="p-6"
          action={
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          }
        >
          <div className="space-y-2">
            {loading ? (
              <p className="text-center py-6 text-muted-foreground">Carregando...</p>
            ) : holidays.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">Nenhum feriado cadastrado</p>
            ) : (
              holidays.map((h) => (
                <div key={h.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                  <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium w-20">{format(new Date(h.date + "T00:00:00"), "dd/MM")}</span>
                  <span className="text-sm text-muted-foreground flex-1">{h.name}</span>
                  {h.recurring && <span className="text-xs text-muted-foreground/70">Anual</span>}
                  <button onClick={() => deleteHoliday(h.id)} className="p-1 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {showForm && <HolidayFormModal onSave={addHoliday} onClose={() => setShowForm(false)} />}
    </PageContainer>
  );
}