const fs = require("fs");
const path = require("path");

// Define avatar variations
const avatars = [
	{
		name: "default",
		options: {
			topType: "ShortHairDreads02",
			accessoriesType: "Prescription02",
			hairColor: "BrownDark",
			facialHairType: "BeardMedium",
			clotheType: "Hoodie",
			clotheColor: "PastelBlue",
			eyeType: "Happy",
			eyebrowType: "Default",
			mouthType: "Smile",
			skinColor: "Light",
		},
	},
	{
		name: "avatar1",
		options: {
			topType: "LongHairMiaWallace",
			accessoriesType: "Round",
			hairColor: "BlondeGolden",
			facialHairType: "Blank",
			clotheType: "BlazerShirt",
			clotheColor: "PastelRed",
			eyeType: "Default",
			eyebrowType: "RaisedExcited",
			mouthType: "Smile",
			skinColor: "Pale",
		},
	},
	{
		name: "avatar2",
		options: {
			topType: "ShortHairShortCurly",
			accessoriesType: "Blank",
			hairColor: "Black",
			facialHairType: "Blank",
			clotheType: "ShirtCrewNeck",
			clotheColor: "Blue03",
			eyeType: "Side",
			eyebrowType: "Default",
			mouthType: "Twinkle",
			skinColor: "DarkBrown",
		},
	},
	{
		name: "avatar3",
		options: {
			topType: "Hijab",
			accessoriesType: "Blank",
			hairColor: "Black",
			facialHairType: "Blank",
			clotheType: "BlazerSweater",
			clotheColor: "PastelGreen",
			eyeType: "Happy",
			eyebrowType: "Default",
			mouthType: "Smile",
			skinColor: "Light",
		},
	},
	{
		name: "avatar4",
		options: {
			topType: "LongHairBun",
			accessoriesType: "Kurt",
			hairColor: "Red",
			facialHairType: "Blank",
			clotheType: "Overall",
			clotheColor: "Gray02",
			eyeType: "Surprised",
			eyebrowType: "RaisedExcited",
			mouthType: "Tongue",
			skinColor: "Tanned",
		},
	},
	{
		name: "avatar5",
		options: {
			topType: "WinterHat4",
			accessoriesType: "Wayfarers",
			hairColor: "PastelPink",
			facialHairType: "BeardLight",
			clotheType: "CollarSweater",
			clotheColor: "Red",
			eyeType: "Hearts",
			eyebrowType: "UnibrowNatural",
			mouthType: "Eating",
			skinColor: "Brown",
		},
	},
];

// Function to generate avatar URL
function generateAvatarUrl(options) {
	const params = Object.entries(options)
		.map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
		.join("&");
	return `https://avataaars.io/?${params}`;
}

// Create avatars directory if it doesn't exist
const avatarsDir = path.join(__dirname, "../public/avatars");
if (!fs.existsSync(avatarsDir)) {
	fs.mkdirSync(avatarsDir, { recursive: true });
}

// Generate and save avatars
avatars.forEach((avatar) => {
	const url = generateAvatarUrl(avatar.options);
	console.log(`Generating ${avatar.name}.svg...`);
	// Here you would need to fetch the SVG from the URL and save it
	// For now, we'll just create a placeholder
	const svgContent = `<!-- Generated avatar for ${avatar.name} -->
<svg width="264px" height="280px" viewBox="0 0 264 280" version="1.1" xmlns="http://www.w3.org/2000/svg">
  <!-- Replace this with actual avatar SVG content -->
</svg>`;

	fs.writeFileSync(path.join(avatarsDir, `${avatar.name}.svg`), svgContent);
});

console.log("Avatar generation complete!");
