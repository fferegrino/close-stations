import { useState, type FormEvent } from 'react'

interface AddressSearchProps {
  onSearch: (address: string) => void
  loading: boolean
}

export default function AddressSearch({ onSearch, loading }: AddressSearchProps) {
  const [address, setAddress] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = address.trim()
    if (trimmed) onSearch(trimmed)
  }

  return (
    <form className="address-search" onSubmit={handleSubmit}>
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="e.g. 10 Downing Street"
        aria-label="London address"
        disabled={loading}
      />
      <button type="submit" disabled={loading || !address.trim()}>
        {loading ? 'Searching…' : 'Search'}
      </button>
    </form>
  )
}
