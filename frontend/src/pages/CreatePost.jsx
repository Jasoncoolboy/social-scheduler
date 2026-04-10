import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createPost,
  updatePost,
  uploadMedia,
  deleteMedia,
  schedulePost,
  publishNow,
} from "../api/posts"
import { listAccounts } from "../api/accounts"
import MediaDropzone from "../components/MediaDropzone"
import toast from "react-hot-toast"
import dayjs from "dayjs"
import { Send, CalendarClock, Save, ArrowLeft } from "lucide-react"

const POST_TYPES = [
  { value: "feed",     label: "📷 Feed Post"  },
  { value: "story",    label: "📱 Story"       },
  { value: "carousel", label: "🎠 Carousel"    },
]

export default function CreatePost() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createdPost, setCreatedPost] = useState(null)
  const [form, setForm] = useState({
    instagram_account_id: "",
    caption: "",
    hashtags: "",
    post_type: "feed",
    scheduled_at: "",
  })
  const [uploadingFiles, setUploadingFiles] = useState(false)

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  })

  // Step 1 — create draft post
  const createMutation = useMutation({
    mutationFn: () =>
      createPost({
        ...form,
        instagram_account_id: Number(form.instagram_account_id),
        scheduled_at: form.scheduled_at
          ? new Date(form.scheduled_at).toISOString()
          : null,
      }),
    onSuccess: (post) => {
      setCreatedPost(post)
      toast.success("Post draft created — now upload your media!")
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || "Failed to create post"),
  })

  // Update draft
  const updateMutation = useMutation({
    mutationFn: (data) => updatePost(createdPost.id, data),
    onSuccess: (post) => setCreatedPost(post),
  })

  // Upload media files
  const onDrop = useCallback(
    async (acceptedFiles) => {
      if (!createdPost) {
        toast.error("Create the post draft first, then upload media")
        return
      }
      setUploadingFiles(true)
      try {
        let updatedPost = createdPost
        for (const file of acceptedFiles) {
          updatedPost = await uploadMedia(createdPost.id, file)
        }
        setCreatedPost(updatedPost)
        toast.success(`${acceptedFiles.length} file(s) uploaded`)
      } catch {
        toast.error("Failed to upload some files")
      } finally {
        setUploadingFiles(false)
      }
    },
    [createdPost]
  )

  // Remove media
  const handleRemoveMedia = async (mediaId) => {
    try {
      const updated = await deleteMedia(createdPost.id, mediaId)
      setCreatedPost((prev) => ({
        ...prev,
        media_files: prev.media_files.filter((m) => m.id !== mediaId),
      }))
      toast.success("Media removed")
    } catch {
      toast.error("Failed to remove media")
    }
  }

  // Schedule
  const scheduleMutation = useMutation({
    mutationFn: () => {
      if (form.scheduled_at) {
        return updatePost(createdPost.id, {
          scheduled_at: new Date(form.scheduled_at).toISOString(),
        }).then(() => schedulePost(createdPost.id))
      }
      return schedulePost(createdPost.id)
    },
    onSuccess: () => {
      toast.success("Post scheduled! ✅")
      queryClient.invalidateQueries({ queryKey: ["posts"] })
      navigate("/posts")
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || "Failed to schedule"),
  })

  // Publish now
  const publishMutation = useMutation({
    mutationFn: () => publishNow(createdPost.id),
    onSuccess: () => {
      toast.success("Post published to Instagram! 🎉")
      queryClient.invalidateQueries({ queryKey: ["posts"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
      navigate("/posts")
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || "Failed to publish"),
  })

  const charCount = (form.caption || "").length
  const hashtagCount = form.hashtags
    ? form.hashtags.split(/\s+/).filter((w) => w.startsWith("#")).length
    : 0

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Create Post</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {createdPost ? `Draft #${createdPost.id} created` : "Fill in the details below"}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1 — Post details */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">1</span>
            Post Details
          </h2>

          {/* Account */}
          <div>
            <label className="label">Instagram Account *</label>
            <select
              className="input"
              value={form.instagram_account_id}
              onChange={(e) =>
                setForm({ ...form, instagram_account_id: e.target.value })
              }
              disabled={!!createdPost}
              required
            >
              <option value="">Select account...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  @{acc.ig_username}
                  {acc.ig_full_name ? ` — ${acc.ig_full_name}` : ""}
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <p className="text-xs text-yellow-400 mt-1">
                No accounts connected.{" "}
                <button
                  onClick={() => navigate("/settings")}
                  className="underline"
                >
                  Go to Settings
                </button>
              </p>
            )}
          </div>

          {/* Post type */}
          <div>
            <label className="label">Post Type</label>
            <div className="flex gap-3">
              {POST_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, post_type: value })}
                  disabled={!!createdPost}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.post_type === value
                      ? "border-brand-500 bg-brand-600/20 text-brand-400"
                      : "border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Caption</label>
              <span className={`text-xs ${charCount > 2000 ? "text-red-400" : "text-gray-500"}`}>
                {charCount} / 2200
              </span>
            </div>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Write your caption here..."
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              maxLength={2200}
            />
          </div>

          {/* Hashtags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Hashtags</label>
              <span className={`text-xs ${hashtagCount > 30 ? "text-red-400" : "text-gray-500"}`}>
                {hashtagCount} / 30
              </span>
            </div>
            <textarea
              className="input resize-none"
              rows={3}
              placeholder="#photography #travel #lifestyle"
              value={form.hashtags}
              onChange={(e) => setForm({ ...form, hashtags: e.target.value })}
            />
            <p className="text-xs text-gray-600 mt-1">
              Hashtags will be added below your caption automatically
            </p>
          </div>

          {/* Scheduled time */}
          <div>
            <label className="label">Schedule For (optional)</label>
            <input
              className="input"
              type="datetime-local"
              min={dayjs().add(5, "minute").format("YYYY-MM-DDTHH:mm")}
              value={form.scheduled_at}
              onChange={(e) =>
                setForm({ ...form, scheduled_at: e.target.value })
              }
            />
            <p className="text-xs text-gray-600 mt-1">
              Leave empty to post immediately or save as draft
            </p>
          </div>

          {/* Create draft button */}
          {!createdPost && (
            <button
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending || !form.instagram_account_id
              }
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Save size={16} />
              {createMutation.isPending ? "Creating Draft..." : "Save Draft & Continue"}
            </button>
          )}

          {createdPost && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-950 rounded-lg p-3">
              ✅ Draft saved — now upload your media below
            </div>
          )}
        </div>

        {/* Step 2 — Media upload */}
        {createdPost && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              Upload Media
              {uploadingFiles && (
                <span className="text-xs text-gray-400 animate-pulse ml-2">
                  Uploading...
                </span>
              )}
            </h2>

            <MediaDropzone
              onDrop={onDrop}
              mediaFiles={createdPost.media_files || []}
              onRemove={handleRemoveMedia}
            />

            {form.post_type === "carousel" && (
              <p className="text-xs text-blue-400 bg-blue-950 rounded-lg px-3 py-2">
                📌 Carousel: upload 2–10 images/videos
              </p>
            )}
            {form.post_type === "story" && (
              <p className="text-xs text-purple-400 bg-purple-950 rounded-lg px-3 py-2">
                📌 Story: upload 1 image or video (9:16 ratio recommended)
              </p>
            )}
          </div>
        )}

        {/* Step 3 — Publish */}
        {createdPost && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">3</span>
              Publish
            </h2>

            {!createdPost.media_files?.length && (
              <p className="text-sm text-yellow-400 bg-yellow-950 rounded-lg px-3 py-2">
                ⚠️ Upload at least one media file before publishing
              </p>
            )}

            <div className="flex gap-3">
              {/* Schedule button */}
              {form.scheduled_at && (
                <button
                  onClick={() => scheduleMutation.mutate()}
                  disabled={
                    scheduleMutation.isPending ||
                    !createdPost.media_files?.length
                  }
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <CalendarClock size={16} />
                  {scheduleMutation.isPending
                    ? "Scheduling..."
                    : `Schedule for ${dayjs(form.scheduled_at).format("MMM D [at] h:mm A")}`}
                </button>
              )}

              {/* Publish now */}
              <button
                onClick={() => publishMutation.mutate()}
                disabled={
                  publishMutation.isPending ||
                  !createdPost.media_files?.length
                }
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {publishMutation.isPending ? "Publishing..." : "Publish Now"}
              </button>
            </div>

            {/* Save as draft only */}
            <button
              onClick={() => navigate("/posts")}
              className="btn-secondary w-full text-sm"
            >
              Save as Draft & Exit
            </button>
          </div>
        )}
      </div>
    </div>
  )
}