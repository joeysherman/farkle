import { useState, useEffect, useCallback } from "react";

/**
 * A hook that tracks whether the current tab is visible or not
 * @returns {boolean} isTabActive - true if the tab is visible, false if hidden
 */
const useTabVisibility = () => {
	const [isTabActive, setIsTabActive] = useState(true);

	const handleVisibilityChange = useCallback(() => {
		console.log("visibilitychange", document.visibilityState);
		setIsTabActive(document.visibilityState === "visible");
	}, []);

	useEffect(() => {
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [handleVisibilityChange]);

	return isTabActive;
};

export default useTabVisibility;
