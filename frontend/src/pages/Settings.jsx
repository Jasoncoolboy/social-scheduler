import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listAccounts, loginInstagram, verifyCode, deleteAccount } from "../api/accounts"
import toast from "react-hot-toast"
import { Camera, Trash2, Plus, Eye, EyeOff, RefreshCw } from "lucide-react"
import dayjs from "dayjs"

export default function Settings() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ig_username: "", ig_password: "" })
  const [showPw, setShowPw] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [twoFaState, setTwoFaState] = useState(null) // { ig_username }
  const [twoFaCode, setTwoFaCode] = useState("")

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  })

  const loginMutation = useMutation({
    mutationFn: () => loginInstagram(form),
    onSuccess: (result) => {
      if (result.status === "success") {
        toast.success(`@${result.ig_username} connected! ✅`)
        queryClient.invalidateQueries({ queryKey: ["accounts"] })
        setForm({ ig_username: "", ig_password: "" })
        setShowForm(false)
      } else if (result.status === "two_factor_required") {
        setTwoFaState({ ig_username: form.ig_username })
        toast("Two-factor authentication required. Check your app/SMS.", { icon: "🔐" })
      } else if (result.status === "challenge_required") {
        toast("Instagram challenge required — approve it in the Instagram app, then try again.", {
          icon: "⚠️",
          duration: 6000,
        })
      }
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || "Login failed"),
  })

  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyCode({ ig_username: twoFaState.ig_username, code: twoFaCode }),
    onSuccess: (result) => {
      if (result.status === "success") {
        toast.success("Account verified and connected! ✅")
        queryClient.invalidateQueries({ queryKey: ["accounts"] })
        setTwoFaState(null)
        setTwoFaCode("")
        setShowForm(false)
      } else {
        toast.error(result.message || "Verification failed")
      }
    },
    onError: () => toast.error("Verification failed"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAccount(id),
    onSuccess: () => {
      toast.success("Account disconnected")
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
    },
    onError: () => toast.error("Failed to disconnect account"),
  })

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Manage your Instagram accounts
        </p>
      </div>

      {/* Connected accounts */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Camera size={18} className="text-brand-500" />
            Connected Accounts
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary flex items-center gap-2 text-sm py-1.5 px-3"
          >
            <Plus size={15} />
            Add Account
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8">
            <Camera size={36} className="mx-auto text-gray-700 mb-2" />
            <p className="text-gray-500">No accounts connected yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center gap-4 bg-gray-800 rounded-xl p-4"
              >
                {/* Avatar */}
                {acc.ig_profile_pic_url ? (
                  <img
                    src={acc.ig_profile_pic_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold">
                    {acc.ig_username[0].toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">@{acc.ig_username}</p>
                  <p className="text-gray-500 text-xs">
                    {acc.ig_full_name || "Personal Account"} ·{" "}
                    {acc.is_active ? (
                      <span className="text-green-400">Active</span>
                    ) : (
                      <span className="text-red-400">Inactive</span>
                    )}
                  </p>
                  {acc.last_login && (
                    <p className="text-gray-600 text-xs mt-0.5">
                      Last login: {dayjs(acc.last_login).format("MMM D, YYYY")}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (confirm(`Disconnect @${acc.ig_username}?`)) {
                      deleteMutation.mutate(acc.id)
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add account form */}
      {showForm && !twoFaState && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">Connect Instagram Account</h2>

          <div className="bg-yellow-950 border border-yellow-800 rounded-lg p-3 text-sm text-yellow-300">
            ⚠️ Your credentials are used only to create a session and are not stored in plain text.
            Use with caution on personal accounts.
          </div>

          <div>
            <label className="label">Instagram Username</label>
            <input
              className="input"
              placeholder="your_instagram_username"
              value={form.ig_username}
              onChange={(e) => setForm({ ...form, ig_username: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Instagram Password</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={form.ig_password}
                onChange={(e) => setForm({ ...form, ig_password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => loginMutation.mutate()}
              disabled={loginMutation.isPending || !form.ig_username || !form.ig_password}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <RefreshCw size={15} className={loginMutation.isPending ? "animate-spin" : ""} />
              {loginMutation.isPending ? "Connecting..." : "Connect Account"}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 2FA form */}
      {twoFaState && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-white">🔐 Two-Factor Authentication</h2>
          <p className="text-gray-400 text-sm">
            Enter the 6-digit code from your authenticator app or SMS for{" "}
            <span className="text-white">@{twoFaState.ig_username}</span>
          </p>

          <div>
            <label className="label">Verification Code</label>
            <input
              className="input text-center text-2xl tracking-widest"
              placeholder="000000"
              maxLength={6}
              value={twoFaCode}
              onChange={(e) =>
                setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending || twoFaCode.length !== 6}
              className="btn-primary flex-1"
            >
              {verifyMutation.isPending ? "Verifying..." : "Verify"}
            </button>
            <button
              onClick={() => { setTwoFaState(null); setTwoFaCode("") }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}