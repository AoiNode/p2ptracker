export default function LoadingSpinner({ size = "medium" }: { size?: "small" | "medium" | "large" }) {
  const sizeClasses = {
    small: "w-4 h-4 border-2",
    medium: "w-8 h-8 border-3",
    large: "w-12 h-12 border-4"
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeClasses[size]} border-purple-200 border-t-purple-600 rounded-full animate-spin`}></div>
    </div>
  );
}
