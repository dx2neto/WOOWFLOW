import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { PageContainer, Card } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { ArrowLeft } from "lucide-react";
import CustomerTimeline from "@/components/customers/CustomerTimeline";

export default function CustomerProfile() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCustomer(); }, [id]);

  const loadCustomer = async () => {
    setLoading(true);
    try {
      const response = await ixcApi({ action: "clientes" });
      const registros = response?.data?.result?.registros || [];
      setCustomer(registros.find((c) => String(c.id) === String(id)) || null);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <Link to="/customers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar para clientes
      </Link>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando cliente...</p>
      ) : !customer ? (
        <p className="text-sm text-muted-foreground">Cliente não encontrado</p>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-xl">
              {customer.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold font-heading">{customer.name}</h2>
              <p className="text-sm text-muted-foreground">{customer.phone} • {customer.email || "sem email"} • {customer.city || "—"}</p>
            </div>
          </div>

          <Card title="Linha do Tempo" className="p-5">
            <CustomerTimeline phone={customer.phone} clientId={customer.id} />
          </Card>
        </>
      )}
    </PageContainer>
  );
}