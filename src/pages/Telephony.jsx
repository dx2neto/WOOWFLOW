import React, { useState } from "react";
import { PageContainer } from "@/components/ui/app-card";
import {
  LayoutDashboard, PhoneCall, ArrowDownToLine, ArrowUpFromLine,
  Network, Router, Users, ListOrdered, Voicemail
} from "lucide-react";
import DashboardTab from "@/components/telephony/tabs/DashboardTab";
import CallsInboxTab from "@/components/telephony/tabs/CallsInboxTab";
import InboundRoutesTab from "@/components/telephony/tabs/InboundRoutesTab";
import OutboundRoutesTab from "@/components/telephony/tabs/OutboundRoutesTab";
import SipTrunksTab from "@/components/telephony/tabs/SipTrunksTab";
import E1GatewaysTab from "@/components/telephony/tabs/E1GatewaysTab";
import ExtensionsTab from "@/components/telephony/tabs/ExtensionsTab";
import QueuesTab from "@/components/telephony/tabs/QueuesTab";
import UraTab from "@/components/telephony/tabs/UraTab";

const tabs = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, component: DashboardTab },
  { key: "calls", label: "Caixa de Ligações", icon: PhoneCall, component: CallsInboxTab },
  { key: "inbound", label: "Rotas de Entrada", icon: ArrowDownToLine, component: InboundRoutesTab },
  { key: "outbound", label: "Rotas de Saída", icon: ArrowUpFromLine, component: OutboundRoutesTab },
  { key: "trunks", label: "Troncos SIP", icon: Network, component: SipTrunksTab },
  { key: "gateways", label: "E1 IP / Gateway", icon: Router, component: E1GatewaysTab },
  { key: "extensions", label: "Ramais", icon: Users, component: ExtensionsTab },
  { key: "queues", label: "Filas", icon: ListOrdered, component: QueuesTab },
  { key: "ura", label: "URA", icon: Voicemail, component: UraTab },
];

export default function Telephony() {
  const [active, setActive] = useState("dashboard");
  const ActiveComponent = tabs.find((t) => t.key === active)?.component || DashboardTab;

  return (
    <PageContainer>
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Telefonia Omnichannel e Rotas PABX</h2>
        <p className="text-sm text-muted-foreground">Troncos SIP, E1 IP, rotas, URA, ramais e atendimento telefônico integrado</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap border-b border-border pb-3">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <ActiveComponent />
    </PageContainer>
  );
}