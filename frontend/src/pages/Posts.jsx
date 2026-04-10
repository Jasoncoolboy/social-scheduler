import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { listPosts } from "../api/posts"
import PostCard from "../components/PostCard"
import { useNavigate } from "react-router-dom"
import { PlusCircle, Inbox } from "lucide-react"

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
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Posts</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {posts.length} post{posts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => navigate("/create")}
          className="btn-primary flex items-center gap-2"
        >
          <PlusCircle size={18} />
          New Post
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              filter === value
                ? "border-brand-500 text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Posts grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="aspect-square rounded-lg bg-gray-800 mb-4" />
              <div className="h-4 bg-gray-800 rounded mb-2" />
              <div className="h-3 bg-gray-800 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="card text-center py-20">
          <Inbox size={48} className="mx-auto text-gray-700 mb-3" />
          <p className="text-gray-400 font-medium">No posts found</p>
          <p className="text-gray-600 text-sm mt-1">
            {filter ? `No ${filter} posts yet` : "Create your first post to get started"}
          </p>
          <button
            onClick={() => navigate("/create")}
            className="btn-primary mt-6 inline-flex items-center gap-2"
          >
            <PlusCircle size={16} />
            Create Post
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