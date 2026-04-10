export default function StatsCard({ label, value, icon: Icon, color = "gray" }) {
  const colorMap = {
    gray:  "text-gray-500",
    blue:  "text-blue-500",
    green: "text-green-500",
    red:   "text-red-500",
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </span>
        <Icon size={16} className={colorMap[color]} />
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value ?? "0"}</p>
    </div>
  )
}