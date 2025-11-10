import { Loader2 } from 'lucide-react'
import { useLocale } from '../locales/useLocale'

export default function LoadingSpinner() {
  const { strings } = useLocale()
  const { input } = strings

  return (
    <div className="card text-center py-12">
      <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-700 mb-2">{input.analyzing}</h3>
      <p className="text-gray-500">{input.analyzingHint}</p>
    </div>
  )
}
