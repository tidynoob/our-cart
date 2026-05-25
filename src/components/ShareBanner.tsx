import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ShareBannerProps {
  listCode: string
  listName: string
  onDismiss: () => void
}

export function ShareBanner({ listCode, listName, onDismiss }: ShareBannerProps) {
  const [copied, setCopied] = useState(false)

  // Construct the share URL from the browser's current origin (D-05)
  const shareUrl = `${window.location.origin}/list/${listCode}`

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Web Share API — called directly in the click handler (Pitfall 4: user gesture required)
  // Only rendered when navigator.share is available — feature detection (T-03-04)
  async function handleShare() {
    try {
      await navigator.share({ title: listName, url: shareUrl })
    } catch (err) {
      // If user cancels (AbortError) or any other error — fall through silently
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      // Other errors: ignore silently
    }
  }

  return (
    <div
      className="w-full bg-blue-50 border-b border-blue-200 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      role="banner"
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">Share this list with your partner</span>
        <span className="font-mono text-sm font-semibold tracking-wide">{listCode}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy link'}
        </Button>

        {/* Share button — only rendered when Web Share API is available (T-03-04) */}
        {typeof navigator !== 'undefined' && !!navigator.share && (
          <Button variant="outline" size="sm" onClick={handleShare}>
            Share
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          aria-label="Dismiss share banner"
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}

export default ShareBanner
