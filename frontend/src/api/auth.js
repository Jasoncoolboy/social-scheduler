import api from "./axios"

export const register = (data) =>
  api.post("/api/auth/register", data).then((r) => r.data)

export const login = async (username, password) => {
  const form = new FormData()
  form.append("username", username)
  form.append("password", password)
  const res = await api.post("/api/auth/token", form)
  return res.data
}

export const getMe = () =>
  api.get("/api/auth/me").then((r) => r.data)