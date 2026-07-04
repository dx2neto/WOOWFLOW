import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Trash2 } from "lucide-react";
import { destinationTypes } from "./constants";

const keypadDigits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export default function UraModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || {
    name: "", welcome_audio_text: "", options: [], invalid_attempts_limit: 3, timeout_seconds: 10,
    after_hours_audio_text: "", holiday_audio_text: "", error_audio_text: "", transbordo_destination: "", active: true,
  });
  const [queues, setQueues] = useState([]);
  const [extensions, setExtensions] = useState([]);

  useEffect(() => {
    (async () => {
      setQueues(await base44.entities.TelephonyQueue.list());
      setExtensions(await base44.entities.Extension.list());
    })();
  }, []);

  const set = (k, v) => setForm({ ...form, [k]: v });
  const updateOption = (idx, key, val) => {
    const opts = [...form.options];
    opts[idx] = { ...opts[idx], [key]: val };
    if (key === "destination_type") opts[idx].destination_value = "";
    set("options", opts);
  };
  const addOptionForDigit = (digit) => {
    if (form.options.some((o) => o.digit === digit)) return;
    set("options", [...form.options, { digit, label: "", destination_type: "fila", destination_value: "" }]);
  };
  const removeOption = (idx) => set("options", form.options.filter((_, i) => i !== idx));

  const destinationOptionsFor = (type) => {
    if (type === "fila") return queues.map((q) => ({ value: q.name, label: q.name }));
    if (type === "ramal") return extensions.map((e) => ({ value: e.number, label: `${e.number} - ${e.attendant_name}` }));
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{item ? "Editar" : "Nova"} URA</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <input required placeholder="Nome da URA" className="w-full border border-border rounded-lg p-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <textarea placeholder="Áudio/mensagem de boas-vindas" className="w-full border border-border rounded-lg p-2 text-sm" value={form.welcome_audio_text} onChange={(e) => set("welcome_audio_text", e.target.value)} />

          <div>
            <p className="text-sm font-medium mb-2">Teclado — clique numa tecla para criar a opção do menu</p>
            <div className="grid grid-cols-6 gap-2 max-w-xs">
              {keypadDigits.map((d) => {
                const used = form.options.some((o) => o.digit === d);
                return (
                  <button
                    key={d} type="button" onClick={() => addOptionForDigit(d)}
                    className={`h-10 rounded-lg text-sm font-bold border ${used ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-muted"}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Níveis do menu configurados</p>
            <div className="space-y-2">
              {form.options.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma opção — clique em uma tecla acima para começar.</p>}
              {form.options.map((opt, idx) => {
                const destOptions = destinationOptionsFor(opt.destination_type);
                return (
                  <div key={idx} className="border border-border rounded-lg p-3 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">{opt.digit}</div>
                    <input
                      placeholder="Nome da opção (ex: Financeiro)"
                      className="col-span-3 border border-border rounded-lg p-2 text-xs"
                      value={opt.label} onChange={(e) => updateOption(idx, "label", e.target.value)}
                    />
                    <select
                      className="col-span-3 border border-border rounded-lg p-2 text-xs"
                      value={opt.destination_type} onChange={(e) => updateOption(idx, "destination_type", e.target.value)}
                    >
                      {Object.entries(destinationTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {destOptions ? (
                      <select
                        className="col-span-4 border border-border rounded-lg p-2 text-xs"
                        value={opt.destination_value} onChange={(e) => updateOption(idx, "destination_value", e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {destOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        placeholder="Destino"
                        className="col-span-4 border border-border rounded-lg p-2 text-xs"
                        value={opt.destination_value} onChange={(e) => updateOption(idx, "destination_value", e.target.value)}
                      />
                    )}
                    <button type="button" onClick={() => removeOption(idx)} className="col-span-1 flex justify-end"><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Tentativas inválidas" className="border border-border rounded-lg p-2 text-sm" value={form.invalid_attempts_limit} onChange={(e) => set("invalid_attempts_limit", Number(e.target.value))} />
            <input type="number" placeholder="Timeout (s)" className="border border-border rounded-lg p-2 text-sm" value={form.timeout_seconds} onChange={(e) => set("timeout_seconds", Number(e.target.value))} />
          </div>
          <textarea placeholder="Áudio fora do horário" className="w-full border border-border rounded-lg p-2 text-sm" value={form.after_hours_audio_text} onChange={(e) => set("after_hours_audio_text", e.target.value)} />
          <textarea placeholder="Áudio de feriado" className="w-full border border-border rounded-lg p-2 text-sm" value={form.holiday_audio_text} onChange={(e) => set("holiday_audio_text", e.target.value)} />
          <input placeholder="Destino de transbordo (opção inválida / erro)" className="w-full border border-border rounded-lg p-2 text-sm" value={form.transbordo_destination} onChange={(e) => set("transbordo_destination", e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Ativa
          </label>
          <button type="submit" className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium">Salvar</button>
        </form>
      </div>
    </div>
  );
}