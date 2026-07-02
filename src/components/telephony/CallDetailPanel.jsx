import React from "react";
import { X, Phone, User, Clock, FileText } from "lucide-react";
import { CallStatusBadge, SentimentBadge } from "./TelephonyBadges";
import { callReasons } from "./constants";
import moment from "moment";

export default function CallDetailPanel({ call, onClose }) {
  if (!call) return null;
  const Row = ({ label, value }) => (
    <div className="flex justify-between py-1.5 border-b border-border/60 text-sm">
      <span className="text-muted-foreground">{label}</span><span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2"><Phone className="w-5 h-5 text-primary" /> {call.customer_name || call.phone}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <CallStatusBadge status={call.status} />
          <SentimentBadge sentiment={call.sentiment} />
        </div>
        <Row label="Telefone" value={call.phone} />
        <Row label="Direção" value={call.direction === "entrada" ? "Ligação Receptiva" : "Ligação Ativa"} />
        <Row label="Protocolo" value={call.protocol} />
        <Row label="Número DID" value={call.did_number} />
        <Row label="Fila" value={call.queue_name} />
        <Row label="URA" value={call.ura_menu_name} />
        <Row label="Opção URA escolhida" value={call.ura_option_chosen} />
        <Row label="Ramal / Atendente" value={call.extension ? `${call.extension} - ${call.attendant_name}` : call.attendant_name} />
        <Row label="Tronco usado" value={call.trunk_used} />
        <Row label="Rota usada" value={call.route_used} />
        <Row label="Motivo do contato" value={callReasons[call.call_reason]} />
        <Row label="Duração" value={call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : "—"} />
        <Row label="Tempo de espera" value={call.wait_time_seconds ? `${call.wait_time_seconds}s` : "—"} />
        <Row label="Início" value={call.start_time ? moment(call.start_time).format("DD/MM/YYYY HH:mm") : "—"} />
        <Row label="Resultado" value={call.result} />
        <Row label="Próxima ação" value={call.next_action} />

        {call.ai_summary && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-semibold flex items-center gap-1.5 mb-1"><FileText className="w-3.5 h-3.5" /> Resumo com IA</p>
            <p className="text-sm text-muted-foreground">{call.ai_summary}</p>
          </div>
        )}
        {call.transcription && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-semibold mb-1">Transcrição</p>
            <p className="text-sm text-muted-foreground">{call.transcription}</p>
          </div>
        )}
        {call.recording_url && (
          <audio controls className="w-full mt-3" src={call.recording_url}>Seu navegador não suporta áudio.</audio>
        )}
      </div>
    </div>
  );
}