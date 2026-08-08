import React from "react";
import { Database, ArrowRight, FileSignature, MessageCircle, Workflow, CheckCircle, XCircle } from "lucide-react";

const dependencies = [
  {
    source: "IXCSoft (ERP)",
    sourceIcon: Database,
    target: "Base de Clientes",
    targetIcon: Database,
    status: "active",
    description: "Clientes, contratos e planos sincronizados via API IXC",
  },
  {
    source: "IXCSoft (ERP)",
    sourceIcon: Database,
    target: "Cobranças & Financeiro",
    targetIcon: Database,
    status: "active",
    description: "Faturas, boletos e PIX importados do IXC",
  },
  {
    source: "IXCSoft (ERP)",
    sourceIcon: Database,
    target: "Ordens de Serviço",
    targetIcon: Database,
    status: "active",
    description: "OS técnica sincronizadas do IXC",
  },
  {
    source: "Contratos IXC",
    sourceIcon: Database,
    target: "ContractTemplate (ZapSign)",
    targetIcon: FileSignature,
    status: "active",
    description: "Templates de contrato mapeados por ixc_plan_ids",
  },
  {
    source: "ContractTemplate",
    sourceIcon: FileSignature,
    target: "SignatureRequest (ZapSign)",
    targetIcon: FileSignature,
    status: "active",
    description: "Geração de documentos de assinatura via ZapSign",
  },
  {
    source: "SignatureRequest",
    sourceIcon: FileSignature,
    target: "AutomationFlow (contrato_assinado)",
    targetIcon: Workflow,
    status: "active",
    description: "Disparo de automações CRM quando contrato é assinado",
  },
  {
    source: "AutomationFlow",
    sourceIcon: Workflow,
    target: "Evolution API (WhatsApp)",
    targetIcon: MessageCircle,
    status: "active",
    description: "Envio de mensagens automáticas via WhatsApp",
  },
  {
    source: "Cobranças IXC",
    sourceIcon: Database,
    target: "BillingRule (Lembretes)",
    targetIcon: Workflow,
    status: "active",
    description: "Régua de cobrança automática por vencimento",
  },
  {
    source: "BillingRule",
    sourceIcon: Workflow,
    target: "Evolution API (WhatsApp)",
    targetIcon: MessageCircle,
    status: "active",
    description: "Lembretes de pagamento enviados via WhatsApp",
  },
  {
    source: "Acordos (Agreement)",
    sourceIcon: FileSignature,
    target: "ZapSign (Termos)",
    targetIcon: FileSignature,
    status: "warning",
    description: "Acordos de negociação podem gerar termos no ZapSign",
  },
];

export default function DependencyMap() {
  return (
    <div className="space-y-2">
      {dependencies.map((dep, i) => {
        const SourceIcon = dep.sourceIcon;
        const TargetIcon = dep.targetIcon;
        const isActive = dep.status === "active";
        return (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <SourceIcon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-semibold truncate">{dep.source}</span>
            </div>
            <div className="flex flex-col items-center flex-shrink-0 px-2">
              <ArrowRight className={`w-4 h-4 ${isActive ? "text-emerald-500" : "text-amber-500"}`} />
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <TargetIcon className="w-4 h-4 text-accent" />
              </div>
              <span className="text-xs font-semibold truncate">{dep.target}</span>
            </div>
            <div className="flex-shrink-0 w-5">
              {isActive ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-amber-500" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}