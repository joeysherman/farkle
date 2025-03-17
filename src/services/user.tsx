// react query hook for user data

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

// get the user data from the supabase client using the user id

export const useUser = (userId: string) => {
	const { data, isLoading, error } = useQuery({
		queryKey: ["user", userId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", userId)
				.single();
			return data;
		},
	});
	return { data, isLoading, error };
};
