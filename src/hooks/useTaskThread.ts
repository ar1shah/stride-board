import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Activity, Comment } from '../lib/types'
import { useBoard } from '../state/BoardContext'
import { useToast } from '../state/Toasts'

/** Comments + activity for whichever task is open in the side panel. */
export function useTaskThread(taskId: string) {
  const { activityTick, adjustCommentCount } = useBoard()
  const toast = useToast()

  const [comments, setComments] = useState<Comment[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadComments = useCallback(async () => {
    const { data, error } = await supabase
      .from('comments')
      .select('id, task_id, body, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .order('id')
    if (error) throw error
    setComments(data as Comment[])
  }, [taskId])

  const loadActivity = useCallback(async () => {
    const { data, error } = await supabase
      .from('task_activity')
      .select('id, task_id, kind, meta, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(100)
    if (error) throw error
    setActivity(data as Activity[])
  }, [taskId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadComments(), loadActivity()])
    } catch (err) {
      console.error('[thread] load failed', err)
      setError('Comments and activity did not load.')
    } finally {
      setLoading(false)
    }
  }, [loadComments, loadActivity])

  useEffect(() => {
    load()
  }, [load])

  // something about the task changed (moved, renamed, assigned...), the db
  // trigger already wrote the activity row so just pull it again
  useEffect(() => {
    if (activityTick === 0) return
    loadActivity().catch(() => {
      /* not worth a toast, the next tick will retry */
    })
  }, [activityTick, loadActivity])

  const addComment = useCallback(
    async (body: string) => {
      const temp: Comment = {
        id: `temp-${crypto.randomUUID()}`,
        task_id: taskId,
        body,
        created_at: new Date().toISOString(),
      }
      setComments((list) => [...list, temp])
      adjustCommentCount(taskId, 1)

      const { data, error } = await supabase
        .from('comments')
        .insert({ task_id: taskId, body })
        .select('id, task_id, body, created_at')
        .single()

      if (error) {
        setComments((list) => list.filter((c) => c.id !== temp.id))
        adjustCommentCount(taskId, -1)
        toast.error('Your comment did not post. It is still in the box below.')
        return false
      }
      setComments((list) => list.map((c) => (c.id === temp.id ? (data as Comment) : c)))
      return true
    },
    [taskId, adjustCommentCount, toast],
  )

  const deleteComment = useCallback(
    async (id: string) => {
      const before = comments
      setComments((list) => list.filter((c) => c.id !== id))
      adjustCommentCount(taskId, -1)
      const { error } = await supabase.from('comments').delete().eq('id', id)
      if (error) {
        setComments(before)
        adjustCommentCount(taskId, 1)
        toast.error('Could not delete that comment.')
      }
    },
    [comments, taskId, adjustCommentCount, toast],
  )

  return { comments, activity, loading, error, reload: load, addComment, deleteComment }
}
