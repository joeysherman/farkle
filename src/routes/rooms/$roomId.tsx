import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/rooms/$roomId')({
    component: RoomComponent,
  })
  
  function RoomComponent() {
    const { roomId } = Route.useParams()
    return <div>Room {roomId}</div>
  }