import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { deletePost, publishNow, cancelSchedule } from "../api/posts"
import StatusBadge from "./StatusBadge"
import toast from "react-hot-toast"
import dayjs from "dayjs"
import { Trash2, Send, X, Edit, Image, Film, Clock } from "lucide-react"

export default function PostCard({ post }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["posts"] })
    queryClient.invalidateQueries({ queryKey: ["stats"] })
  }

  const deleteMutation = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => { toast.success("Post deleted"); invalidate() },
    onError: () => toast.error("Failed to delete"),
  })

  const publishMutation = useMutation({
    mutationFn: () => publishNow(post.id),
    onSuccess: () => { toast.success("Published! 🎉"); invalidate() },
    onError: (e) => toast.error(e?.response?.data?.detail || "Failed to publish"),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelSchedule(post.id),
    onSuccess: () => { toast.success("Schedule cancelled"); invalidate() },
    onError: () => toast.error("Failed to cancel"),
  })

  const firstMedia = post.media_files?.[0]
  const mediaCount = post.media_files?.length || 0

  return (
    <div className="card p-0 overflow-hidden hover:shadow-md transition-shadow">
      {/* Media preview */}
      <div className="relative aspect-square bg-gray-50">
        {firstMedia ? (
          firstMedia.media_type === "image" ? (
            <img
              src={`${BASE_URL}/media/${firstMedia.file_name}`}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
              <Film size={24} className="text-gray-300" />
              <span className="text-xs text-gray-400">Video</span>
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <Image size={24} className="text-gray-300" />
            <span className="text-xs text-gray-400">No media</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2">
          <StatusBadge status={post.status} />
        </div>

        {mediaCount > 1 && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-md">
            {mediaCount} files
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Caption */}
        <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
          {post.caption || (
            <span className="text-gray-300 italic">No caption</span>
          )}
        </p>

        {/* Post type + time */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="capitalize font-medium">{post.post_type}</span>
          {(post.scheduled_at || post.published_at) && (
            <div className="flex items-center gap-1">
              <Clock size={11} />
              {dayjs(post.scheduled_at || post.published_at).format("MMM D, h:mm A")}
            </div>
          )}
        </div>

        {/* Error */}
        {post.error_message && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-2.5 py-2">
            {post.error_message}
          </p>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {["draft", "failed"].includes(post.status) && (
            <button
              onClick={() => navigate(`/posts/${post.id}/edit`)}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              <Edit size={12} />
              Edit
            </button>
          )}

          {["draft", "scheduled", "failed"].includes(post.status) && (
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || !post.media_files?.length}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Send size={12} />
              {publishMutation.isPending ? "Posting..." : "Post Now"}
            </button>
          )}

          {post.status === "scheduled" && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              <X size={12} />
              Cancel
            </button>
          )}

          {post.status !== "published" && (
            <button
              onClick={() => { if (confirm("Delete this post?")) deleteMutation.mutate() }}
              disabled={deleteMutation.isPending}
              className="ml-auto btn-danger py-1.5 px-2.5 text-xs"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}