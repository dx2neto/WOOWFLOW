import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/app-card";
import { Plus, Pencil, Trash2, PlayCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { sendBillingRuleReminders } from "@/functions/sendBillingRuleReminders";
import BillingRuleFormModal from "./BillingRuleFormModal";

export default function BillingRulesManager() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadRules(); }, []);

  const loadRules = async () => {
    setLoading(true);
    const data = await base44.entities.BillingRule.list("-created_date");
    setRules(data);
    setLoading(false);
  };

  const handleSave = async (data) => {
    if (editingRule) {
      await base44.entities.BillingRule.update(editingRule.id, data);
    } else {
      await base44.entities.BillingRule.create(data);
    }
    setShowModal(false);
    setEditingRule(null);
    toast({ title: "Regra salva com sucesso" });
    loadRules();
  };

  const handleDelete = async (rule) => {
    if (!confirm(`Excluir a regra "${rule.name}"?`)) return;
    await base44.entities.BillingRule.delete(rule.id);
    toast({ title: "Regra excluída" });
    loadRules();
  };

  const handleToggleActive = async (rule) => {
    await base44.entities.BillingRule.update(rule.id, { active: !rule.active });
    loadRules();
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const res = await sendBillingRuleReminders({});
      toast({ title: `Régua executada: ${res?.data?.sent || 0} lembrete(s) enviado(s)` });
    } catch {
      toast({ title: "Erro ao executar a régua de cobrança", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="overflow-hidden mb-6">
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold font-heading">Régua de Cobrança Automática</h3>
          <p className="text-xs text-muted-foreground">Lembretes via WhatsApp antes e depois do vencimento das faturas (roda diariamente às 9h)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRunNow}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <PlayCircle className="w-4 h-4" /> {running ? "Executando..." : "Executar agora"}
          </button>
          <button
            onClick={() => { setEditingRule(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" /> Nova Regra
          </button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left font-semibold px-4 py-3">Regra</th>
              <th className="text-left font-semibold px-4 py-3">Quando enviar</th>
              <th className="text-left font-semibold px-4 py-3">Mensagem</th>
              <th className="text-left font-semibold px-4 py-3">Status</th>
              <th className="text-right font-semibold px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma regra cadastrada</td></tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{rule.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {rule.days_offset < 0 ? `${Math.abs(rule.days_offset)} dia(s) antes do vencimento` : rule.days_offset === 0 ? "No dia do vencimento" : `${rule.days_offset} dia(s) após o vencimento`}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{rule.message_template}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(rule)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${rule.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                    >
                      {rule.active ? "Ativa" : "Inativa"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditingRule(rule); setShowModal(true); }} className="p-2 hover:bg-muted rounded-lg text-muted-foreground" title="Editar"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(rule)} className="p-2 hover:bg-red-50 rounded-lg text-red-600" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <BillingRuleFormModal
          rule={editingRule}
          onClose={() => { setShowModal(false); setEditingRule(null); }}
          onSave={handleSave}
        />
      )}
    </Card>
  );
}