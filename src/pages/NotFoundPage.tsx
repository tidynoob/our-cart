import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-semibold mb-4">List not found</h1>
      <Link to="/" className="text-blue-600 underline">
        Back to home
      </Link>
    </div>
  )
}
