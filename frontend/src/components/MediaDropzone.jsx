import { useDropzone } from "react-dropzone"
import { Upload, X, Image, Film } from "lucide-react"
import { clsx } from "clsx"

export default function MediaDropzone({ onDrop, mediaFiles = [], onRemove }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
      "video/mp4": [],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  })

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={clsx(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-brand-500 bg-brand-500/10"
            : "border-gray-700 hover:border-gray-500"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-3 text-gray-500" size={32} />
        <p className="text-gray-300 font-medium">
          {isDragActive ? "Drop files here" : "Drag & drop or click to upload"}
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Images (JPG, PNG, WEBP) or Videos (MP4) — Max 100MB
        </p>
      </div>

      {/* Preview grid */}
      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {mediaFiles.map((media) => (
            <div key={media.id} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-800">
              {media.media_type === "image" ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/media/${media.file_name}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film size={32} className="text-gray-500" />
                  <span className="text-xs text-gray-400 mt-1">Video</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => onRemove(media.id)}
                  className="p-1.5 bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
              {/* Order badge */}
              <div className="absolute top-1 left-1 bg-black/70 text-white text-xs rounded px-1.5 py-0.5">
                {media.order + 1}
              </div>
            </div>
			        ))}
        </div>
      )}
    </div>
  )
}