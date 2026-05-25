import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useUIStore } from '@/stores/uiStore'

interface List {
  id: string
  name: string
  share_code: string
  created_at: string
}

export default function ListPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const dismissedBanners = useUIStore((state) => state.dismissedBanners)
  const [list, setList] = useState<List | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) {
      navigate('/')
      return
    }

    async function fetchList() {
      const { data, error: supabaseError } = await supabase
        .from('lists')
        .select('id, name, share_code, created_at')
        .eq('share_code', code)
        .single()

      if (supabaseError || !data) {
        setError('List not found')
      } else {
        setList(data)
      }
      setLoading(false)
    }

    fetchList()
  }, [code, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p>Loading...</p>
      </div>
    )
  }

  if (error || !list) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p>List not found</p>
        <Link to="/" className="text-blue-600 underline mt-2">
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4">
      <h1 className="text-2xl font-semibold">{list.name}</h1>
      {/* dismissedBanners is available here for Plan 03's ShareBanner */}
      {/* list.share_code is available for Plan 03's ShareBanner */}
      <div data-share-code={list.share_code} data-dismissed={String(dismissedBanners.has(list.share_code))} />
      <div className="w-full max-w-md mt-4">
        {/* Items area — Plan 02 will populate this */}
      </div>
    </div>
  )
}
