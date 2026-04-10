import { useQuery } from "@tanstack/react-query"
import { getDashboardStats, listPosts } from "../api/posts"
import { listAccounts } from "../api/accounts"
import StatsCard from "../components/StatsCard"
import PostCard from "../components/PostCard"
import { useNavigate } from "react-router-dom"
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  PlusCircle,
  Camera,
} from "lucide-react"

export default function Dashboard() {
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: getDashboardStats,
    refetchInterval: 30000, // refresh every 30s
  })

  const { data: recentPosts = [] } = useQuery({
    queryKey: ["posts", "recent"],
    queryFn: () => listPosts(),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  })

  const latestPosts = recentPosts.slice(0, 4)

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 mt-0.5">Overview of your scheduled content</p>
        </div>
        <button
          onClick={() => navigate("/create")}
          className="btn-primary flex items-center gap-2"
        >
          <PlusCircle size={18} />
          New Post
        </button>
      </div>

      {/* No accounts warning */}
      {accounts.length === 0 && (
        <div className="flex items-center gap-4 bg-yellow-950 border border-yellow-800 rounded-xl p-4">
          <Camera className="text-yellow-400 shrink-0" size={22} />
          <div>
            <p className="text-yellow-200 font-medium">No Instagram accounts connected</p>
            <p className="text-yellow-400 text-sm">
              Go to{" "}
              <button
                onClick={() => navigate("/settings")}
                className="underline hover:text-yellow-300"
              >
                Settings
              </button>{" "}
              to connect your Instagram account before creating posts.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Posts"  value={stats?.total}     icon={FileText}     color="brand" />
        <StatsCard label="Scheduled"    value={stats?.scheduled} icon={Clock}        color="blue"  />
        <StatsCard label="Published"    value={stats?.published} icon={CheckCircle}  color="green" />
        <StatsCard label="Failed"       value={stats?.failed}    icon={AlertCircle}  color="red"   />
      </div>

      {/* Recent Posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Posts</h2>
          <button
            onClick={() => navigate("/posts")}
            className="text-sm text-brand-500 hover:text-brand-400"
          >
            View all →
          </button>
        </div>

        {latestPosts.length === 0 ? (
          <div className="card text-center py-16">
            <FileText size={40} className="mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500">No posts yet</p>
            <button
              onClick={() => navigate("/create")}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <PlusCircle size={16} />
              Create your first post
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {latestPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}