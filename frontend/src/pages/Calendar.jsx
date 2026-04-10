import { useQuery } from "@tanstack/react-query"
import { getCalendarPosts } from "../api/posts"
import { Calendar as BigCalendar, dayjsLocalizer } from "react-big-calendar"
import dayjs from "dayjs"
import "react-big-calendar/lib/css/react-big-calendar.css"
import { useNavigate } from "react-router-dom"

const localizer = dayjsLocalizer(dayjs)

export default function Calendar() {
  const navigate = useNavigate()

  const { data: events = [] } = useQuery({
    queryKey: ["calendar"],
    queryFn: getCalendarPosts,
  })

  const calendarEvents = events.map((e) => ({
    id: e.id,
    title: `${e.post_type === "story" ? "📱" : "📷"} ${e.title}`,
    start: new Date(e.start),
    end: new Date(e.start),
    status: e.status,
    resource: e,
  }))

  const eventStyleGetter = (event) => {
    const colors = {
      scheduled: { backgroundColor: "#1e3a5f", borderColor: "#3b82f6", color: "#93c5fd" },
      published: { backgroundColor: "#14532d", borderColor: "#22c55e", color: "#86efac" },
      failed:    { backgroundColor: "#450a0a", borderColor: "#ef4444", color: "#fca5a5" },
      draft:     { backgroundColor: "#1f2937", borderColor: "#6b7280", color: "#d1d5db" },
    }
    const style = colors[event.status] || colors.draft
    return {
      style: {
        ...style,
        borderRadius: "6px",
        border: `1px solid ${style.borderColor}`,
        fontSize: "12px",
        padding: "2px 6px",
      },
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Calendar</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Visual overview of your scheduled content
        </p>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        {[
          { color: "bg-blue-900 border-blue-500",   label: "Scheduled" },
          { color: "bg-green-900 border-green-500",  label: "Published" },
          { color: "bg-red-900 border-red-500",      label: "Failed"    },
          { color: "bg-gray-800 border-gray-600",    label: "Draft"     },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border ${color}`} />
            <span className="text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="card p-0 overflow-hidden" style={{ height: 600 }}>
        <style>{`
          .rbc-calendar { background: #111827; color: #f9fafb; border: none; }
          .rbc-header { background: #1f2937; border-color: #374151; color: #9ca3af; padding: 8px; font-size: 13px; }
          .rbc-month-view, .rbc-time-view { border-color: #374151; }
          .rbc-day-bg { border-color: #374151; }
          .rbc-off-range-bg { background: #0f172a; }
          .rbc-today { background: #1e1b4b; }
          .rbc-toolbar button { color: #9ca3af; background: #1f2937; border-color: #374151; }
          .rbc-toolbar button:hover { background: #374151; color: #f9fafb; }
          .rbc-toolbar button.rbc-active { background: #7e22ce; color: #fff; border-color: #7e22ce; }
          .rbc-show-more { color: #a855f7; background: transparent; }
          .rbc-date-cell { color: #9ca3af; }
          .rbc-date-cell.rbc-now { color: #a855f7; font-weight: bold; }
        `}</style>
        <BigCalendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%", padding: "16px" }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={(event) => navigate(`/posts`)}
          views={["month", "week", "agenda"]}
          defaultView="month"
          popup
        />
      </div>
    </div>
  )
}