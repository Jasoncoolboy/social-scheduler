import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuthStore } from "../store/authStore"
import {
  LayoutDashboard,
  PlusCircle,
  Calendar,
  Settings,
  Camera,
  LogOut,
  Layers,
} from "lucide-react"
import { clsx } from "clsx"

const navItems = [
  { to: "/",         icon: LayoutDashboard, label: "Dashboard"   },
  { to: "/create",   icon: PlusCircle,      label: "Create Post" },
  { to: "/posts",    icon: Layers,          label: "My Posts"    },
  { to: "/calendar", icon: Calendar,        label: "Calendar"    },
  { to: "/settings", icon: Settings,        label: "Settings"    },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
              <Camera size={14} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">
              SocialSched
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
                  isActive
                    ? "bg-gray-900 text-white font-medium"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-normal"
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                {user?.username}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/login") }}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}