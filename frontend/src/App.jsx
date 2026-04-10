import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "react-hot-toast"

import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"

import Login from "./pages/Login"
import Register from "./pages/Register"
import Dashboard from "./pages/Dashboard"
import CreatePost from "./pages/CreatePost"
import Posts from "./pages/Posts"
import Calendar from "./pages/Calendar"
import Settings from "./pages/Settings"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="create" element={<CreatePost />} />
            <Route path="posts" element={<Posts />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1f2937",
            color: "#f9fafb",
            border: "1px solid #374151",
          },
          success: { iconTheme: { primary: "#a855f7", secondary: "#fff" } },
        }}
      />
    </QueryClientProvider>
  )
}