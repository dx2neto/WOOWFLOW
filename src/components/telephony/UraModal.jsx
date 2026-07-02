import React, { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

export default function UraModal({ item, onClose, onSave }) {
  const [form, setForm] = useState(item || {
    name: "", welcome_audio_text: "", options: [], invalid_attempts_limit: 3, timeout_seconds: 10,
    after_hours_audio_text: "", holiday_audio_text: "", error_audio_text: "", transbordo_destination: "", active: true,
  });
  const set = (k, v) => setForm({ ...form, [k]: v });
  const updateOption = (idx, key, val) => {
    const opts = [...form.options];
    opts[idx] = { ...opts[idx], [key]: val };
    set("options", opts);
  };
  const addOption = () => set("options", [...form.options, { digit: "", label: "", destination_type: "", destination_value: "" }]);
  const removeOption = (idx) => set("options", form.options.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{item ? "Editar" : "Nova"} URA</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3">
          <input required placeholder="Nome da URA" className="w-full border border-border rounded-lg p-2 text-sm" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <textarea placeholder="Áudio de boas-vindas" className="w-full border border-border rounded-lg p-2 text-sm" value={form.welcome_audio_text} onChange={(e) => set("welcome_audio_text", e.target.value)} />
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Opções do menu</p>
            <button type="button" onClick={addOption} className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Adicionar</button>
          </div>
          <div className="space-y-2">
            {form.options.map((opt, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-2 items-center">
                <input placeholder="Dígito" className="border border-border rounded-lg p-2 text-xs" value={opt.digit} onChange={(e) => updateOption(idx, "digit", e.target.value)} />
                <input placeholder="Descrição" className="col-span-2 border border-border rounded-lg p-2 text-xs" value={opt.label} onChange={(e) => updateOption(idx, "label", e.target.value)} />
                <input placeholder="Destino" className="col-span-1 border border-border rounded-lg p-2 text-xs" value={opt.destination_value} onChange={(e) => updateOption(idx, "destination_value", e.target.value)} />
                <button type="button" onClick={() => removeOption(idx)}><Trash2 className="w-4 h-4 text-destructive" /></button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Tentativas inválidas" className="border border-border rounded-lg p-2 text-sm" value={form.invalid_attempts_limit} onChange={(e) => set("invalid_attempts_limit", Number(e.target.value))} />
            <input type="number" placeholder="Timeout (s)" className="border border-border rounded-lg p-2 text-sm" value={form.timeout_seconds} onChange={(e) => set("timeout_seconds", Number(e.target.value))} />
          </div>
          <textarea placeholder="Áudio fora do horário" className="w-full border border-border rounded-lg p-2 text-sm" value={form.after_hours_audio_text} onChange={(e) => set("after_hours_audio_text", e.target.value)} />
          <textarea placeholder="Áudio de feriado" className="w-full border border-border rounded-lg p-2 text-sm" value={form.holiday_audio_text} onChange={(e) => set("holiday_audio_text", e.target.value)} />
          <input placeholder="Destino de transbordo" className="w-full border border-border rounded-lg p-2 text-sm" value={form.transbordo_destination} onChange={(e) => set("transbordo_destination", e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Ativa
          </label>
          <button type="submit" className="w-full py-2 bg-primary text-primary-foreground rounded-lg font-medium">Salvar</button>
        </form>
      </div>
    </div>
  );
}