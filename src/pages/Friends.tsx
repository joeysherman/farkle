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
		<div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 p-4 py-8">
			<div className="container mx-auto max-w-4xl space-y-6">
				<h1 className="text-3xl font-bold text-base-content mb-6">Friends</h1>

				{/* Combined Friends Section */}
				<div className="card bg-base-100 shadow-2xl">
					<div className="card-body">
						<h2 className="card-title text-xl mb-6">Manage Your Friends</h2>

						<FriendsList
							showSearch={true}
							showInvites={true}
							className="space-y-6"
						/>
					</div>
				</div>
			</div>
		</div>
	);
};
