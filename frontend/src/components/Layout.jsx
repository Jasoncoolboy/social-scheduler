import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import {
  LayoutDashboard,
  PlusCircle,
  Calendar,
  Settings,
  Camera,
  LogOut,
} from "lucide-react"
import { clsx } from "clsx"

const navItems = [
  { to: "/",         icon: LayoutDashboard, label: "Dashboard" },
  { to: "/create",   icon: PlusCircle,      label: "Create Post" },
  { to: "/posts",    icon: Camera,          label: "My Posts"   },
  { to: "/calendar", icon: Calendar,        label: "Calendar"   },
  { to: "/settings", icon: Settings,        label: "Settings"   },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Camera size={18} className="text-white" />  {/* ← changed */}
            </div>
            <span className="font-bold text-white text-lg">SocialSched</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.username}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  )
}