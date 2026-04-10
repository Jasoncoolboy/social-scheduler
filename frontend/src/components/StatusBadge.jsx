import { clsx } from "clsx"

const statusConfig = {
  draft:     { label: "Draft",     cls: "badge-draft"     },
  scheduled: { label: "Scheduled", cls: "badge-scheduled" },
  published: { label: "Published", cls: "badge-published" },
  failed:    { label: "Failed",    cls: "badge-failed"    },
}

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.draft
  return (
    <span className={clsx("text-xs font-medium px-2.5 py-1 rounded-full", config.cls)}>
      {config.label}
    </span>
  )
}