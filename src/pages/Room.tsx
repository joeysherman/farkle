import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { supabase } from '../lib/supabaseClient';
import { Navbar } from '../components/Navbar';
import { Route as RoomRoute } from '../routes/room';
import { Scene, SceneRef } from '../_game/test';

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

interface GameState {
  game_id: string;
  current_turn_number: number;
  current_player_id: string;
  available_dice: number;
  current_turn_score: number;
}

export function Room() {
  const navigate = useNavigate();
  const search = useSearch({ from: RoomRoute.id });
  const roomId = search.roomId;
  const sceneRef = useRef<SceneRef>(null);
  
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputRoomId, setInputRoomId] = useState('');
  const [diceValues, setDiceValues] = useState([1, 2, 3, 4, 5, 6]);

  const handleNumberChange = (index: number, value: string) => {
    const numValue = parseInt(value);
    if (numValue >= 1 && numValue <= 6) {
      setDiceValues(prev => {
        const newValues = [...prev];
        newValues[index] = numValue;
        return newValues;
      });
    }
  };

  const handleRollClick = (index: number) => {
    const value = diceValues[index];
    if (value !== undefined) {
      sceneRef.current?.roll(index, value);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: '/signup' });
        return;
      }

      if (!roomId) {
        setLoading(false);
        return;
      }

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

        // Fetch game state
        const { data: gameStateData, error: gameStateError } = await supabase
          .from('game_states')
          .select('*')
          .eq('game_id', roomId)
          .single();

        if (gameStateError && gameStateError.code !== 'PGRST116') throw gameStateError;
        setGameState(gameStateData || null);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    if (roomId) {
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

      const gameStateSubscription = supabase
        .channel('game_state_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'game_states',
            filter: `game_id=eq.${roomId}`,
          },
          (payload) => {
            setGameState(payload.new as GameState);
          }
        )
        .subscribe();

      return () => {
        roomSubscription.unsubscribe();
        playersSubscription.unsubscribe();
        gameStateSubscription.unsubscribe();
      };
    }
  }, [roomId, navigate]);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRoomId.trim()) {
      navigate({ to: '/room', search: { roomId: inputRoomId.trim() } });
    }
  };

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

  // Show room ID input if no roomId in query params
  if (!roomId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Join a Room</h2>
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <label htmlFor="roomId" className="block text-sm font-medium text-gray-700">
                  Room ID
                </label>
                <input
                  type="text"
                  id="roomId"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value)}
                  placeholder="Enter room ID"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => navigate({ to: '/' })}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Back to Home
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Join Room
                </button>
              </div>
            </form>
          </div>
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
      <main className="max-w-[1600px] mx-auto h-[calc(100vh-64px)]">
        <div className="flex flex-col md:flex-row md:space-x-6 h-full p-4 sm:p-6 lg:p-8">
          {/* Left Column - Room Details */}
          <div className="w-full h-[calc(50vh-64px)] md:h-full md:w-1/3 mb-4 md:mb-0 overflow-y-auto">
            <div className="bg-white shadow rounded-lg h-full">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">{room.name}</h2>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    room.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                    room.status === 'in_progress' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {room.status === 'waiting' ? 'Waiting' :
                     room.status === 'in_progress' ? 'In Progress' :
                     'Completed'}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Players</h3>
                    <span className="text-sm text-gray-500">
                      {room.current_players}/{room.max_players} Players
                    </span>
                  </div>
                  <div className="space-y-3">
                    {players.map((player) => {
                      const isCurrentTurn = gameState?.current_player_id === player.id;
                      return (
                        <div
                          key={player.id}
                          className={`relative rounded-lg border ${
                            isCurrentTurn ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white'
                          } px-4 py-3 shadow-sm flex items-center justify-between transition-colors duration-200`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              <div className={`w-10 h-10 rounded-full ${
                                isCurrentTurn ? 'bg-indigo-200' : 'bg-indigo-100'
                              } flex items-center justify-center`}>
                                <span className={`${
                                  isCurrentTurn ? 'text-indigo-900' : 'text-indigo-800'
                                } font-medium`}>
                                  P{player.player_order}
                                </span>
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-gray-900">
                                  Player {player.player_order}
                                </p>
                                {isCurrentTurn && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-indigo-800 bg-indigo-100 rounded">
                                    Current Turn
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">
                                Score: {player.score}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            {player.is_active ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Offline
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Empty slots */}
                    {Array.from({ length: room.max_players - players.length }).map((_, index) => (
                      <div
                        key={`empty-${index}`}
                        className="relative rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 shadow-sm flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <span className="text-gray-400 font-medium">
                                {players.length + index + 1}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">
                              Waiting for player...
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Game Canvas */}
          <div className="w-full h-[calc(50vh-64px)] md:h-full md:w-2/3">
            <div className="bg-white shadow rounded-lg h-full">
              <div className="h-full p-4">
                <div className="w-full h-full bg-gray-50 rounded-lg overflow-hidden">
                  <Scene ref={sceneRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 