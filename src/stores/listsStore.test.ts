import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useListsStore } from './listsStore'

// vi.hoisted() — mocks available inside vi.mock() factory
// (vi.mock is hoisted to the top of the file by Vitest, before variable declarations)
const { mockFrom, mockInsert, mockEq, mockOrder, mockSingle } =
  vi.hoisted(() => {
    const mockSingle = vi.fn()
    const mockOrder = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockSelect = vi.fn().mockReturnThis()
    const mockInsert = vi.fn().mockReturnThis()
    const mockUpdate = vi.fn().mockReturnThis()
    const mockDelete = vi.fn().mockReturnThis()
    const mockFrom = vi.fn().mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
    })
    return { mockFrom, mockInsert, mockEq, mockOrder, mockSingle }
  })

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

describe('listsStore — CRUD actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useListsStore.setState({ lists: [], loading: false, error: null })
  })

  it('fetchLists queries supabase.from("lists") with owner_id filter (LIST-01)', async () => {
    // fetchLists chain: .from('lists').select().eq('owner_id', userId).order(...)
    // mockOrder is the terminal call for fetchLists
    mockOrder.mockResolvedValueOnce({
      data: [
        { id: 'l1', name: 'Groceries', share_code: 'abc12345', owner_id: 'u1', created_at: '' },
      ],
      error: null,
    })

    await useListsStore.getState().fetchLists('u1')

    expect(mockFrom).toHaveBeenCalledWith('lists')
    expect(mockEq).toHaveBeenCalledWith('owner_id', 'u1')
    expect(useListsStore.getState().lists).toHaveLength(1)
  })

  it('createList inserts with owner_id and share_code, replaces optimistic row on success (LIST-01)', async () => {
    // createList chain: .from('lists').insert({...}).select().single()
    // mockSingle is the terminal call for createList
    mockSingle.mockResolvedValueOnce({
      data: { id: 'real-id', name: 'Groceries', share_code: 'abc12345', owner_id: 'u1', created_at: '' },
      error: null,
    })

    await useListsStore.getState().createList('Groceries', 'u1')

    expect(mockFrom).toHaveBeenCalledWith('lists')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: 'u1', name: 'Groceries' }),
    )
    expect(useListsStore.getState().lists[0].id).toBe('real-id')
  })

  it('createList rolls back optimistic row on supabase error (LIST-01)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'fail' } })

    await useListsStore.getState().createList('Groceries', 'u1')

    expect(useListsStore.getState().lists).toHaveLength(0)
    expect(useListsStore.getState().error).toBe('Failed to create list')
  })

  it('renameList applies optimistic name update before DB call (LIST-02)', async () => {
    useListsStore.setState({
      lists: [{ id: 'l1', name: 'Old', share_code: 'abc12345', owner_id: 'u1', created_at: '' }],
      loading: false,
      error: null,
    })

    // renameList chain: .from('lists').update({name}).eq('id', id)
    // mockEq is the terminal call for renameList
    mockEq.mockResolvedValueOnce({ error: null })

    await useListsStore.getState().renameList('l1', 'New Name')

    expect(useListsStore.getState().lists[0].name).toBe('New Name')
  })

  it('renameList rolls back to previous name on supabase error (LIST-02)', async () => {
    useListsStore.setState({
      lists: [{ id: 'l1', name: 'Old', share_code: 'abc12345', owner_id: 'u1', created_at: '' }],
      loading: false,
      error: null,
    })

    mockEq.mockResolvedValueOnce({ error: { message: 'fail' } })

    await useListsStore.getState().renameList('l1', 'New Name')

    expect(useListsStore.getState().lists[0].name).toBe('Old')
    expect(useListsStore.getState().error).toBe('Failed to rename list')
  })

  it('deleteList removes row optimistically (LIST-03)', async () => {
    useListsStore.setState({
      lists: [{ id: 'l1', name: 'Groceries', share_code: 'abc12345', owner_id: 'u1', created_at: '' }],
      loading: false,
      error: null,
    })

    // deleteList chain: .from('lists').delete().eq('id', id)
    // mockEq is the terminal call for deleteList
    mockEq.mockResolvedValueOnce({ error: null })

    await useListsStore.getState().deleteList('l1')

    expect(useListsStore.getState().lists).toHaveLength(0)
  })

  it('deleteList rolls back (re-inserts list row) on supabase error (LIST-03)', async () => {
    useListsStore.setState({
      lists: [{ id: 'l1', name: 'Groceries', share_code: 'abc12345', owner_id: 'u1', created_at: '' }],
      loading: false,
      error: null,
    })

    mockEq.mockResolvedValueOnce({ error: { message: 'fail' } })

    await useListsStore.getState().deleteList('l1')

    expect(useListsStore.getState().lists).toHaveLength(1)
    expect(useListsStore.getState().error).toBe('Failed to delete list')
  })
})
