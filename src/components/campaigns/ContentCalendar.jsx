import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Instagram, Image as ImageIcon, Film } from "lucide-react";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const postTypeIcon = {
  feed: ImageIcon,
  reel: Film,
  story: Instagram,
};

const postTypeColor = {
  feed: "bg-purple-500",
  reel: "bg-pink-500",
  story: "bg-orange-500",
};

export default function ContentCalendar({ posts, onSelectPost }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const today = new Date();
  const isToday = (day) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const getPostsForDay = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return posts.filter((p) => {
      if (!p.scheduled_date) return false;
      const postDate = new Date(p.scheduled_date);
      const postStr = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, "0")}-${String(postDate.getDate()).padStart(2, "0")}`;
      return postStr === dateStr;
    });
  };

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const scheduledCount = posts.filter((p) => p.status === "agendada").length;
  const draftCount = posts.filter((p) => p.status === "rascunho").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-bold font-heading min-w-[180px] text-center">
            {MONTHS[month]} {year}
          </h3>
          <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500"></span>
            {scheduledCount} agendadas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-gray-400"></span>
            {draftCount} rascunhos
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} className="min-h-[110px] rounded-lg bg-muted/20" />;
          const dayPosts = getPostsForDay(day);
          return (
            <div
              key={idx}
              className={`min-h-[110px] rounded-lg border p-1.5 transition-colors ${
                isToday(day) ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/30"
              }`}
            >
              <span className={`text-xs font-medium block mb-1 ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>
                {day}
              </span>
              <div className="space-y-1">
                {dayPosts.slice(0, 3).map((p) => {
                  const Icon = postTypeIcon[p.instagram_post_type] || Instagram;
                  const time = p.scheduled_date
                    ? new Date(p.scheduled_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "";
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectPost?.(p)}
                      className={`w-full text-left px-1.5 py-1 rounded text-xs text-white truncate flex items-center gap-1 hover:opacity-80 transition-opacity ${
                        postTypeColor[p.instagram_post_type] || "bg-purple-500"
                      }`}
                      title={p.name}
                    >
                      <Icon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{time || p.name}</span>
                    </button>
                  );
                })}
                {dayPosts.length > 3 && (
                  <p className="text-xs text-muted-foreground px-1">+{dayPosts.length - 3} mais</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}