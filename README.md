# Stride

A kanban board for small teams. Drag cards between columns, assign people, tag things with labels, leave comments, and see the full history of every task.

I built it with React + TypeScript (Vite), Supabase (Postgres, anonymous auth, RLS, realtime) and dnd-kit. It's hosted on Vercel.

**Live demo:** https://stride-board.vercel.app

![Stride board](docs/screenshot.png)

## Features

- **Board**: To Do, In Progress, In Review, Done. Drag cards within and between columns with a mouse, touch, or keyboard, and the order sticks.
- **Guest accounts**: no sign up. Your first visit creates an anonymous Supabase user behind the scenes, and RLS locks every row to it.
- **Tasks**: title, description, priority, due date, assignees, labels. Quick add from any column, or hit `N` for the full form.
- **Team members**: add teammates with a name and color, assign as many as you want per task, and their avatars show up on the cards.
- **Labels**: make your own with custom colors, stack multiple on a task, and filter the board by them.
- **Comments**: each task has its own thread in the side panel (stored in a separate `comments` table).
- **Activity log**: status moves, edits, assignments and label changes all get logged by Postgres triggers.
- **Due dates**: cards get an overdue / today / soon badge.
- **Search + filters**: `/` to search by title, plus filters for priority, assignee and label.
- **Stats**: the bar under the header shows how work is spread across columns, with total / completed / due soon / overdue counts. Click Overdue to filter down to just those.
- **Realtime**: open the board in two tabs and moves show up in both.
- Plus the smaller stuff: loading skeletons, empty states, error toasts with retry, optimistic updates that roll back if something fails, and a layout that works down to phone size.

## Running locally

You'll need Node 20+ and a Supabase project (free tier works fine).

1. **Database.** In the Supabase SQL editor, run [`supabase/migrations/20261111000000_init.sql`](supabase/migrations/20261111000000_init.sql). Or if you're using the CLI: `supabase link` then `supabase db push`.
2. **Anonymous sign-ins.** In the Supabase dashboard go to Authentication > Sign In / Providers, turn on **Allow anonymous sign-ins** and save.
3. **Env vars.**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings > API. Use the anon/publishable key, not the service role key.
4. **Run it.**
   ```bash
   npm install
   npm run dev
   ```
   Then open http://localhost:5173.

`npm run build` type-checks and builds to `dist/`.

## Project layout

```
src/
  App.tsx                 auth gate + page layout
  hooks/
    useGuestSession.ts    creates / restores the anonymous user
    useFilters.ts         search + filter state and matching
    useTaskThread.ts      comments + activity for the open task
  state/
    BoardContext.tsx      all board data, optimistic mutations, realtime
    Toasts.tsx            toast notifications
    sampleBoard.ts        "load sample board" seed data
  components/             Board, Column, TaskCard, TaskPanel, ...
  lib/                    supabase client, types, date + ordering helpers
  styles/                 tokens.css (design tokens) + component styles
supabase/migrations/      the full schema, RLS policies and triggers
```

## A few decisions worth explaining

- **Ordering**: each card has a float `position`. Dropping between two cards just takes the midpoint, so a move is always a single-row update. If the gap ever gets too small, it falls back to a rebalance.
- **Activity log**: entries are written by `security definer` triggers. Clients only get a `select` policy on `task_activity`, so you can read your history but you can't write fake entries into it.
- **Join tables**: the insert policies on `task_assignees` and `task_labels` check that you own *both* sides of the link, not just the row itself. Otherwise you could attach your task to someone else's label or teammate.
