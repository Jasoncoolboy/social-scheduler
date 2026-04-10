import api from "./axios"

export const listPosts = (status) =>
  api.get("/api/posts/", { params: status ? { status } : {} }).then((r) => r.data)

export const createPost = (data) =>
  api.post("/api/posts/", data).then((r) => r.data)

export const getPost = (id) =>
  api.get(`/api/posts/${id}`).then((r) => r.data)

export const updatePost = (id, data) =>
  api.patch(`/api/posts/${id}`, data).then((r) => r.data)

export const deletePost = (id) =>
  api.delete(`/api/posts/${id}`).then((r) => r.data)

export const uploadMedia = (postId, file) => {
  const form = new FormData()
  form.append("file", file)
  return api.post(`/api/posts/${postId}/media`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data)
}

export const deleteMedia = (postId, mediaId) =>
  api.delete(`/api/posts/${postId}/media/${mediaId}`).then((r) => r.data)

export const schedulePost = (id) =>
  api.post(`/api/posts/${id}/schedule`).then((r) => r.data)

export const publishNow = (id) =>
  api.post(`/api/posts/${id}/publish-now`).then((r) => r.data)

export const cancelSchedule = (id) =>
  api.post(`/api/posts/${id}/cancel`).then((r) => r.data)

export const getDashboardStats = () =>
  api.get("/api/dashboard/stats").then((r) => r.data)

export const getCalendarPosts = () =>
  api.get("/api/dashboard/calendar").then((r) => r.data)