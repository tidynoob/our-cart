import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface NamePromptDialogProps {
  open: boolean
  listId: string
  onNameSaved: (name: string) => void
}

/**
 * Modal dialog that captures the user's name on first visit to a list.
 * Cannot be dismissed without entering a name (no close button, no backdrop close).
 * Stores the name in localStorage keyed by list ID.
 */
export function NamePromptDialog({ open, listId, onNameSaved }: NamePromptDialogProps) {
  const [name, setName] = useState('')

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    localStorage.setItem(`our-cart-name-${listId}`, trimmed)
    onNameSaved(trimmed)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    handleSave()
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>What's your name?</DialogTitle>
          <DialogDescription>So your partner knows who added what</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="text-base"
          />
          <Button type="submit" onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
