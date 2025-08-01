import { ManagedGameRoom } from '~/components/ManagedGameRoom'

interface RoomPageProps {
  params: {
    roomCode: string
  }
}

export default function RoomPage({ params }: RoomPageProps) {
  return <ManagedGameRoom roomCode={params.roomCode} />
}

export function generateMetadata({ params }: RoomPageProps) {
  return {
    title: `Game Room ${params.roomCode} - MERN Mafia`,
    description: `Join the Mafia game in room ${params.roomCode}`,
  }
}