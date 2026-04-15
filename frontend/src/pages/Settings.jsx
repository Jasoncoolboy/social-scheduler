import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listAccounts,
  loginInstagram,
  verifyCode,
  deleteAccount,
  retryAfterChallenge,
  submitChallengeCode,
} from "../api/accounts"
import toast from "react-hot-toast"
import { Trash2, Plus, Eye, EyeOff, Loader, CheckCircle, XCircle } from "lucide-react"
import dayjs from "dayjs"

// Which step of the connection flow are we on?
// null | 'form' | 'two_factor' | 'challenge_approve' | 'challenge_code'
const STEP = {
  NONE:             null,
  FORM:             "form",
  TWO_FACTOR:       "two_factor",
  CHALLENGE_APPROVE:"challenge_approve",
  CHALLENGE_CODE:   "challenge_code",
}

export default function Settings() {
  const queryClient = useQueryClient()

  const [step, setStep]         = useState(STEP.NONE)
  const [form, setForm]         = useState({ ig_username: "", ig_password: "" })
  const [showPw, setShowPw]     = useState(false)
  const [pendingUser, setPendingUser] = useState("")  // ig_username mid-flow
  const [pendingFlowId, setPendingFlowId] = useState("")
  const [code, setCode]         = useState("")        // 2FA or challenge code
  const [twoFaMethod, setTwoFaMethod] = useState("sms") // "sms" | "totp"
  const [twoFaHint, setTwoFaHint]     = useState("") // Phone number or app name

  const reset = () => {
    setStep(STEP.NONE)
    setForm({ ig_username: "", ig_password: "" })
    setPendingUser("")
    setPendingFlowId("")
    setCode("")
    setShowPw(false)
    setTwoFaMethod("sms")   // ← add
    setTwoFaHint("")        // ← add
  }

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  })
  // ── Login ──────────────────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: () => loginInstagram(form),
    onSuccess: (res) => {
      if (res.status === "success") {
        toast.success(`@${res.ig_username} connected!`)
        queryClient.invalidateQueries({ queryKey: ["accounts"] })
        reset()
        return
      }

      // Save the username for next steps
      const username = res.ig_username || form.ig_username
      setPendingUser(username)
      setPendingFlowId(res.flow_id || "")

      if (res.status === "two_factor_required") {
        setStep(STEP.TWO_FACTOR)
        setTwoFaMethod(res.method || "sms")
        setTwoFaHint(res.phone_hint || "")
        toast(res.message || "Enter your 2FA code", { icon: "🔐" })
        return
      }

      if (res.status === "challenge_code_required") {
        // Instagram sent a code to email/SMS
        setStep(STEP.CHALLENGE_CODE)
        toast("Instagram sent a code to your email or phone", { icon: "📨" })
        return
      }

      if (res.status === "challenge_required") {
        // Instagram sent an approval notification to the app
        setStep(STEP.CHALLENGE_APPROVE)
        toast("Check the Instagram app on your phone", { icon: "📱" })
        return
      }
    },
    onError: (e) => toast.error(e?.response?.data?.detail || "Login failed"),
  })

  // ── 2FA (authenticator app code) ───────────────────────────────────────────
  const twoFaMutation = useMutation({
    mutationFn: () => verifyCode({ ig_username: pendingUser, code, flow_id: pendingFlowId }),
    onSuccess: (res) => {
      if (res.status === "success") {
        toast.success("Account connected!")
        queryClient.invalidateQueries({ queryKey: ["accounts"] })
        reset()
      } else {
        toast.error(res.message || "Verification failed")
      }
    },
    onError: () => toast.error("Verification failed — check your code"),
  })

  // ── Challenge code (SMS/email sent by Instagram) ───────────────────────────
  const challengeCodeMutation = useMutation({
    mutationFn: () => submitChallengeCode({ ig_username: pendingUser, code, flow_id: pendingFlowId }),
    onSuccess: (res) => {
      if (res.status === "success") {
        toast.success("Account connected!")
        queryClient.invalidateQueries({ queryKey: ["accounts"] })
        reset()
      } else {
        toast.error(res.message || "Code verification failed")
      }
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || "Invalid code"),
  })

  // ── Challenge approve (user taps approve in IG app) ────────────────────────
  const retryMutation = useMutation({
    mutationFn: () => retryAfterChallenge({ ig_username: pendingUser, flow_id: pendingFlowId }),
    onSuccess: (res) => {
      if (res.status === "success") {
        toast.success("Account connected!")
        queryClient.invalidateQueries({ queryKey: ["accounts"] })
        reset()
      } else {
        toast.error(
          res.message || "Still not approved — try again in a moment"
        )
      }
    },
    onError: () => toast.error("Retry failed — please try again"),
  })

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAccount(id),
    onSuccess: () => {
      toast.success("Account disconnected")
      queryClient.invalidateQueries({ queryKey: ["accounts"] })
    },
    onError: () => toast.error("Failed to disconnect"),
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your connected Instagram accounts
        </p>
      </div>

      {/* ── Accounts list ──────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Connected Accounts
          </h2>
          {step === STEP.NONE && (
            <button
              onClick={() => setStep(STEP.FORM)}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              <Plus size={13} />
              Add Account
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader size={20} className="animate-spin text-gray-300" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 space-y-1">
            <p className="text-sm text-gray-400">No accounts connected</p>
            <p className="text-xs text-gray-300">
              Add your Instagram account to start scheduling
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0 uppercase">
                  {acc.ig_username[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      @{acc.ig_username}
                    </p>
                    {acc.is_active ? (
                      <CheckCircle size={13} className="text-green-500 shrink-0" />
                    ) : (
                      <XCircle size={13} className="text-red-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">
                    {acc.ig_full_name || "Personal Account"}
                    {acc.last_login &&
                      ` · Last login ${dayjs(acc.last_login).format("MMM D, YYYY")}`}
                  </p>
                </div>

                {/* Remove */}
                <button
                  onClick={() => {
                    if (confirm(`Disconnect @${acc.ig_username}?`))
                      deleteMutation.mutate(acc.id)
                  }}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── STEP: Add account form ─────────────────────────────────────────── */}
      {step === STEP.FORM && (
        <div className="card space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">
                Connect Instagram Account
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Personal accounts supported
              </p>
            </div>
            <button
              onClick={reset}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Warning notice */}
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2">
            <span className="text-xs shrink-0 mt-0.5">⚠️</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              Credentials are only used to create a session.
              Excessive use may trigger Instagram security — use responsibly.
            </p>
          </div>

          {/* Username */}
          <div>
            <label className="label">Instagram Username</label>
            <input
              className="input"
              placeholder="your_instagram_username"
              value={form.ig_username}
              onChange={(e) =>
                setForm((f) => ({ ...f, ig_username: e.target.value }))
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
                  setForm((f) => ({ ...f, ig_password: e.target.value }))
                }
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Actions */}
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
                <><Loader size={14} className="animate-spin" /> Connecting...</>
              ) : (
                "Connect Account"
              )}
            </button>
            <button onClick={reset} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: Two-Factor (authenticator app / SMS code) ───────────────── */}
      {step === STEP.TWO_FACTOR && (
        <div className="card space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">
                Two-Factor Authentication
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                For{" "}
                <span className="font-medium text-gray-700">
                  @{pendingUser}
                </span>
              </p>
            </div>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>

          {/* Dynamic hint based on 2FA method */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-blue-800">
              {twoFaMethod === "totp"
                ? " Open your authenticator app"
                : " Check your SMS or WhatsApp"}
            </p>
            {twoFaHint && (
              <p className="text-xs text-blue-600">
                Code sent to: <span className="font-medium">{twoFaHint}</span>
              </p>
            )}
            <p className="text-xs text-blue-500 mt-1">
              Enter the code quickly — it expires in 30 seconds
            </p>
          </div>

          <div>
            <label className="label">6-Digit Code</label>
            <input
              className="input text-center text-2xl tracking-[0.5em] font-mono"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => twoFaMutation.mutate()}
              disabled={twoFaMutation.isPending || code.length !== 6}
              className="btn-primary flex-1"
            >
              {twoFaMutation.isPending ? (
                <><Loader size={14} className="animate-spin" /> Verifying...</>
              ) : (
                "Verify & Connect"
              )}
            </button>
            <button onClick={reset} className="btn-secondary">
              Cancel
            </button>
          </div>

          {/* Show error detail */}
          {twoFaMutation.isError && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs text-red-600">
                {twoFaMutation.error?.response?.data?.detail || "Verification failed"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── STEP: Challenge — code sent to email/SMS ───────────────────────── */}
      {step === STEP.CHALLENGE_CODE && (
        <div className="card space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">
                Verification Code
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                For{" "}
                <span className="font-medium text-gray-700">
                  @{pendingUser}
                </span>
              </p>
            </div>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              📨 Instagram sent a verification code to your{" "}
              <strong>email or phone number</strong>. Enter it below.
            </p>
          </div>

          <div>
            <label className="label">Verification Code</label>
            <input
              className="input text-center text-2xl tracking-[0.5em] font-mono"
              placeholder="000000"
              maxLength={8}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
              }
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => challengeCodeMutation.mutate()}
              disabled={challengeCodeMutation.isPending || code.length < 6}
              className="btn-primary flex-1"
            >
              {challengeCodeMutation.isPending ? (
                <><Loader size={14} className="animate-spin" /> Verifying...</>
              ) : (
                "Submit Code"
              )}
            </button>
            <button onClick={reset} className="btn-secondary">
              Cancel
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            Got an app approval instead?{" "}
            <button
              onClick={() => setStep(STEP.CHALLENGE_APPROVE)}
              className="text-gray-700 font-medium hover:underline"
            >
              Click here
            </button>
          </p>
        </div>
      )}

      {/* ── STEP: Challenge — approve in Instagram app ─────────────────────── */}
      {step === STEP.CHALLENGE_APPROVE && (
        <div className="card space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">
                Approve Login in Instagram App
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                For{" "}
                <span className="font-medium text-gray-700">
                  @{pendingUser}
                </span>
              </p>
            </div>
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>

          {/* Step by step */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Follow these steps
            </p>
            <ol className="space-y-2.5">
              {[
                "Open Instagram on your phone",
                "Look for a login notification or security alert",
                'Tap "Approve" or "It was me"',
                "Come back here and click the button below",
              ].map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-xs text-blue-700"
                >
                  <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-900 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Error state */}
          {retryMutation.isError && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs text-red-600">
                Still blocked. Make sure you approved it in the app,
                then wait 30 seconds and try again.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="btn-primary flex-1"
            >
              {retryMutation.isPending ? (
                <><Loader size={14} className="animate-spin" /> Checking...</>
              ) : (
                "✓ I approved it — Try Again"
              )}
            </button>
            <button onClick={reset} className="btn-secondary">
              Cancel
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            Received a code instead?{" "}
            <button
              onClick={() => setStep(STEP.CHALLENGE_CODE)}
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