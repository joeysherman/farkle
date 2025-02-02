import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { supabase } from '../lib/supabaseClient';
import { Navbar } from '../components/layout/navbar/Navbar';
import { Route as RoomRoute } from '../routes/room';
import type { SceneRef } from '../_game/test';
import { Scene } from '../_game/test';
import { nanoid } from 'nanoid';
import { generateRoomName } from '../utils/roomNames';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';


interface GameRoom {
  id: string;
  name: string;
  created_by: string;
  max_players: number;
  current_players: number;
  status: 'waiting' | 'in_progress' | 'completed';
  invite_code: string;
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
  last_updated_at: string;
}

interface GameTurn {
  id: string;
  game_id: string;
  player_id: string;
  turn_number: number;
  started_at: string;
  ended_at: string | null;
  score_gained: number;
  is_farkle: boolean;
}

interface TurnAction {
  id: string;
  turn_id: string;
  action_number: number;
  dice_values: Array<number>;
  kept_dice: Array<number>;
  score: number;
  turn_action_outcome: 'bust' | 'bank' | 'continue' | null;
  available_dice: number;
  created_at: string;
}

// First, add this CSS animation at the top of the file, after the imports
const pulseAnimation = `
  @keyframes softPulse {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
  }
`;

export function Room(): JSX.Element {
  const navigate = useNavigate();
  const search = useSearch({ from: RoomRoute.id });
  const roomId = search.roomId;
  const sceneRef = useRef<SceneRef>(null);
  
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [players, setPlayers] = useState<Array<GamePlayer>>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputRoomId, setInputRoomId] = useState('');
  const [diceValues, setDiceValues] = useState([1, 2, 3, 4, 5, 6]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [currentTurn, setCurrentTurn] = useState<GameTurn | null>(null);
  const [turnActions, setTurnActions] = useState<Array<TurnAction>>([]);
  const [selectedDiceIndices, setSelectedDiceIndices] = useState<Array<number>>([]);
  const turnActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

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

        // Always fetch players in the room
        const { data: playersData, error: playersError } = await supabase
          .from('game_players')
          .select('*')
          .eq('game_id', roomId)
          .order('player_order', { ascending: true });

        if (playersError) throw playersError;
        setPlayers(playersData || []);

        // Check if user is already a player in the room or is the creator
        const isCreator = user?.id === roomData.created_by;
        const isPlayer = playersData?.some(player => player.user_id === user?.id);

        // Only show invite modal if user is not a player and not the creator
        if (!isCreator && !isPlayer) {
          setShowInviteModal(true);
        }

        // Fetch game state if user is a player or creator
        if (isPlayer || isCreator) {
          const { data: gameStateData, error: gameStateError } = await supabase
            .from('game_states')
            .select('*')
            .eq('game_id', roomId)
            .single();

          if (gameStateError && gameStateError.code !== 'PGRST116') throw gameStateError;
          setGameState(gameStateData || null);

          // Fetch current turn and actions if game is in progress
          if (gameStateData && roomData.status === 'in_progress') {
            const { data: turnData, error: turnError } = await supabase
              .from('game_turns')
              .select('*')
              .eq('game_id', roomId)
              .eq('turn_number', gameStateData.current_turn_number)
              .single();

            if (!turnError) {
              setCurrentTurn(turnData);
              
              if (turnData) {
                const { data: actionsData } = await supabase
                  .from('turn_actions')
                  .select('*')
                  .eq('turn_id', turnData.id)
                  .order('action_number', { ascending: true });

                if (actionsData) {
                  setTurnActions(actionsData);
                }
              }
            }
          }
        }

      } catch (error_) {
        setError(error_ instanceof Error ? error_.message : 'An error occurred');
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

  useEffect(() => {
    if (!roomId) return;

    let actionSubscription: RealtimeChannel | null = null;
    let currentTurnId: string | null = null;

    const turnSubscription = supabase
      .channel('turn_changes')
      .on<GameTurn>(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'game_turns',
          filter: `game_id=eq.${roomId}`,
        },
        async (payload: RealtimePostgresChangesPayload<GameTurn>) => {
          const newTurn = payload.new as GameTurn;
          if (!newTurn) return;

          try {
            // If this is a different turn than what we're currently tracking
            if (currentTurnId !== newTurn.id) {
              // Clean up existing subscription
              if (actionSubscription) {
                await actionSubscription.unsubscribe();
                actionSubscription = null;
              }

              // Reset states immediately
              setCurrentTurn(null);
              setTurnActions([]);
              setSelectedDiceIndices([]);

              // Update our tracked turn ID
              currentTurnId = newTurn.id;

              // Fetch the complete turn data
              const { data: turnData, error: turnError } = await supabase
                .from('game_turns')
                .select('*')
                .eq('id', newTurn.id)
                .single();

              if (turnData) {
                // Only set up new subscription if the turn is not ended
                if (!turnData.ended_at) {
                  setCurrentTurn(turnData);

                  // Fetch initial actions
                  const { data: actionsData } = await supabase
                    .from('turn_actions')
                    .select('*')
                    .eq('turn_id', turnData.id)
                    .order('action_number', { ascending: true });

                  if (actionsData) {
                    setTurnActions(actionsData);
                  }

                  // Set up new action subscription
                  actionSubscription = supabase
                    .channel(`action_changes_${turnData.id}`)
                    .on<TurnAction>(
                      'postgres_changes' as any,
                      {
                        event: '*',
                        schema: 'public',
                        table: 'turn_actions',
                        filter: `turn_id=eq.${turnData.id}`,
                      },
                      (actionPayload: RealtimePostgresChangesPayload<TurnAction>) => {
                        const newAction = actionPayload.new as TurnAction;
                        if (!newAction) return;

                        setTurnActions(previous => {
                          const newActions = [...previous];
                          const index = newActions.findIndex(a => a.id === newAction.id);
                          if (index >= 0) {
                            newActions[index] = newAction;
                          } else {
                            newActions.push(newAction);
                          }
                          return newActions;
                        });
                      }
                    )
                    .subscribe();
                }
              }
            } else if (newTurn.ended_at) {
              // If this is our current turn and it just ended
              if (actionSubscription) {
                await actionSubscription.unsubscribe();
                actionSubscription = null;
              }
              setCurrentTurn(null);
              setTurnActions([]);
              setSelectedDiceIndices([]);
              currentTurnId = null;
            }
          } catch (error_) {
            console.error('Error handling turn update:', error_);
            // Reset states on error
            setCurrentTurn(null);
            setTurnActions([]);
            setSelectedDiceIndices([]);
            if (actionSubscription) {
              await actionSubscription.unsubscribe();
              actionSubscription = null;
            }
            currentTurnId = null;
          }
        }
      )
      .subscribe();

    return () => {
      if (actionSubscription) {
        actionSubscription.unsubscribe();
      }
      turnSubscription.unsubscribe();
    };
  }, [roomId]);

  // Add effect to scroll to bottom when turnActions changes
  useEffect(() => {
    if (turnActionsRef.current) {
      turnActionsRef.current.scrollTop = turnActionsRef.current.scrollHeight;
    }
  }, [turnActions]);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRoomId.trim()) {
      navigate({ to: '/room', search: { roomId: inputRoomId.trim() } });
    }
  };

  const handleJoinWithCode = async (code: string, username: string) => {
    try {
      if (!username.trim() && !user) {
        setError('Please enter a username');
        return;
      }

      let userId = user?.id;

      // If no user, create an anonymous one
      if (!userId) {
        // First sign up the user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: `${nanoid(10)}@anonymous.farkle.com`,
          password: nanoid(12),
        });

        if (signUpError) {
          console.error('Sign up error:', signUpError);
          throw new Error('Failed to create anonymous user');
        }

        if (!signUpData.user?.id) {
          throw new Error('No user ID returned from sign up');
        }

        userId = signUpData.user.id;

        // Wait a moment for the auth to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create profile for anonymous user
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{
            id: userId,
            username: username,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw new Error('Failed to create user profile');
        }

        // Set the user in state
        setUser(signUpData.user);
      }

      // Verify the invite code and join the game
      const { error: joinError } = await supabase.rpc('join_game', {
        room_id: roomId,
        code: code
      });

      if (joinError) {
        console.error('Join game error:', joinError);
        throw new Error(joinError.message);
      }

      // Reload the room data after joining
      const { data: roomData, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (roomError) {
        console.error('Room fetch error:', roomError);
        throw new Error('Failed to fetch room data');
      }
      
      setRoom(roomData);

      // Fetch updated players list
      const { data: playersData, error: playersError } = await supabase
        .from('game_players')
        .select('*')
        .eq('game_id', roomId)
        .order('player_order', { ascending: true });

      if (playersError) {
        console.error('Players fetch error:', playersError);
        throw new Error('Failed to fetch players data');
      }
      
      setPlayers(playersData || []);
      setShowInviteModal(false);
      setError(null); // Clear any existing errors
      
    } catch (error_) {
      console.error('Join game error:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to join game. Please try again.');
    }
  };

  const copyInviteLink = async () => {
    const url = `${window.location.origin}/room?roomId=${roomId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  };

  const handleStartGame = async () => {
    try {
      const { error } = await supabase.rpc('start_game', {
        room_id: roomId
      });

      if (error) {
        console.error('Start game error:', error);
        setError('Failed to start game. Please try again.');
      }
    } catch (error_) {
      console.error('Start game error:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to start game. Please try again.');
    }
  };

  const handleEndGame = async () => {
    try {
      const { error } = await supabase.rpc('end_game', {
        p_game_id: roomId
      });

      if (error) {
        console.error('End game error:', error);
        setError('Failed to end game. Please try again.');
      }
    } catch (error_) {
      console.error('End game error:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to end game. Please try again.');
    }
  };

  // Add roll handler
  const handleRoll = async (numberDice: number = 6) => {
    try {
      const { data: rollResults, error } = await supabase.rpc('perform_roll', {
        p_game_id: roomId,
        p_num_dice: numberDice
      });

      if (error) {
        console.error('Roll error:', error);
        setError(error.message);
        return;
      }

      console.log('Roll results:', rollResults);
      // Update dice values for the scene
      setDiceValues(rollResults);
      // Trigger the roll animation for each die
      rollResults.forEach((value: number, index: number) => {
        sceneRef.current?.roll(index, value);
      });

    } catch (error_) {
      console.error('Roll error:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to roll dice');
    }
  };

  const handleCreateRoom = async () => {
    try {
      const roomName = generateRoomName();
      const { data: roomId, error } = await supabase.rpc('create_room', {
        p_name: roomName
      });

      if (error) {
        console.error('Create room error:', error);
        setError('Failed to create room. Please try again.');
        return;
      }

      // Navigate to the new room
      navigate({ to: '/room', search: { roomId } });
    } catch (error_) {
      console.error('Create room error:', error_);
      setError(error_ instanceof Error ? error_.message : 'Failed to create room. Please try again.');
    }
  };

  // Add the handleTurnAction function near other handlers
  const handleTurnAction = async (keptDice: Array<number>, outcome: 'bust' | 'bank' | 'continue') => {
    if (!roomId) return;
    
    try {
      const latestAction = turnActions[turnActions.length - 1];
      if (!latestAction) return;

      const { error } = await supabase.rpc('process_turn_action', {
        p_game_id: roomId,
        p_outcome: outcome
      });

      if (error) throw error;

      // Reset states if the turn is ending (bank or bust)
      if (outcome === 'bank' || outcome === 'bust') {
        setCurrentTurn(null);
        setTurnActions([]);
        setSelectedDiceIndices([]);
        setDiceValues([1, 2, 3, 4, 5, 6]); // Reset dice values to initial state
      }
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : 'Failed to process turn action');
    }
  };

  // Invite Modal Component
  const InviteModal = () => {
    const [code, setCode] = useState('');
    const [localUsername, setLocalUsername] = useState('');

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          {user && room?.created_by === user.id ? (
            <>
              <h3 className="text-lg font-medium mb-4">Invite Players to {room?.name}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Room Code</label>
                  <input
                    readOnly
                    className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300 bg-gray-50"
                    type="text"
                    value={room?.invite_code}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Room URL</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      readOnly
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-md border border-gray-300 bg-gray-50"
                      type="text"
                      value={`${window.location.origin}/room?roomId=${roomId}`}
                    />
                    <button
                      className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                      onClick={copyInviteLink}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium mb-4">Join {room?.name || 'Game'}</h3>
              <div className="space-y-4">
                {!user && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <input
                      className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300"
                      placeholder="Enter your username"
                      type="text"
                      value={localUsername}
                      onChange={(e) => { setLocalUsername(e.target.value); }}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Room Code</label>
                  <input
                    className="mt-1 block w-full px-3 py-2 rounded-md border border-gray-300"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value); }}
                  />
                </div>
                <button
                  className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => handleJoinWithCode(code, localUsername)}
                >
                  Join Game
                </button>
              </div>
            </>
          )}
          <button
            className="mt-4 w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            onClick={() => { setShowInviteModal(false); }}
          >
            Close
          </button>
        </div>
      </div>
    );
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Join or Create a Room</h2>
            <div className="space-y-4">
              <form className="space-y-4" onSubmit={handleJoinRoom}>
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="roomId">
                    Room Code
                  </label>
                  <input
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    id="roomId"
                    maxLength={6}
                    placeholder="Enter 6-digit room code"
                    type="text"
                    value={inputRoomId}
                    onChange={(e) => { setInputRoomId(e.target.value); }}
                  />
                </div>
                <div className="flex justify-between">
                  <button
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    type="button"
                    onClick={() => navigate({ to: '/' })}
                  >
                    Back to Home
                  </button>
                  <button
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    type="submit"
                  >
                    Join Room
                  </button>
                </div>
              </form>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or</span>
                </div>
              </div>
              <button
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                onClick={handleCreateRoom}
              >
                Create New Room
              </button>
            </div>
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
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => navigate({ to: '/' })}
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

  // Show invite modal for users who need to join
  if (showInviteModal) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <InviteModal />
        </div>
      </div>
    );
  }

  // Only show game room UI if user is authenticated and has joined
  const isPlayerInRoom = players.some(player => player.user_id === user?.id);
  if (!isPlayerInRoom) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <InviteModal />
        </div>
      </div>
    );
  }

  // Main game room UI
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-[1600px] mx-auto h-[calc(100vh-64px)]">
        <div className="flex flex-col md:flex-row md:space-x-4 h-full p-2 sm:p-4">
          {/* Left Column - Room Details - Made slimmer */}
          <div className="w-full h-[calc(50vh-64px)] md:h-full md:w-1/4 mb-4 md:mb-0 overflow-y-auto">
            <div className="bg-white shadow rounded-lg h-full flex flex-col">
              {/* Room Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-col justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold text-gray-900 truncate">{room.name}</h2>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500 gap-2">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      room.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                      room.status === 'in_progress' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {room.status === 'waiting' ? 'Waiting' :
                       room.status === 'in_progress' ? 'In Progress' :
                       'Completed'}
                    </span>                
                    <span className="font-medium ml-1">Players: {room.current_players}/{room.max_players}</span>
                  </div>
                </div>

                {/* Room Controls */}
                {user && room.created_by === user.id && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {room.current_players < room.max_players && room.status === 'waiting' && (
                      <button
                        className="flex-1 min-w-[140px] inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        onClick={() => { setShowInviteModal(true); }}
                      >
                        <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        Invite
                      </button>
                    )}
                    {room.status === 'waiting' && (
                      <button
                        className="flex-1 min-w-[140px] inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        onClick={handleStartGame}
                      >
                        <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" fillRule="evenodd" />
                        </svg>
                        Start
                      </button>
                    )}
                    {room.status === 'in_progress' && (
                      <button
                        className="flex-1 min-w-[140px] inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        onClick={handleEndGame}
                      >
                        <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                          <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" fillRule="evenodd" />
                        </svg>
                        End Game
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Players List */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {players.map((player) => {
                    const isCurrentTurn = gameState?.current_player_id === player.id;
                    const isCurrentUser = player.user_id === user?.id;
                    return (
                      <div
                        key={player.id}
                        className={`relative rounded-lg border ${
                          isCurrentTurn ? 'border-indigo-500 bg-indigo-50' : 
                          isCurrentUser ? 'border-green-500 bg-green-50' :
                          'border-gray-300 bg-white'
                        } p-3 shadow-sm transition-colors duration-200`}
                        style={{ 
                          animation: isCurrentTurn ? 'softPulse 2s infinite' : 'none'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full ${
                              isCurrentTurn ? 'bg-indigo-200' :
                              isCurrentUser ? 'bg-green-200' :
                              'bg-gray-200'
                            } flex items-center justify-center`}>
                              <span className={`font-medium ${
                                isCurrentTurn ? 'text-indigo-900' :
                                isCurrentUser ? 'text-green-900' :
                                'text-gray-900'
                              }`}>
                                P{player.player_order}
                              </span>
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap gap-2 items-center">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                Player {player.player_order}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {isCurrentTurn && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-indigo-800 bg-indigo-100 rounded">
                                    Current Turn
                                  </span>
                                )}
                                {isCurrentUser && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-green-800 bg-green-100 rounded">
                                    You
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <p className="text-sm text-gray-500">
                                Score: <span className="font-medium">{player.score}</span>
                              </p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                player.is_active 
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {player.is_active ? 'Online' : 'Offline'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Empty slots with improved responsive design */}
                  {Array.from({ length: room.max_players - players.length }).map((_, index) => (
                    <div
                      key={`empty-${index}`}
                      className="relative rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-400 font-medium">
                              {players.length + index + 1}
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
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

          {/* Right Column - Game Canvas - Given more space */}
          <div className="w-full h-[calc(50vh-64px)] md:h-full md:w-3/4">
            <div className="bg-white shadow rounded-lg h-full flex flex-col">
              <div className="h-full p-2 flex flex-col">
                {/* Game Turn Information - Made more compact */}
                <div className="flex-none mb-2">
                  <div className="bg-white border rounded-lg">
                    <div className="px-3 py-2">
                      {/* Header with Game Status */}
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-base font-medium text-gray-900">Game Status</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          room.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                          room.status === 'in_progress' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {room.status === 'waiting' ? 'Waiting to Start' :
                           room.status === 'in_progress' ? 'In Progress' :
                           'Game Over'}
                        </span>
                      </div>
                      
                      {room.status === 'waiting' ? (
                        <div className="text-center py-6">
                          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                          </svg>
                          <h3 className="mt-2 text-sm font-medium text-gray-900">Waiting for game to start</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {room.current_players < 2 
                              ? 'Need at least one more player to start'
                              : 'Ready to begin when host starts the game'}
                          </p>
                          {user && room.created_by === user.id && room.current_players >= 2 && (
                            <div className="mt-6">
                              <button
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                onClick={handleStartGame}
                              >
                                <svg className="-ml-1 mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" fillRule="evenodd" />
                                </svg>
                                Start Game
                              </button>
                            </div>
                          )}
                        </div>
                      ) : room.status === 'in_progress' && !currentTurn ? (
                        <div className="flex flex-col h-[300px]">
                          <style>{pulseAnimation}</style>
                          {gameState && (
                            <>
                              {(() => {
                                const currentPlayer = players.find(p => p.id === gameState.current_player_id);
                                const isCurrentUserTurn = currentPlayer?.user_id === user?.id;
                                return (
                                  <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className={`rounded-full w-16 h-16 mb-4 flex items-center justify-center ${
                                      isCurrentUserTurn ? 'bg-green-100' : 'bg-gray-100'
                                    }`} style={{ 
                                      animation: isCurrentUserTurn ? 'softPulse 2s infinite' : 'none'
                                    }}>
                                      <span className={`text-2xl font-medium ${
                                        isCurrentUserTurn ? 'text-green-700' : 'text-gray-700'
                                      }`}>
                                        P{currentPlayer?.player_order}
                                      </span>
                                    </div>
                                    <h3 className="text-xl font-medium text-gray-900 mb-2">
                                      {isCurrentUserTurn ? (
                                        "It's your turn!"
                                      ) : (
                                        `Waiting for Player ${currentPlayer?.player_order}'s turn`
                                      )}
                                    </h3>
                                    {isCurrentUserTurn && (
                                      <>
                                        <p className="text-sm text-gray-500 mb-6">
                                          Click below to begin your turn
                                        </p>
                                        <button
                                          className="w-full max-w-xs h-12 inline-flex justify-center items-center px-6 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                          onClick={() => handleRoll(6)}
                                        >
                                          Roll Dice
                                        </button>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      ) : currentTurn ? (
                        <div className="flex flex-col h-[300px]">
                          {/* Turn Header */}
                          <div className="flex-none grid grid-cols-2 gap-3 text-sm mb-3">
                            <div>
                              <span className="font-medium text-gray-500">Turn {currentTurn.turn_number}</span>
                              {currentTurn.is_farkle && (
                                <span className="ml-2 text-red-600 font-medium">(Farkle!)</span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-medium text-gray-500">Score: </span>
                              <span className="font-medium text-indigo-600">{currentTurn.score_gained}</span>
                            </div>
                          </div>

                          {/* Turn Actions - Scrollable */}
                          <div 
                            ref={turnActionsRef}
                            className="flex-1 overflow-y-auto mb-4 scroll-smooth"
                          >
                            <div className="space-y-2">
                              {turnActions.map((action) => {
                                const remainingDice = action.dice_values.filter(
                                  (value, index) => !action.kept_dice.includes(value)
                                );
                                
                                return (
                                  <div 
                                    key={action.id}
                                    className="bg-gray-50 rounded p-2 text-sm"
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="w-full">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="font-medium text-gray-500">Roll {action.action_number}:</span>
                                          {action.score > 0 ? (
                                            <div className="font-medium text-indigo-600 ml-auto">
                                              +{action.score}
                                            </div>
                                          ) : (
                                            <div className="font-medium text-red-500 ml-auto">
                                              +0
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* Two rows: Remaining Dice and Kept Dice */}
                                        <div className="grid grid-cols-1 gap-2">
                                          {/* Remaining Dice Row */}
                                          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                                            <span className="font-medium text-gray-500">Dice left:</span>
                                            <div className="flex gap-1 flex-wrap">
                                              {remainingDice.map((value, index) => (
                                                <button
                                                  key={index}
                                                  disabled={action !== turnActions[turnActions.length - 1] || Boolean(action.turn_action_outcome)}
                                                  className={`w-8 h-8 flex items-center justify-center rounded ${
                                                    selectedDiceIndices.includes(action.dice_values.indexOf(value))
                                                      ? 'bg-indigo-500 text-white'
                                                      : 'bg-white border border-gray-300'
                                                  } ${
                                                    action === turnActions[turnActions.length - 1] && !action.turn_action_outcome
                                                      ? 'hover:bg-indigo-100 cursor-pointer'
                                                      : 'cursor-default'
                                                  }`}
                                                  onClick={() => {
                                                    if (action === turnActions[turnActions.length - 1] && !action.turn_action_outcome) {
                                                      const originalIndex = action.dice_values.indexOf(value);
                                                      setSelectedDiceIndices(previous => {
                                                        if (previous.includes(originalIndex)) {
                                                          return previous.filter(index_ => index_ !== originalIndex);
                                                        } else {
                                                          return [...previous, originalIndex];
                                                        }
                                                      });
                                                    }
                                                  }}
                                                >
                                                  {value}
                                                </button>
                                              ))}
                                              {remainingDice.length === 0 && (
                                                <span className="text-gray-500 italic">No dice available</span>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {/* Kept Dice Row */}
                                          <div className="grid grid-cols-[120px_1fr] items-center gap-2">
                                            <span className="font-medium text-gray-500">Scoring dice:</span>
                                            <div className="flex gap-1 flex-wrap">
                                              {action.kept_dice.map((value, index) => (
                                                <div
                                                  key={index}
                                                  className="w-8 h-8 flex items-center justify-center rounded bg-green-100 border border-green-300 text-green-700"
                                                >
                                                  {value}
                                                </div>
                                              ))}
                                              {action.kept_dice.length === 0 && (
                                                <span className="text-red-500 italic font-bold">Farkle!</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {turnActions.length === 0 && (
                                <p className="text-sm text-gray-500 italic">No actions yet</p>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons - Fixed at Bottom */}
                          {gameState && user && gameState.current_player_id === players.find(p => p.user_id === user.id)?.id && (
                            <div className="flex-none grid grid-cols-2 gap-3">
                              {turnActions.length > 0 && turnActions[turnActions.length - 1]?.score == 0 ? (
                                <button 
                                  className="col-span-2 w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-500 hover:bg-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" 
                                  onClick={() => {
                                    const latestAction = turnActions[turnActions.length - 1];
                                    if (latestAction?.kept_dice) {
                                      handleTurnAction(latestAction.kept_dice, 'bust');
                                    }
                                  }}
                                >
                                  End Turn
                                </button>
                              ) : turnActions.length === 0 || (turnActions[turnActions.length - 1]?.turn_action_outcome) ? (
                                <button
                                  className="col-span-2 w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                  onClick={() => handleRoll(6)}
                                >
                                  Roll Dice
                                </button>
                              ) : (
                                <>
                                  <button
                                    className="w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                                    disabled={!turnActions.length || Boolean(turnActions[turnActions.length - 1]?.turn_action_outcome)}
                                    onClick={() => {
                                      const latestAction = turnActions[turnActions.length - 1];
                                      if (latestAction && !latestAction.turn_action_outcome) {
                                        handleTurnAction(latestAction.kept_dice, 'bank');
                                      }
                                    }}
                                  >
                                    Bank Score
                                  </button>
                                  <button
                                    className="w-full h-12 inline-flex justify-center items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                    disabled={
                                      turnActions.length === 0 || 
                                      (turnActions[turnActions.length - 1]?.score ?? 0) === 0 &&
                                      (turnActions[turnActions.length - 1]?.available_dice ?? 0) <= 0
                                    }
                                    onClick={() => {
                                      const latestAction = turnActions[turnActions.length - 1];
                                      if (latestAction && !latestAction.turn_action_outcome) {
                                        const keptDice = selectedDiceIndices
                                          .map(index => latestAction.dice_values[index])
                                          .filter(Boolean);
                                        const validScoringDice = latestAction.kept_dice;
                                        const allKeptDice = [...validScoringDice, ...keptDice];
                                        handleTurnAction(allKeptDice, 'continue');
                                        setSelectedDiceIndices([]);
                                      }
                                    }}
                                  >
                                    {turnActions[turnActions.length - 1]?.available_dice == 0 && turnActions[turnActions.length - 1]?.score > 0 && "Hot Dice! Roll 6 dice"}
                                    
                                    {turnActions[turnActions.length - 1]?.available_dice > 0 && turnActions[turnActions.length - 1]?.score > 0 && "Roll " + (turnActions[turnActions.length - 1]?.available_dice ?? 0) + " dice"}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Loading game state...</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Game Canvas Container - Given more vertical space */}
                <div className="flex-1 min-h-0 bg-gray-50 rounded-lg overflow-hidden">
                  <Scene ref={sceneRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      {showInviteModal && <InviteModal />}
    </div>
  );
} 