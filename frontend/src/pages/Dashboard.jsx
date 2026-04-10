import { useQuery } from "@tanstack/react-query"
import { getDashboardStats, listPosts } from "../api/posts"
import { listAccounts } from "../api/accounts"
import StatsCard from "../components/StatsCard"
import PostCard from "../components/PostCard"
import { useNavigate } from "react-router-dom"
import {
  FileText, Clock, CheckCircle,
  AlertCircle, PlusCircle, AlertTriangle,
} from "lucide-react"

export default function Dashboard() {
  const navigate = useNavigate()

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: getDashboardStats,
    refetchInterval: 30000,
  })

  const { data: recentPosts = [] } = useQuery({
    queryKey: ["posts", "recent"],
    queryFn: () => listPosts(),
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  })

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Your content overview
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

      {/* No account warning */}
      {accounts.length === 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              No Instagram account connected
            </p>
            <p className="text-sm text-amber-600 mt-0.5">
              <button
                onClick={() => navigate("/settings")}
                className="underline hover:no-underline"
              >
                Connect an account
              </button>{" "}
              to start scheduling posts.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total"     value={stats?.total}     icon={FileText}    color="gray"  />
        <StatsCard label="Scheduled" value={stats?.scheduled} icon={Clock}       color="blue"  />
        <StatsCard label="Published" value={stats?.published} icon={CheckCircle} color="green" />
        <StatsCard label="Failed"    value={stats?.failed}    icon={AlertCircle} color="red"   />
      </div>

      {/* Recent Posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Recent Posts</h2>
          <button
            onClick={() => navigate("/posts")}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            View all →
          </button>
        </div>

        {recentPosts.length === 0 ? (
          <div className="card text-center py-16 border-dashed">
            <FileText size={32} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400 mb-4">No posts yet</p>
            <button
              onClick={() => navigate("/create")}
              className="btn-primary mx-auto w-fit"
            >
              <PlusCircle size={15} />
              Create your first post
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentPosts.slice(0, 4).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}