import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { listPosts } from "../api/posts"
import PostCard from "../components/PostCard"
import { useNavigate } from "react-router-dom"
import { PlusCircle, Inbox } from "lucide-react"
import { clsx } from "clsx"

const FILTERS = [
  { label: "All",       value: ""          },
  { label: "Drafts",    value: "draft"     },
  { label: "Scheduled", value: "scheduled" },
  { label: "Published", value: "published" },
  { label: "Failed",    value: "failed"    },
]

export default function Posts() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState("")

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts", filter],
    queryFn: () => listPosts(filter || undefined),
    refetchInterval: 20000,
  })

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">My Posts</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {posts.length} post{posts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => navigate("/create")}
          className="btn-primary"
        >
          <PlusCircle size={15} />
          New Post
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              filter === value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card p-0 overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-100" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-20 border-dashed">
          <Inbox size={32} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">
            {filter ? `No ${filter} posts` : "No posts yet"}
          </p>
          <button
            onClick={() => navigate("/create")}
            className="btn-primary mx-auto w-fit mt-4"
          >
            <PlusCircle size={15} />
            Create post
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}