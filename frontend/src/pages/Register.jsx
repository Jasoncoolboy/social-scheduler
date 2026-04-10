import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { register } from "../api/auth"
import toast from "react-hot-toast"
import { Camera } from "lucide-react"

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: "", email: "", password: "" })

  const mutation = useMutation({
    mutationFn: () => register(form),
    onSuccess: () => {
      toast.success("Account created! Please sign in.")
      navigate("/login")
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || "Registration failed"),
  })

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-600 rounded-2xl mb-4">
            <Camera size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-gray-500 mt-1">Start scheduling your posts</p>
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
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary w-full mt-2"
            >
              {mutation.isPending ? "Creating..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-500 hover:text-brand-400">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}