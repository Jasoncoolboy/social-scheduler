import api from "./axios"

export const listAccounts  = ()   => api.get("/api/accounts/").then(r => r.data)
export const loginInstagram = (d) => api.post("/api/accounts/login", d).then(r => r.data)
export const verifyCode     = (d) => api.post("/api/accounts/verify", d).then(r => r.data)

// Challenge: code sent via SMS/email
export const submitChallengeCode = (d) =>
  api.post("/api/accounts/challenge-code", d).then(r => r.data)

// Challenge: approved in Instagram app (no code)
export const retryAfterChallenge = (ig_username) =>
  api.post("/api/accounts/retry-challenge", { ig_username }).then(r => r.data)

export const deleteAccount = (id) =>
  api.delete(`/api/accounts/${id}`).then(r => r.data)