import api from "./axios"

export const listAccounts = () =>
  api.get("/api/accounts/").then(r => r.data)

export const loginInstagram = (data) =>
  api.post("/api/accounts/login", data).then(r => r.data)

// 2FA — authenticator app or SMS code
export const verifyCode = (data) =>
  api.post("/api/accounts/verify", data).then(r => r.data)

// Challenge — code sent by Instagram to email/SMS
export const submitChallengeCode = (data) =>
  api.post("/api/accounts/challenge-code", data).then(r => r.data)

// Challenge — user approved in Instagram app (no code)
export const retryAfterChallenge = (data) =>
  api.post("/api/accounts/retry-challenge", data).then(r => r.data)

export const deleteAccount = (id) =>
  api.delete(`/api/accounts/${id}`).then(r => r.data)