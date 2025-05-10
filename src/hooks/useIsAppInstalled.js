import { useState, useEffect } from "react";

/**
 * A hook that detects if the current webpage is running as an installed PWA
 * @returns {boolean} isInstalled - true if running as installed PWA, false otherwise
 */
const useIsAppInstalled = () => {
	const [isInstalled, setIsInstalled] = useState(false);

	useEffect(() => {
		const checkInstallation = () => {
			// Check if running in standalone mode (iOS)
			const isStandalone = window.matchMedia(
				"(display-mode: standalone)"
			).matches;

			// Check if running in fullscreen mode (Android)
			const isFullscreen = window.matchMedia(
				"(display-mode: fullscreen)"
			).matches;

			// Check if running in minimal-ui mode (some Android browsers)
			const isMinimalUI = window.matchMedia(
				"(display-mode: minimal-ui)"
			).matches;

			// Check if running in window-controls-overlay mode (Windows)
			const isWindowControlsOverlay = window.matchMedia(
				"(display-mode: window-controls-overlay)"
			).matches;

			// Check if running in a standalone window (macOS)
			const isStandaloneWindow = window.navigator.standalone === true;

			// Check if running in a PWA window (Chrome, Edge)
			const isPWA =
				window.matchMedia("(display-mode: standalone)").matches ||
				window.matchMedia("(display-mode: fullscreen)").matches ||
				window.matchMedia("(display-mode: minimal-ui)").matches;

			// Additional checks for specific browsers
			const isChrome = /Chrome/.test(navigator.userAgent);
			const isSafari = /^((?!chrome|android).)*safari/i.test(
				navigator.userAgent
			);
			const isFirefox = /Firefox/.test(navigator.userAgent);
			const isEdge = /Edg/.test(navigator.userAgent);

			// Handle different browser behaviors
			if (isSafari) {
				// Safari on iOS
				setIsInstalled(isStandaloneWindow);
			} else if (isChrome || isEdge) {
				// Chrome and Edge
				setIsInstalled(isPWA || isStandalone || isFullscreen);
			} else if (isFirefox) {
				// Firefox
				setIsInstalled(isStandalone || isFullscreen);
			} else {
				// Other browsers
				setIsInstalled(
					isStandalone || isFullscreen || isMinimalUI || isWindowControlsOverlay
				);
			}
		};

		// Initial check
		checkInstallation();

		// Listen for display mode changes
		const mediaQueryList = window.matchMedia("(display-mode: standalone)");
		const handleDisplayModeChange = () => {
			checkInstallation();
		};

		// Add event listener for display mode changes
		if (mediaQueryList.addEventListener) {
			mediaQueryList.addEventListener("change", handleDisplayModeChange);
		} else {
			// Fallback for older browsers
			mediaQueryList.addListener(handleDisplayModeChange);
		}

		// Cleanup
		return () => {
			if (mediaQueryList.removeEventListener) {
				mediaQueryList.removeEventListener("change", handleDisplayModeChange);
			} else {
				// Fallback for older browsers
				mediaQueryList.removeListener(handleDisplayModeChange);
			}
		};
	}, []);

	return isInstalled;
};

export default useIsAppInstalled;
