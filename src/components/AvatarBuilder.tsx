import { useState } from "react";
import Avatar, { Piece } from "avataaars";

// All available options for the avataaars package
export interface AvatarOptions {
	avatarStyle: string;
	topType: string;
	accessoriesType: string;
	hairColor: string;
	facialHairType: string;
	facialHairColor: string;
	clotheType: string;
	clotheColor: string;
	eyeType: string;
	eyebrowType: string;
	mouthType: string;
	skinColor: string;
}

// Comprehensive options based on avataaars documentation
const AVATAR_OPTIONS = {
	avatarStyle: ["Circle", "Transparent"],
	topType: [
		"NoHair",
		"Eyepatch",
		"Hat",
		"Hijab",
		"Turban",
		"WinterHat1",
		"WinterHat2",
		"WinterHat3",
		"WinterHat4",
		"LongHairBigHair",
		"LongHairBob",
		"LongHairBun",
		"LongHairCurly",
		"LongHairCurvy",
		"LongHairDreads",
		"LongHairFrida",
		"LongHairFro",
		"LongHairFroBand",
		"LongHairNotTooLong",
		"LongHairShavedSides",
		"LongHairMiaWallace",
		"LongHairStraight",
		"LongHairStraight2",
		"LongHairStraightStrand",
		"ShortHairDreads01",
		"ShortHairDreads02",
		"ShortHairFrizzle",
		"ShortHairShaggyMullet",
		"ShortHairShortCurly",
		"ShortHairShortFlat",
		"ShortHairShortRound",
		"ShortHairShortWaved",
		"ShortHairSides",
		"ShortHairTheCaesar",
		"ShortHairTheCaesarSidePart",
	],
	accessoriesType: [
		"Blank",
		"Kurt",
		"Prescription01",
		"Prescription02",
		"Round",
		"Sunglasses",
		"Wayfarers",
	],
	hairColor: [
		"Auburn",
		"Black",
		"Blonde",
		"BlondeGolden",
		"Brown",
		"BrownDark",
		"PastelPink",
		"Platinum",
		"Red",
		"SilverGray",
	],
	facialHairType: [
		"Blank",
		"BeardMedium",
		"BeardLight",
		"BeardMajestic",
		"MoustacheFancy",
		"MoustacheMagnum",
	],
	facialHairColor: [
		"Auburn",
		"Black",
		"Blonde",
		"BlondeGolden",
		"Brown",
		"BrownDark",
		"Platinum",
		"Red",
	],
	clotheType: [
		"BlazerShirt",
		"BlazerSweater",
		"CollarSweater",
		"GraphicShirt",
		"Hoodie",
		"Overall",
		"ShirtCrewNeck",
		"ShirtScoopNeck",
		"ShirtVNeck",
	],
	clotheColor: [
		"Black",
		"Blue01",
		"Blue02",
		"Blue03",
		"Gray01",
		"Gray02",
		"Heather",
		"PastelBlue",
		"PastelGreen",
		"PastelOrange",
		"PastelRed",
		"PastelYellow",
		"Pink",
		"Red",
		"White",
	],
	eyeType: [
		"Close",
		"Cry",
		"Default",
		"Dizzy",
		"EyeRoll",
		"Happy",
		"Hearts",
		"Side",
		"Squint",
		"Surprised",
		"Wink",
		"WinkWacky",
	],
	eyebrowType: [
		"Angry",
		"AngryNatural",
		"Default",
		"DefaultNatural",
		"FlatNatural",
		"RaisedExcited",
		"RaisedExcitedNatural",
		"SadConcerned",
		"SadConcernedNatural",
		"UnibrowNatural",
		"UpDown",
		"UpDownNatural",
	],
	mouthType: [
		"Concerned",
		"Default",
		"Disbelief",
		"Eating",
		"Grimace",
		"Sad",
		"ScreamOpen",
		"Serious",
		"Smile",
		"Tongue",
		"Twinkle",
		"Vomit",
	],
	skinColor: [
		"Tanned",
		"Yellow",
		"Pale",
		"Light",
		"Brown",
		"DarkBrown",
		"Black",
	],
};

