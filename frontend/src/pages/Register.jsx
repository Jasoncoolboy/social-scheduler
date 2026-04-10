import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { register } from "../api/auth"
import toast from "react-hot-toast"

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: "", email: "", password: "" })

  const mutation = useMutation({
    mutationFn: () => register(form),
    onSuccess: () => {
      toast.success("Account created!")
      navigate("/login")
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || "Registration failed"),
  })

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-900 rounded-xl mb-4">
            <span className="text-white text-lg">📅</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Create account</h1>
          <p className="text-sm text-gray-500 mt-1">Get started for free</p>
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
                placeholder="johndoe"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="john@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary w-full"
            >
              {mutation.isPending ? "Creating..." : "Create account"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-gray-900 font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}