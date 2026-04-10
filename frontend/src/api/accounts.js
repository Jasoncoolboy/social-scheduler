import api from "./axios"

export const listAccounts = () =>
  api.get("/api/accounts/").then((r) => r.data)

export const loginInstagram = (data) =>
  api.post("/api/accounts/login", data).then((r) => r.data)

export const verifyCode = (data) =>
  api.post("/api/accounts/verify", data).then((r) => r.data)

export const deleteAccount = (id) =>
  api.delete(`/api/accounts/${id}`).then((r) => r.data)