// Color mappings for display
const COLOR_DISPLAY = {
	Auburn: "#A55728",
	Black: "#2C1B18",
	Blonde: "#B58143",
	BlondeGolden: "#D6B370",
	Brown: "#724133",
	BrownDark: "#4A312C",
	PastelPink: "#F4C2C2",
	Platinum: "#ECDCBF",
	Red: "#C93305",
	SilverGray: "#E8E1E1",
	Blue01: "#65C9FF",
	Blue02: "#5199E4",
	Blue03: "#25557C",
	Gray01: "#E6E6E6",
	Gray02: "#929598",
	Heather: "#3C4F5C",
	PastelBlue: "#B1E2FF",
	PastelGreen: "#A7FFC4",
	PastelOrange: "#FFDEB5",
	PastelRed: "#FFAFB9",
	PastelYellow: "#FFFFB1",
	Pink: "#FF488E",
	White: "#FFFFFF",
	Tanned: "#FD9841",
	Yellow: "#F8D25C",
	Pale: "#FDBCB4",
	Light: "#EDB98A",
	DarkBrown: "#AE5D29",
};

interface AvatarBuilderProps {
	onAvatarChange?: (options: AvatarOptions) => void;
	initialOptions?: Partial<AvatarOptions>;
}

export const AvatarBuilder = ({
	onAvatarChange,
	initialOptions = {},
}: AvatarBuilderProps): JSX.Element => {
	const [avatarOptions, setAvatarOptions] = useState<AvatarOptions>({
		avatarStyle: "Circle",
		topType: "ShortHairShortFlat",
		accessoriesType: "Blank",
		hairColor: "BrownDark",
		facialHairType: "Blank",
		facialHairColor: "BrownDark",
		clotheType: "BlazerShirt",
		clotheColor: "Blue03",
		eyeType: "Default",
		eyebrowType: "Default",
		mouthType: "Default",
		skinColor: "Light",
		...initialOptions,
	});

	const [activeCategory, setActiveCategory] = useState<string>("hair");

	const updateOption = (key: keyof AvatarOptions, value: string): void => {
		const newOptions = { ...avatarOptions, [key]: value };
		setAvatarOptions(newOptions);
		onAvatarChange?.(newOptions);
	};

	const randomizeAvatar = (): void => {
		const randomOptions: AvatarOptions = {
			avatarStyle: "Circle",
			topType:
				AVATAR_OPTIONS.topType[
					Math.floor(Math.random() * AVATAR_OPTIONS.topType.length)
				]!,
			accessoriesType:
				AVATAR_OPTIONS.accessoriesType[
					Math.floor(Math.random() * AVATAR_OPTIONS.accessoriesType.length)
				]!,
			hairColor:
				AVATAR_OPTIONS.hairColor[
					Math.floor(Math.random() * AVATAR_OPTIONS.hairColor.length)
				]!,
			facialHairType:
				AVATAR_OPTIONS.facialHairType[
					Math.floor(Math.random() * AVATAR_OPTIONS.facialHairType.length)
				]!,
			facialHairColor:
				AVATAR_OPTIONS.facialHairColor[
					Math.floor(Math.random() * AVATAR_OPTIONS.facialHairColor.length)
				]!,
			clotheType:
				AVATAR_OPTIONS.clotheType[
					Math.floor(Math.random() * AVATAR_OPTIONS.clotheType.length)
				]!,
			clotheColor:
				AVATAR_OPTIONS.clotheColor[
					Math.floor(Math.random() * AVATAR_OPTIONS.clotheColor.length)
				]!,
			eyeType:
				AVATAR_OPTIONS.eyeType[
					Math.floor(Math.random() * AVATAR_OPTIONS.eyeType.length)
				]!,
			eyebrowType:
				AVATAR_OPTIONS.eyebrowType[
					Math.floor(Math.random() * AVATAR_OPTIONS.eyebrowType.length)
				]!,
			mouthType:
				AVATAR_OPTIONS.mouthType[
					Math.floor(Math.random() * AVATAR_OPTIONS.mouthType.length)
				]!,
			skinColor:
				AVATAR_OPTIONS.skinColor[
					Math.floor(Math.random() * AVATAR_OPTIONS.skinColor.length)
				]!,
		};
		setAvatarOptions(randomOptions);
		onAvatarChange?.(randomOptions);
	};

	const renderColorPicker = (
		colors: string[],
		currentValue: string,
		onChange: (value: string) => void
	) => (
		<div className="grid grid-cols-5 gap-3">
			{colors.map((color) => (
				<button
					key={color}
					className={`w-12 h-12 rounded-full border-2 hover:scale-110 transition-all duration-200 shadow-md hover:shadow-lg ${
						currentValue === color
							? "border-primary border-4 ring-2 ring-primary ring-opacity-50"
							: "border-base-300 hover:border-primary"
					}`}
					style={{
						backgroundColor:
							COLOR_DISPLAY[color as keyof typeof COLOR_DISPLAY] || "#ccc",
					}}
					title={color}
					onClick={() => onChange(color)}
				/>
			))}
		</div>
	);

	const renderHairStyleGrid = (
		options: string[],
		currentValue: string,
		onChange: (value: string) => void
	) => (
		<div className="flex flex-wrap justify-center gap-3">
			{options.map((option) => (
				<button
					key={option}
					className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 bg-base-100 hover:shadow-lg ${
						currentValue === option
							? "border-primary ring-2 ring-primary ring-opacity-50"
							: "border-base-300 hover:border-primary"
					}`}
					onClick={() => onChange(option)}
					title={option.replace(/([A-Z])/g, " $1").trim()}
				>
					<div className="w-16 h-16 flex items-center justify-center">
						<Piece
							avatarStyle="Transparent"
							pieceType="top"
							pieceSize="64"
							topType={option}
							hairColor={avatarOptions.hairColor}
						/>
					</div>
				</button>
			))}
		</div>
	);

	const renderFacialHairGrid = (
		options: string[],
		currentValue: string,
		onChange: (value: string) => void
	) => (
		<div className="flex flex-wrap justify-center gap-3">
			{options.map((option) => (
				<button
					key={option}
					className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 bg-base-100 hover:shadow-lg ${
						currentValue === option
							? "border-primary ring-2 ring-primary ring-opacity-50"
							: "border-base-300 hover:border-primary"
					}`}
					onClick={() => onChange(option)}
					title={option.replace(/([A-Z])/g, " $1").trim()}
				>
					<div className="w-16 h-16 flex items-center justify-center">
						<Piece
							avatarStyle="Transparent"
							pieceType="facialHair"
							pieceSize="64"
							facialHairType={option}
							facialHairColor={avatarOptions.facialHairColor}
						/>
					</div>
				</button>
			))}
		</div>
	);

	const renderEyeGrid = (
		options: string[],
		currentValue: string,
		onChange: (value: string) => void
	) => (
		<div className="flex flex-wrap justify-center gap-3">
			{options.map((option) => (
				<button
					key={option}
					className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 bg-base-100 hover:shadow-lg ${
						currentValue === option
							? "border-primary ring-2 ring-primary ring-opacity-50"
							: "border-base-300 hover:border-primary"
					}`}
					onClick={() => onChange(option)}
					title={option.replace(/([A-Z])/g, " $1").trim()}
				>
					<div className="w-16 h-16 flex items-center justify-center">
						<Piece
							avatarStyle="Transparent"
							pieceType="eyes"
							pieceSize="64"
							eyeType={option}
						/>
					</div>
				</button>
			))}
		</div>
	);

	const renderEyebrowGrid = (
		options: string[],
		currentValue: string,
		onChange: (value: string) => void
	) => (
		<div className="flex flex-wrap justify-center gap-3">
			{options.map((option) => (
				<button
					key={option}
					className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 bg-base-100 hover:shadow-lg ${
						currentValue === option
							? "border-primary ring-2 ring-primary ring-opacity-50"
							: "border-base-300 hover:border-primary"
					}`}
					onClick={() => onChange(option)}
					title={option.replace(/([A-Z])/g, " $1").trim()}
				>
					<div className="w-16 h-16 flex items-center justify-center">
						<Piece
							avatarStyle="Transparent"
							pieceType="eyebrows"
							pieceSize="64"
							eyebrowType={option}
						/>
					</div>
				</button>
			))}
		</div>
	);

	const renderMouthGrid = (
		options: string[],
		currentValue: string,
		onChange: (value: string) => void
	) => (
		<div className="flex flex-wrap justify-center gap-3">
			{options.map((option) => (
				<button
					key={option}
					className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 bg-base-100 hover:shadow-lg ${
						currentValue === option
							? "border-primary ring-2 ring-primary ring-opacity-50"
							: "border-base-300 hover:border-primary"
					}`}
					onClick={() => onChange(option)}
					title={option.replace(/([A-Z])/g, " $1").trim()}
				>
					<div className="w-16 h-16 flex items-center justify-center">
						<Piece
							avatarStyle="Transparent"
							pieceType="mouth"
							pieceSize="64"
							mouthType={option}
						/>
					</div>
				</button>
			))}
		</div>
	);

	const renderAccessoriesGrid = (
		options: string[],
		currentValue: string,
		onChange: (value: string) => void
	) => (
		<div className="flex flex-wrap justify-center gap-3">
			{options.map((option) => (
				<button
					key={option}
					className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 bg-base-100 hover:shadow-lg ${
						currentValue === option
							? "border-primary ring-2 ring-primary ring-opacity-50"
							: "border-base-300 hover:border-primary"
					}`}
					onClick={() => onChange(option)}
					title={option.replace(/([A-Z])/g, " $1").trim()}
				>
					<div className="w-16 h-16 flex items-center justify-center">
						<Piece
							avatarStyle="Transparent"
							pieceType="accessories"
							pieceSize="64"
							accessoriesType={option}
						/>
					</div>
				</button>
			))}
		</div>
	);

	const renderClothingGrid = (
		options: string[],
		currentValue: string,
		onChange: (value: string) => void
	) => (
		<div className="flex flex-wrap justify-center gap-3">
			{options.map((option) => (
				<button
					key={option}
					className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 bg-base-100 hover:shadow-lg ${
						currentValue === option
							? "border-primary ring-2 ring-primary ring-opacity-50"
							: "border-base-300 hover:border-primary"
					}`}
					onClick={() => onChange(option)}
					title={option.replace(/([A-Z])/g, " $1").trim()}
				>
					<div className="w-16 h-16 flex items-center justify-center">
						<Piece
							avatarStyle="Transparent"
							pieceType="clothe"
							pieceSize="64"
							clotheType={option}
							clotheColor={avatarOptions.clotheColor}
						/>
					</div>
				</button>
			))}
		</div>
	);

	const renderSkinColorGrid = (
		options: string[],
		currentValue: string,
		onChange: (value: string) => void
	) => (
		<div className="flex flex-wrap justify-center gap-3">
			{options.map((option) => (
				<button
					key={option}
					className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 bg-base-100 hover:shadow-lg ${
						currentValue === option
							? "border-primary ring-2 ring-primary ring-opacity-50"
							: "border-base-300 hover:border-primary"
					}`}
					onClick={() => onChange(option)}
					title={option.replace(/([A-Z])/g, " $1").trim()}
				>
					<div className="w-16 h-16 flex items-center justify-center">
						<Piece
							avatarStyle="Transparent"
							pieceType="skin"
							pieceSize="64"
							skinColor={option}
						/>
					</div>
				</button>
			))}
		</div>
	);

	const categories = [
		{
			id: "hair",
			name: "Hair",
			icon: "💇",
			sections: [
				{
					title: "Hair Style",
					content: renderHairStyleGrid(
						AVATAR_OPTIONS.topType,
						avatarOptions.topType,
						(value) => updateOption("topType", value)
					),
				},
				{
					title: "Hair Color",
					content: renderColorPicker(
						AVATAR_OPTIONS.hairColor,
						avatarOptions.hairColor,
						(value) => updateOption("hairColor", value)
					),
				},
			],
		},
		{
			id: "facial",
			name: "Facial",
			icon: "🧔",
			sections: [
				{
					title: "Facial Hair",
					content: renderFacialHairGrid(
						AVATAR_OPTIONS.facialHairType,
						avatarOptions.facialHairType,
						(value) => updateOption("facialHairType", value)
					),
				},
				{
					title: "Facial Hair Color",
					content: renderColorPicker(
						AVATAR_OPTIONS.facialHairColor,
						avatarOptions.facialHairColor,
						(value) => updateOption("facialHairColor", value)
					),
				},
			],
		},
		{
			id: "face",
			name: "Face",
			icon: "😊",
			sections: [
				{
					title: "Skin Color",
					content: renderSkinColorGrid(
						AVATAR_OPTIONS.skinColor,
						avatarOptions.skinColor,
						(value) => updateOption("skinColor", value)
					),
				},
				{
					title: "Eyes",
					content: renderEyeGrid(
						AVATAR_OPTIONS.eyeType,
						avatarOptions.eyeType,
						(value) => updateOption("eyeType", value)
					),
				},
				{
					title: "Eyebrows",
					content: renderEyebrowGrid(
						AVATAR_OPTIONS.eyebrowType,
						avatarOptions.eyebrowType,
						(value) => updateOption("eyebrowType", value)
					),
				},
				{
					title: "Mouth",
					content: renderMouthGrid(
						AVATAR_OPTIONS.mouthType,
						avatarOptions.mouthType,
						(value) => updateOption("mouthType", value)
					),
				},
			],
		},
		{
			id: "accessories",
			name: "Accessories",
			icon: "🕶️",
			sections: [
				{
					title: "Glasses & Accessories",
					content: renderAccessoriesGrid(
						AVATAR_OPTIONS.accessoriesType,
						avatarOptions.accessoriesType,
						(value) => updateOption("accessoriesType", value)
					),
				},
			],
		},
		{
			id: "clothing",
			name: "Clothing",
			icon: "👕",
			sections: [
				{
					title: "Clothing Style",
					content: renderClothingGrid(
						AVATAR_OPTIONS.clotheType,
						avatarOptions.clotheType,
						(value) => updateOption("clotheType", value)
					),
				},
				{
					title: "Clothing Color",
					content: renderColorPicker(
						AVATAR_OPTIONS.clotheColor,
						avatarOptions.clotheColor,
						(value) => updateOption("clotheColor", value)
					),
				},
			],
		},
	];

	return (
		<div className="w-full max-w-7xl mx-auto p-6">
			<div className="grid lg:grid-cols-3 gap-8">
				{/* Avatar Preview */}
				<div className="lg:col-span-1">
					<div className="card bg-gradient-to-br from-base-100 to-base-200 shadow-2xl sticky top-4 border border-base-300">
						<div className="card-body items-center text-center">
							<h2 className="card-title mb-6 text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
								Avatar Preview
							</h2>
							<div className="w-80 h-80 flex items-center justify-center bg-gradient-to-br from-base-200 to-base-300 rounded-full mb-6 shadow-inner border-4 border-base-100">
								<Avatar
									style={{ width: "240px", height: "240px" }}
									{...avatarOptions}
								/>
							</div>
							<button
								className="btn btn-primary btn-wide gap-2 shadow-lg hover:shadow-xl transition-all duration-200"
								onClick={randomizeAvatar}
							>
								🎲 Randomize
							</button>
							<p className="text-sm text-base-content/60 mt-2">
								Click to generate a random avatar
							</p>
						</div>
					</div>
				</div>

				{/* Customization Panel */}
				<div className="lg:col-span-2">
					<div className="card bg-gradient-to-br from-base-100 to-base-200 shadow-2xl border border-base-300">
						<div className="card-body">
							<h2 className="card-title mb-6 text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
								Customize Your Avatar
							</h2>

							{/* Category Tabs */}
							<div className="tabs tabs-boxed mb-8 bg-base-200 p-1 rounded-xl">
								{categories.map((category) => (
									<button
										key={category.id}
										className={`tab transition-all duration-200 ${
											activeCategory === category.id
												? "tab-active shadow-md"
												: "hover:bg-base-300"
										}`}
										onClick={() => setActiveCategory(category.id)}
									>
										<span className="mr-2 text-lg">{category.icon}</span>
										<span className="font-medium">{category.name}</span>
									</button>
								))}
							</div>

							{/* Active Category Content */}
							<div className="space-y-8">
								{categories
									.find((cat) => cat.id === activeCategory)
									?.sections.map((section, index) => (
										<div key={index} className="space-y-4">
											<div className="flex items-center gap-3">
												<h3 className="text-xl font-bold text-base-content">
													{section.title}
												</h3>
												<div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent"></div>
											</div>
											<div className="p-6 bg-gradient-to-br from-base-200/50 to-base-300/30 rounded-2xl border border-base-300/50 shadow-inner">
												{section.content}
											</div>
										</div>
									))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default AvatarBuilder;
