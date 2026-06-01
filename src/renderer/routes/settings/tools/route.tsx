import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/tools')({
  component: RouteComponent,
})

export function RouteComponent() {
  return <Outlet />
}
