module.exports = {
	content: ["./src/**/*.{js,ts,jsx,tsx}"],
	plugins: [require("daisyui")],
	daisyui: {
		themes: [
			{
				light: {
					primary: "#4f46e5", // indigo-600
					"primary-focus": "#4338ca", // indigo-700
					"primary-content": "#ffffff",
					secondary: "#6366f1", // indigo-500
					"secondary-focus": "#4f46e5", // indigo-600
					"secondary-content": "#ffffff",
					accent: "#8b5cf6", // violet-500
					"accent-focus": "#7c3aed", // violet-600
					"accent-content": "#ffffff",
					neutral: "#374151", // gray-700
					"neutral-focus": "#1f2937", // gray-800
					"neutral-content": "#ffffff",
					"base-100": "#ffffff",
					"base-200": "#f9fafb", // gray-50
					"base-300": "#f3f4f6", // gray-100
					"base-content": "#1f2937", // gray-800
					info: "#3b82f6", // blue-500
					"info-content": "#ffffff",
					success: "#10b981", // emerald-500
					"success-content": "#ffffff",
					warning: "#f59e0b", // amber-500
					"warning-content": "#ffffff",
					error: "#ef4444", // red-500
					"error-content": "#ffffff",
				},
			},
		],
		base: true,
		styled: true,
		utils: true,
		logs: false,
	},
};
