import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { login, getMe } from "../api/auth"
import { useAuthStore } from "../store/authStore"
import toast from "react-hot-toast"
import { Camera, Eye, EyeOff } from "lucide-react"

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({ username: "", password: "" })
  const [showPw, setShowPw] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const { access_token } = await login(form.username, form.password)
      const user = await getMe()
      return { access_token, user }
    },
    onSuccess: ({ access_token, user }) => {
      setAuth(user, access_token)
      toast.success(`Welcome back, ${user.username}!`)
      navigate("/")
    },
    onError: () => toast.error("Invalid username or password"),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-4">
            <Camera size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SocialScheduler</h1>
          <p className="text-gray-500 mt-1">Sign in to your account</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                placeholder="your username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
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
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary w-full mt-2"
            >
              {mutation.isPending ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Don't have an account?{" "}
            <Link to="/register" className="text-brand-500 hover:text-brand-400">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}