import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nanoid } from 'nanoid'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function CreateListForm() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      setError('Please enter a list name.')
      return
    }

    setLoading(true)
    setError(null)

    // Generate the share code inside the submit handler — NOT at render or module scope (Pitfall 5)
    const shareCode = nanoid(8)

    const { error: supabaseError } = await supabase
      .from('lists')
      .insert({ name: name.trim(), share_code: shareCode })

    if (supabaseError) {
      // Never expose the raw Supabase error message (T-03-02, V7)
      setError('Could not create list. Please try again.')
      setLoading(false)
      return
    }

    navigate(`/list/${shareCode}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-sm">
      <label htmlFor="list-name" className="text-sm font-medium">
        List name
      </label>
      <Input
        id="list-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Weekly groceries"
        disabled={loading}
        aria-describedby={error ? 'create-error' : undefined}
      />
      {error && (
        <p id="create-error" className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create list'}
      </Button>
    </form>
  )
}

export default CreateListForm
