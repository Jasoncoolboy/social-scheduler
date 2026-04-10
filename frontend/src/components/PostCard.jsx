import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { deletePost, publishNow, cancelSchedule } from "../api/posts"
import StatusBadge from "./StatusBadge"
import toast from "react-hot-toast"
import dayjs from "dayjs"
import {
  Trash2,
  Send,
  X,
  Edit,
  Image,
  Film,
  Clock,
} from "lucide-react"

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
    onError: () => toast.error("Failed to delete post"),
  })

  const publishMutation = useMutation({
    mutationFn: () => publishNow(post.id),
    onSuccess: () => { toast.success("Post published! 🎉"); invalidate() },
    onError: (e) => toast.error(e?.response?.data?.detail || "Publish failed"),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelSchedule(post.id),
    onSuccess: () => { toast.success("Schedule cancelled"); invalidate() },
    onError: () => toast.error("Failed to cancel"),
  })

  const firstMedia = post.media_files?.[0]
  const mediaCount = post.media_files?.length || 0

  return (
    <div className="card hover:border-gray-700 transition-colors">
      {/* Media preview */}
      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-800 mb-4">
        {firstMedia ? (
          firstMedia.media_type === "image" ? (
            <img
              src={`${BASE_URL}/media/${firstMedia.file_name}`}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Film size={32} className="text-gray-500" />
              <span className="text-xs text-gray-500">Video</span>
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Image size={32} className="text-gray-600" />
            <span className="text-xs text-gray-600">No media</span>
          </div>
        )}

        {/* media count badge */}
        {mediaCount > 1 && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
            +{mediaCount - 1} more
          </div>
        )}

        {/* post type badge */}
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full capitalize">
          {post.post_type}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-gray-300 line-clamp-2 flex-1">
            {post.caption || (
              <span className="text-gray-600 italic">No caption</span>
            )}
          </p>
          <StatusBadge status={post.status} />
        </div>

        {/* Scheduled time */}
        {post.scheduled_at && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={12} />
            <span>
              {post.status === "published" ? "Published" : "Scheduled"}{" "}
              {dayjs(post.scheduled_at).format("MMM D, YYYY [at] h:mm A")}
            </span>
          </div>
        )}

        {/* Error message */}
        {post.error_message && (
          <p className="text-xs text-red-400 bg-red-950 rounded-lg px-3 py-2">
            ⚠️ {post.error_message}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {/* Edit — only draft/failed */}
          {["draft", "failed"].includes(post.status) && (
            <button
              onClick={() => navigate(`/posts/${post.id}/edit`)}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Edit size={13} />
              Edit
            </button>
          )}

          {/* Publish now — draft/scheduled/failed */}
          {["draft", "scheduled", "failed"].includes(post.status) && (
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || !post.media_files?.length}
              className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Send size={13} />
              {publishMutation.isPending ? "Publishing..." : "Post Now"}
            </button>
          )}

          {/* Cancel schedule */}
          {post.status === "scheduled" && (
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <X size={13} />
              Cancel
            </button>
          )}

          {/* Delete */}
          {post.status !== "published" && (
            <button
              onClick={() => {
                if (confirm("Delete this post?")) deleteMutation.mutate()
              }}
              disabled={deleteMutation.isPending}
              className="ml-auto btn-danger flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}