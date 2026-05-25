import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractShareCode } from '@/lib/extractShareCode'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Valid share code pattern: 8 chars, nanoid default alphabet (A-Za-z0-9_-)
const SHARE_CODE_PATTERN = /^[A-Za-z0-9_-]{8}$/

export function JoinListForm() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const extractedCode = extractShareCode(input)

    // Validate the extracted code (V5 input validation — T-03-03)
    if (!SHARE_CODE_PATTERN.test(extractedCode)) {
      setError('Invalid share code')
      return
    }

    // Do NOT query Supabase here — navigation triggers ListPage's query
    navigate(`/list/${extractedCode}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-sm">
      <label htmlFor="join-input" className="text-sm font-medium">
        Share code or link
      </label>
      <Input
        id="join-input"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste code or link"
        aria-describedby={error ? 'join-error' : undefined}
      />
      {error && (
        <p id="join-error" className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <Button type="submit">Join list</Button>
    </form>
  )
}

export default JoinListForm
