import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (!code) {
      navigate('/')
      return
    }

    supabase.rpc('redeem_invite', { p_share_code: code }).then(({ data, error }) => {
      if (error || !data) {
        setInvalid(true)
      } else {
        navigate(`/list/${data.share_code}`, { replace: true })
      }
    })
  }, [code, navigate])

  if (invalid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-sm text-muted-foreground">This invite link is invalid or has expired.</p>
        <a href="/" className="text-sm text-blue-600 underline">Back to home</a>
      </div>
    )
  }

  // Spinner while redeeming
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  )
}
