import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useListsStore } from '@/stores/listsStore'
import { Input } from '@/components/ui/input'
import { buttonVariants } from '@/components/ui/button'

export function CreateListForm() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const createList = useListsStore((state) => state.createList)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      setError('Please enter a list name.')
      return
    }

    if (!user) {
      setError('Could not create list. Please try again.')
      return
    }

    setLoading(true)
    setError(null)

    const shareCode = await createList(name.trim(), user.id)

    if (!shareCode) {
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
      <button type="submit" disabled={loading} className={buttonVariants()}>
        {loading ? 'Creating...' : 'Create list'}
      </button>
    </form>
  )
}

export default CreateListForm
