const LoadingCard = ({ icon }) => {
  return (
    <div className="card animate-pulse">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div className="h-6 bg-zinc-700/50 rounded w-1/3"></div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-zinc-700/50 rounded w-full"></div>
          <div className="h-4 bg-zinc-700/50 rounded w-5/6"></div>
          <div className="h-4 bg-zinc-700/50 rounded w-4/6"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingCard; 