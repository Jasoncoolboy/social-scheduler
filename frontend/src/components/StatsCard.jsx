export default function StatsCard({ label, value, icon: Icon, color = "brand" }) {
  const colorMap = {
    brand:  "text-brand-500 bg-brand-500/10",
    blue:   "text-blue-400 bg-blue-400/10",
    green:  "text-green-400 bg-green-400/10",
    red:    "text-red-400 bg-red-400/10",
    gray:   "text-gray-400 bg-gray-400/10",
  }

  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colorMap[color]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value ?? "—"}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}