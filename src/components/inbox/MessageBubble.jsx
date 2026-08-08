import React from "react";
import {
  CheckCheck, CheckCircle, ImageIcon, Mic, Paperclip, StickyNote, Video,
  Download, X,
} from "lucide-react";

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const PLACEHOLDER_CONTENTS = ["[image]", "[video]", "[audio]", "[document]", "[mídia]", "[mensagem]"];

export default function MessageBubble({ msg }) {
  const isOut = msg.direction === "out";
  const isInternal = msg.direction === "internal";
  const msgType = msg.type || "text";
  const isImage = msgType === "image" || (msg.media_url && msgType === "image");
  const isAudio = msgType === "audio";
  const isVideo = msgType === "video";
  const isDocument = msgType === "document";
  const hasMedia = isImage || isAudio || isVideo || isDocument;
  const imageSrc = msg.media_url || (msg.media_base64 ? `data:${msg.mime_type || "image/jpeg"};base64,${msg.media_base64}` : "");

  const [lightbox, setLightbox] = React.useState(false);

  if (isInternal) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[85%] rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <StickyNote className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">Nota interna</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-amber-900 leading-relaxed">{msg.content}</p>
          <p className="mt-1 text-right text-[11px] text-amber-600">{msg.sender_name} · {formatTime(msg.timestamp)}</p>
        </div>
      </div>
    );
  }

  const bubbleClass = `max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${
    isOut ? "bg-primary text-primary-foreground" : "border border-border bg-card"
  }`;
  const metaClass = `text-[11px] ${isOut ? "text-primary-foreground/70" : "text-muted-foreground"}`;

  const DeliveryIcon = () => {
    if (!isOut) return null;
    if (msg.status === "read") return <CheckCheck className="h-3.5 w-3.5 text-blue-400" />;
    if (msg.status === "delivered") return <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/70" />;
    return <CheckCircle className="h-3.5 w-3.5 text-primary-foreground/50" />;
  };

  return (
    <>
      <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
        <div className={bubbleClass}>
          {isImage && imageSrc ? (
            <img src={imageSrc} alt="imagem" className="mb-1 max-h-64 max-w-full rounded-xl object-cover cursor-pointer" onClick={() => setLightbox(true)} />
          ) : isImage ? (
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2">
              <ImageIcon className="h-5 w-5 shrink-0" /><span className="text-sm">Imagem</span>
            </div>
          ) : null}

          {isAudio && (msg.media_url ? (
            <div className="mb-1 flex items-center gap-2">
              <Mic className="h-5 w-5 shrink-0" />
              <audio controls src={msg.media_url} className="max-w-[240px]" />
            </div>
          ) : (
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2">
              <Mic className="h-5 w-5 shrink-0" /><span className="text-sm">{msg.file_name || "Áudio"}</span>
            </div>
          ))}

          {isVideo && (msg.media_url ? (
            <video controls src={msg.media_url} className="mb-1 max-h-60 max-w-full rounded-xl" />
          ) : (
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2">
              <Video className="h-5 w-5 shrink-0" /><span className="text-sm">{msg.file_name || "Vídeo"}</span>
            </div>
          ))}

          {isDocument && (msg.media_url ? (
            <a href={msg.media_url} target="_blank" rel="noreferrer" download={msg.file_name || undefined}
              className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 hover:bg-black/20">
              <Paperclip className="h-5 w-5 shrink-0" />
              <span className="text-sm flex-1 truncate">{msg.file_name || "Documento"}</span>
              <Download className="h-4 w-4 shrink-0" />
            </a>
          ) : (
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2">
              <Paperclip className="h-5 w-5 shrink-0" /><span className="text-sm">{msg.file_name || "Documento"}</span>
            </div>
          ))}

          {msg.content && !PLACEHOLDER_CONTENTS.includes(msg.content) && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
          )}
          {!hasMedia && !msg.content && (
            <p className="italic text-sm opacity-60">[mensagem sem conteúdo]</p>
          )}

          <div className="mt-1 flex items-center justify-end gap-1">
            {msg.sender_name && !isOut && <span className={metaClass}>{msg.sender_name} ·</span>}
            <span className={metaClass}>{formatTime(msg.timestamp)}</span>
            <DeliveryIcon />
          </div>
        </div>
      </div>

      {lightbox && imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30">
            <X className="h-6 w-6" />
          </button>
          <img src={imageSrc} alt="imagem ampliada" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        </div>
      )}
    </>
  );
}