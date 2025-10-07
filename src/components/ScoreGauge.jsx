export default function ScoreGauge({ score, label, color }) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-100',
      fill: 'bg-blue-600',
      text: 'text-blue-600'
    },
    purple: {
      bg: 'bg-purple-100',
      fill: 'bg-purple-600',
      text: 'text-purple-600'
    }
  }

  const colors = colorClasses[color] || colorClasses.blue
  const percentage = Math.min(100, Math.max(0, score))

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="88"
            stroke="currentColor"
            strokeWidth="12"
            fill="none"
            className="text-gray-200"
          />
          {/* Progress circle */}
          <circle
            cx="96"
            cy="96"
            r="88"
            stroke="currentColor"
            strokeWidth="12"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 88}`}
            strokeDashoffset={`${2 * Math.PI * 88 * (1 - percentage / 100)}`}
            className={colors.text}
            strokeLinecap="round"
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-4xl font-bold ${colors.text}`}>
            {score}
          </div>
          <div className="text-sm text-gray-600 mt-1">{label}</div>
        </div>
      </div>
    </div>
  )
}
