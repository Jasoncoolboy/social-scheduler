import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { login, getMe } from "../api/auth"
import { useAuthStore } from "../store/authStore"
import toast from "react-hot-toast"
import { Eye, EyeOff } from "lucide-react"

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({ username: "", password: "" })
  const [showPw, setShowPw] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const { access_token } = await login(form.username, form.password)
      localStorage.setItem("access_token", access_token)
      const user = await getMe()
      return { access_token, user }
    },
    onSuccess: ({ access_token, user }) => {
      setAuth(user, access_token)
      toast.success(`Welcome back, ${user.username}!`)
      navigate("/")
    },
    onError: () => {
      localStorage.removeItem("access_token")
      toast.error("Invalid username or password")
    },
  })

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-900 rounded-xl mb-4">
            <span className="text-white text-lg">📅</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Sign in</h1>
          <p className="text-sm text-gray-500 mt-1">
            Schedule your Instagram content
          </p>
        </div>

        <div className="card">
          <form
            onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
            className="space-y-4"
          >
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                placeholder="your username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary w-full"
            >
              {mutation.isPending ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            No account?{" "}
            <Link
              to="/register"
              className="text-gray-900 font-medium hover:underline"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}