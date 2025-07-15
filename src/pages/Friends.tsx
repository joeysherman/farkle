import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { FunctionComponent } from "../common/types";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { FriendsList } from "../components/FriendsList";

export const Friends = (): FunctionComponent => {
	const navigate = useNavigate();

	useEffect(() => {
		const checkAuth = async (): Promise<void> => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				void navigate({ to: "/signup" });
				return;
			}
		};

		void checkAuth();
	}, [navigate]);

	return (
		<div className="container mx-auto pt-6">
			{/* Combined Friends Section */}
			<div className="card bg-base-100 shadow-md ring-1 ring-base-300">
				<div className="card-body">
					<h2 className="card-title text-2xl mb-6 text-neutral">Friends</h2>

					<FriendsList
						showSearch={true}
						showInvites={true}
						className="space-y-6"
					/>
				</div>
			</div>
		</div>
	);
};
