import React, { useState, useEffect } from "react";
import { PageContainer, Card } from "@/components/ui/app-card";
import { base44 } from "@/api/base44Client";
import ContactsTab from "@/components/workqueue/ContactsTab";
import UnansweredTab from "@/components/workqueue/UnansweredTab";
import { ClipboardList, MessageCircle, Users } from "lucide-react";

const tabs = [
  { key: "contacts", label: "Contatos", icon: Users },
  { key: "unanswered", label: "WhatsApp não respondidas", icon: MessageCircle },
];

export default function WorkQueue() {
  const [tab, setTab] = useState("contacts");
  const [user, setUser] = useState(null);
  const [selectedInstance, setSelectedInstance] = useState(
    () => localStorage.getItem("evolution_instance") || ""
  );

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Fila de Trabalho
          </h2>
          <p className="text-sm text-muted-foreground">
            Contatos do funil e mensagens de WhatsApp sem resposta — atualizado em tempo real.
          </p>
        </div>
      </div>

      <div className="mb-4 flex gap-2 border-b border-border">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "contacts" ? (
        <ContactsTab user={user} />
      ) : (
        <UnansweredTab instance={selectedInstance} />
      )}
    </PageContainer>
  );
}