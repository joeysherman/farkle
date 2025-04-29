import React, { useEffect, useState } from "react";
import { Button } from "@mui/material";
import { useSupabase } from "../contexts/SupabaseContext";

const Room: React.FC = () => {
	const supabase = useSupabase();
	const [room, setRoom] = useState(null);
	const [user, setUser] = useState(null);
	const [showSettingsDialog, setShowSettingsDialog] = useState(false);

	useEffect(() => {
		if (room && room.created_by === user?.id && room.status === "settings") {
			setShowSettingsDialog(true);
		}
	}, [room, user]);

	const handleSettingsSave = async (settings: RoomSettings) => {
		try {
			const { error } = await supabase.rpc("update_room_settings", {
				p_room_id: room.id,
				p_table_model: settings.tableModel,
			});

			if (error) throw error;

			// Refresh room data
			await fetchRoomData();
			setShowSettingsDialog(false);
		} catch (error) {
			console.error("Error updating room settings:", error);
			// Handle error (show toast, etc.)
		}
	};

	const handleStartGame = () => {
		// Implementation of handleStartGame
	};

	return (
		<div>
			{room.status === "ready" && room.created_by === user?.id && (
				<Button onClick={handleStartGame} disabled={room.current_players < 1}>
					Start Game
				</Button>
			)}
		</div>
	);
};

export default Room;
