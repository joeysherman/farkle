module.exports = {
	content: ["./src/**/*.{js,ts,jsx,tsx}"],
	plugins: [require("daisyui")],
	// daisyUI config (optional - here are the default values)
	daisyui: {
		themes: false, // false: only light + dark | true: all themes | array: specific themes like this ["light", "dark", "cupcake"]
		darkTheme: "dark", // name of one of the included themes for dark mode
		base: true, // applies background color and foreground color for root element by default
		styled: true, // include daisyUI colors and design decisions for all components
		utils: true, // adds responsive and modifier utility classes
		prefix: "", // prefix for daisyUI classnames (components, modifiers and responsive class names. Not colors)
		logs: true, // Shows info about daisyUI version and used config in the console when building your CSS
		themeRoot: ":root", // The element that receives theme color CSS variables
		themes: [
			{
				mytheme: {
					//primary: "#4f46e5",

					secondary: "#ff00ff",

					accent: "#00ffff",

					neutral: "#ff00ff",

					"base-100": "#6366f1",

					info: "#0000ff",

					success: "#00ff00",

					warning: "#00ff00",

					error: "#ff0000",
				},
			},
		],
	},
};
