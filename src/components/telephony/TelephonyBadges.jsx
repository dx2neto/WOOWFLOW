import React from "react";
import { trunkStatus, linkStatus, callStatus, sentiments } from "./constants";

function Badge({ config, value }) {
  const c = config[value] || { label: value, color: "text-gray-500 bg-gray-50" };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>;
}

export const TrunkStatusBadge = ({ status }) => <Badge config={trunkStatus} value={status} />;
export const LinkStatusBadge = ({ status }) => <Badge config={linkStatus} value={status} />;
export const CallStatusBadge = ({ status }) => <Badge config={callStatus} value={status} />;
export const SentimentBadge = ({ sentiment }) => <Badge config={sentiments} value={sentiment} />;