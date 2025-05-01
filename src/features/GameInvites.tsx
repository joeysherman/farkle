import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface GameInvite {
	id: string;
	game_id: string;
	sender_id: string;
	status: string;
	created_at: string;
	sender: {
		username: string;
		avatar_name: string;
	};
	game: {
		name: string;
	};
}

export function GameInvites(): JSX.Element {
	const [invites, setInvites] = useState<GameInvite[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [respondingTo, setRespondingTo] = useState<string | null>(null);

	useEffect(() => {
		loadInvites();
		// Subscribe to realtime updates
		const channel = supabase
			.channel("game_invites")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "game_invites",
				},
				() => {
					loadInvites();
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, []);

	const loadInvites = async (): Promise<void> => {
		try {
			setIsLoading(true);
			const { data: user } = await supabase.auth.getUser();
			if (!user.user) return;

			const { data, error } = await supabase
				.from("game_invites")
				.select(
					`
					*,
					game:game_rooms(name)
				`
				)
				.eq("receiver_id", user.user.id)
				.eq("status", "pending");

			if (error) throw error;

			// Get sender profiles for each invite
			const invitesWithProfiles = await Promise.all(
				(data || []).map(async (invite) => {
					const { data: profile } = await supabase
						.from("profiles")
						.select("username, avatar_name")
						.eq("id", invite.sender_id)
						.single();

					return {
						...invite,
						sender: profile || { username: "Unknown", avatar_name: "default" },
					};
				})
			);

			setInvites(invitesWithProfiles);
		} catch (error) {
			console.error("Error loading game invites:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleResponse = async (
		inviteId: string,
		accept: boolean
	): Promise<void> => {
		try {
			setRespondingTo(inviteId);
			const { error } = await supabase.rpc("respond_to_game_invite", {
				p_invite_id: inviteId,
				p_accept: accept,
			});

			if (error) throw error;

			// Remove the invite from the list
			setInvites((current) => current.filter((inv) => inv.id !== inviteId));
		} catch (error) {
			console.error("Error responding to invite:", error);
		} finally {
			setRespondingTo(null);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-4">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
			</div>
		);
	}

	if (invites.length === 0) {
		return (
			<div className="text-center py-4 text-gray-500">
				No pending game invites
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{invites.map((invite) => (
				<div
					key={invite.id}
					className="bg-white rounded-lg border p-4 shadow-sm"
				>
					<div className="flex items-start justify-between">
						<div>
							<h3 className="font-medium text-gray-900">
								{invite.sender.username} invited you to join their game
							</h3>
							<p className="text-sm text-gray-500 mt-1">
								Game: {invite.game.name}
							</p>
							<p className="text-xs text-gray-400 mt-1">
								{new Date(invite.created_at).toLocaleDateString()} at{" "}
								{new Date(invite.created_at).toLocaleTimeString()}
							</p>
						</div>
						<div className="flex gap-2">
							<button
								className="px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
								onClick={(): Promise<void> => handleResponse(invite.id, false)}
								disabled={respondingTo === invite.id}
							>
								Decline
							</button>
							<button
								className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
								onClick={(): Promise<void> => handleResponse(invite.id, true)}
								disabled={respondingTo === invite.id}
							>
								{respondingTo === invite.id ? "Joining..." : "Accept"}
							</button>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
