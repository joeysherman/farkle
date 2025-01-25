import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { supabase } from '../lib/supabaseClient';
import { Navbar } from '../components/Navbar';

interface GameRoom {
  id: string;
  name: string;
  created_by: string;
  max_players: number;
  current_players: number;
  status: 'waiting' | 'in_progress' | 'completed';
}

interface GamePlayer {
  id: string;
  user_id: string;
  player_order: number;
  score: number;
  is_active: boolean;
}

export function Room() {
  const navigate = useNavigate();
  const search = useSearch();
  const roomId = search.roomId as string;
  
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      navigate({ to: '/' });
      return;
    }

    const fetchRoomData = async () => {
      try {
        // Fetch room details
        const { data: roomData, error: roomError } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (roomError) throw roomError;
        if (!roomData) {
          setError('Room not found');
          return;
        }

        setRoom(roomData);

        // Fetch players in the room
        const { data: playersData, error: playersError } = await supabase
          .from('game_players')
          .select('*')
          .eq('game_id', roomId)
          .order('player_order', { ascending: true });

        if (playersError) throw playersError;
        setPlayers(playersData || []);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRoomData();

    // Set up real-time subscriptions
    const roomSubscription = supabase
      .channel('room_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          setRoom(payload.new as GameRoom);
        }
      )
      .subscribe();

    const playersSubscription = supabase
      .channel('player_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${roomId}`,
        },
        () => {
          // Refresh players list when there are changes
          supabase
            .from('game_players')
            .select('*')
            .eq('game_id', roomId)
            .order('player_order', { ascending: true })
            .then(({ data }) => {
              if (data) setPlayers(data);
            });
        }
      )
      .subscribe();

    return () => {
      roomSubscription.unsubscribe();
      playersSubscription.unsubscribe();
    };
  }, [roomId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="w-16 h-16 border-t-4 border-indigo-600 border-solid rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Error</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>{error || 'Room not found'}</p>
              </div>
              <div className="mt-5">
                <button
                  onClick={() => navigate({ to: '/' })}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Return Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{room.name}</h2>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium text-gray-900">Players</h3>
                <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          Player {player.player_order}
                        </p>
                        <p className="text-sm text-gray-500">
                          Score: {player.score}
                        </p>
                      </div>
                      {!player.is_active && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900">Game Status</h3>
                <p className="mt-2 text-sm text-gray-500">
                  {room.status === 'waiting' && (
                    <>Waiting for players ({room.current_players}/{room.max_players})</>
                  )}
                  {room.status === 'in_progress' && 'Game in progress'}
                  {room.status === 'completed' && 'Game completed'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 