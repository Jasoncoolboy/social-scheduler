import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listAccounts,
  loginInstagram,
  verifyCode,
  deleteAccount,
  retryAfterChallenge,
} from "../api/accounts"
import toast from "react-hot-toast"
import { Trash2, Plus, Eye, EyeOff, Loader } from "lucide-react"
import dayjs from "dayjs"

export default function Settings() {
  const queryClient = useQueryClient()

  // Form state
  const [form, setForm] = useState({ ig_username: "", ig_password: "" })
  const [showPw, setShowPw] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // 2FA state
  const [twoFaState, setTwoFaState] = useState(null)   // { ig_username }
  const [twoFaCode, setTwoFaCode] = useState("")

  // Challenge state (approved in app, no code needed)
  const [challengeState, setChallengeState] = useState(null) // { ig_username }

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  // Login
  const loginMutation = useMutation({
    mutationFn: () => loginInstagram(form),
    onSuccess: (result) => {
      if (result.status === "success") {
        toast.success(`@${result.ig_username} connected!`)
        queryClient.invalidateQueries({ queryKey: ["accounts"] })
        setForm({ ig_username: "", ig_password: "" })
        setShowForm(false)

      } else if (result.status === "two_factor_required") {
        setTwoFaState({ ig_username: form.ig_username })
        setShowForm(false)
        toast("Enter your 2FA code below", { icon: "🔐" })

      } else if (result.status === "challenge_required") {
        setChallengeState({
          ig_username: result.ig_username || form.ig_username,
        })
        setShowForm(false)
        toast("Instagram requires verification — see instructions below", {
          icon: "⚠️",
          duration: 5000,
        })
      }
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || "Login failed"),
  })

  // 2FA verify
  const verifyMutation = useMutation({
    mutationFn: () =>
      verifyCode({ ig_username: twoFaState.ig_username, code: twoFaCode }),
    onSuccess: (result) => {
      if (result.status === "success") {
        toast.success("Account connected!")
        queryClient.invalidateQueries({ queryKey: ["accounts"] })
        setTwoFaState(null)
        setTwoFaCode("")
      } else {
        toast.error(result.message || "Verification failed")
      }
    },
    onError: () => toast.error("Verification failed"),
  })

  // Challenge retry (user approved in Instagram app)
  const retryMutation = useMutation({
    mutationFn: () => retryAfterChallenge(challengeState.ig_username),
    onSuccess: (result) => {
      if (result.status === "success") {
        toast.success(`@${result.ig_username} connected!`)
        queryClient.invalidateQueries({ queryKey: ["accounts"] })
        setChallengeState(null)
      } else {
        toast.error(
          result.message || "Still blocked — wait a moment and try again"
        )
      }
    },
    onError: () => toast.error("Retry failed — please try again"),
  })

  // Delete / disconnect
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAccount(id),
    onSuccess: () => {
      toast.success("Account disconnected")
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
    },
    onError: () => toast.error("Failed to disconnect account"),
  })

  // ── Helpers ────────────────────────────────────────────────────────────────
  const resetAll = () => {
    setShowForm(false)
    setTwoFaState(null)
    setTwoFaCode("")
    setChallengeState(null)
    setForm({ ig_username: "", ig_password: "" })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your connected Instagram accounts
        </p>
      </div>

      {/* ── Connected accounts ─────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Connected Accounts
          </h2>
          {!showForm && !twoFaState && !challengeState && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              <Plus size={13} />
              Add Account
            </button>
          )}
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader size={20} className="animate-spin text-gray-300" />
          </div>

        /* Empty */
        ) : accounts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">No accounts connected</p>
            <p className="text-xs text-gray-300 mt-1">
              Add your Instagram account to start scheduling
            </p>
          </div>

        /* Account list */
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-500 shrink-0">
                  {acc.ig_username[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    @{acc.ig_username}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-xs font-medium ${
                        acc.is_active ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {acc.is_active ? "Active" : "Inactive"}
                    </span>
                    {acc.ig_full_name && (
                      <span className="text-xs text-gray-300">
                        · {acc.ig_full_name}
                      </span>
                    )}
                    {acc.last_login && (
                      <span className="text-xs text-gray-300">
                        · Last login {dayjs(acc.last_login).format("MMM D")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Disconnect */}
                <button
                  onClick={() => {
                    if (confirm(`Disconnect @${acc.ig_username}?`))
                      deleteMutation.mutate(acc.id)
                  }}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Disconnect account"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add account form ───────────────────────────────────────────────── */}
      {showForm && !twoFaState && !challengeState && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Connect Instagram Account
            </h2>
            <button
              onClick={resetAll}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
            <span className="text-sm shrink-0">⚠️</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              Your credentials are only used to create a session and are
              not stored in plain text. Use with caution — excessive
              automation may trigger Instagram's security systems.
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="label">Instagram Username</label>
            <input
              className="input"
              placeholder="your_username"
              value={form.ig_username}
              onChange={(e) =>
                setForm({ ...form, ig_username: e.target.value })
              }
              autoFocus
              autoComplete="off"
            />
          </div>

          {/* Password */}
          <div>
            <label className="label">Instagram Password</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={form.ig_password}
                onChange={(e) =>
                  setForm({ ...form, ig_password: e.target.value })
                }
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-2">
            <button
              onClick={() => loginMutation.mutate()}
              disabled={
                loginMutation.isPending ||
                !form.ig_username.trim() ||
                !form.ig_password.trim()
              }
              className="btn-primary flex-1"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader size={14} className="animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Account"
              )}
            </button>
            <button onClick={resetAll} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Two-Factor Authentication form ─────────────────────────────────── */}
      {twoFaState && !challengeState && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">
                Two-Factor Authentication
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Enter the 6-digit code for{" "}
                <span className="font-medium text-gray-700">
                  @{twoFaState.ig_username}
                </span>
              </p>
            </div>
            <button
              onClick={resetAll}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              Check your authenticator app or SMS for your verification code.
            </p>
          </div>

          {/* Code input */}
          <div>
            <label className="label">Verification Code</label>
            <input
              className="input text-center text-2xl tracking-[0.6em] font-mono"
              placeholder="000000"
              maxLength={6}
              value={twoFaCode}
              onChange={(e) =>
                setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending || twoFaCode.length !== 6}
              className="btn-primary flex-1"
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader size={14} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Connect"
              )}
            </button>
            <button onClick={resetAll} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Challenge approved in app (no code needed) ─────────────────────── */}
      {challengeState && !twoFaState && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">
                Instagram Verification Required
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                For{" "}
                <span className="font-medium text-gray-700">
                  @{challengeState.ig_username}
                </span>
              </p>
            </div>
            <button
              onClick={resetAll}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
              Follow these steps
            </p>
            <ol className="space-y-2">
              {[
                "Open the Instagram app on your phone",
                "Look for a security notification or login request",
                "Tap Approve or It was me",
                "Come back here and click the button below",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-blue-700">
                  <span className="w-4 h-4 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center font-semibold shrink-0 mt-0.5 text-[10px]">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Retry status message */}
          {retryMutation.isError && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs text-red-600">
                Still blocked. Make sure you approved it in the Instagram app,
                then wait 30 seconds and try again.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="btn-primary flex-1"
            >
              {retryMutation.isPending ? (
                <>
                  <Loader size={14} className="animate-spin" />
                  Checking...
                </>
              ) : (
                "✓ I approved it — Try Again"
              )}
            </button>
            <button onClick={resetAll} className="btn-secondary">
              Cancel
            </button>
          </div>

          {/* Try with 2FA instead */}
          <p className="text-center text-xs text-gray-400">
            Got a code instead?{" "}
            <button
              onClick={() => {
                setTwoFaState({ ig_username: challengeState.ig_username })
                setChallengeState(null)
              }}
              className="text-gray-700 font-medium hover:underline"
            >
              Enter it here
            </button>
          </p>
        </div>
      )}

    </div>
  )
}