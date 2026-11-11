import { initials } from '../lib/colors'
import type { Member } from '../lib/types'

interface AvatarProps {
  member: Pick<Member, 'name' | 'color'>
  size?: 'xs' | 'sm' | 'md'
  ring?: boolean
}

export function Avatar({ member, size = 'sm', ring }: AvatarProps) {
  return (
    <span
      className={`avatar avatar--${size}${ring ? ' avatar--ring' : ''}`}
      style={{ background: member.color }}
      title={member.name}
      aria-label={member.name}
    >
      {initials(member.name)}
    </span>
  )
}

export function AvatarStack({ members, max = 3, size = 'xs' }: { members: Member[]; max?: number; size?: 'xs' | 'sm' }) {
  if (members.length === 0) return null
  const shown = members.slice(0, max)
  const extra = members.length - shown.length

  return (
    <span className="avatar-stack" aria-label={`Assigned to ${members.map((m) => m.name).join(', ')}`}>
      {shown.map((m) => (
        <Avatar key={m.id} member={m} size={size} ring />
      ))}
      {extra > 0 && <span className={`avatar avatar--${size} avatar--ring avatar--more`}>+{extra}</span>}
    </span>
  )
}
