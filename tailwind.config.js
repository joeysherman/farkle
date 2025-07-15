// tailwind.config.js
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
					secondary: "#38bdf8", // sky-400
					"secondary-focus": "#0ea5e9", // sky-500
					"secondary-content": "#ffffff",
					accent: "#10b981", // emerald-500
					"accent-focus": "#059669", // emerald-600
					"accent-content": "#ffffff",
					neutral: "#334155", // slate-700
					"neutral-focus": "#1e293b", // slate-800
					"neutral-content": "#f1f5f9", // slate-100
					"base-100": "#f9fafb", // gray-50
					"base-200": "#f1f5f9", // slate-100
					"base-300": "#e2e8f0", // slate-200
					"base-content": "#1e293b", // slate-800
					info: "#0ea5e9", // sky-500
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
