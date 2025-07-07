import { useState, useRef, forwardRef, useImperativeHandle } from "react";
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
	graphicType: string;
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
	graphicType: [
		"Bat",
		"Cumbia",
		"Deer",
		"Diamond",
		"Hola",
		"Pizza",
		"Resist",
		"Selena",
		"Bear",
		"SkullOutline",
		"Skull",
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

export interface AvatarBuilderRef {
	generateAvatarBlob: () => Promise<Blob | null>;
}

export const AvatarBuilder = forwardRef<AvatarBuilderRef, AvatarBuilderProps>(
	({ onAvatarChange, initialOptions = {} }, ref) => {
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
			graphicType: "Bat",
			...initialOptions,
		});

		const [activeCategory, setActiveCategory] = useState<string>("hair");
		const avatarRef = useRef<HTMLDivElement>(null);

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
				graphicType:
					AVATAR_OPTIONS.graphicType[
						Math.floor(Math.random() * AVATAR_OPTIONS.graphicType.length)
					]!,
			};
			setAvatarOptions(randomOptions);
			onAvatarChange?.(randomOptions);
		};

		const downloadAvatar = async (): Promise<void> => {
			if (!avatarRef.current) return;

			try {
				const blob = await generateAvatarBlob();
				if (blob) {
					const url = URL.createObjectURL(blob);
					const link = document.createElement("a");
					link.href = url;
					link.download = "my-avatar.png";
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
					URL.revokeObjectURL(url);
				}
			} catch (error) {
				console.error("Failed to download avatar:", error);
			}
		};

		const generateAvatarBlob = async (): Promise<Blob | null> => {
			if (!avatarRef.current) return null;

			return new Promise((resolve, reject) => {
				try {
					// Get the SVG element
					const svgElement = avatarRef.current!.querySelector("svg");
					if (!svgElement) {
						resolve(null);
						return;
					}

					// Create a canvas to render the SVG
					const canvas = document.createElement("canvas");
					const context = canvas.getContext("2d");
					if (!context) {
						resolve(null);
						return;
					}

					// Set canvas size
					const size = 512;
					canvas.width = size;
					canvas.height = size;

					// Create an image from the SVG
					const svgData = new XMLSerializer().serializeToString(svgElement);
					const svgBlob = new Blob([svgData], {
						type: "image/svg+xml;charset=utf-8",
					});
					const svgUrl = URL.createObjectURL(svgBlob);

					const img = new Image();
					img.onload = (): void => {
						// Draw white background
						context.fillStyle = "#ffffff";
						context.fillRect(0, 0, size, size);

						// Draw the avatar
						context.drawImage(img, 0, 0, size, size);

						// Convert canvas to blob
						canvas.toBlob((blob) => {
							URL.revokeObjectURL(svgUrl);
							resolve(blob);
						}, "image/png");
					};

					img.onerror = (): void => {
						URL.revokeObjectURL(svgUrl);
						reject(new Error("Failed to load SVG image"));
					};

					img.src = svgUrl;
				} catch (error) {
					reject(error);
				}
			});
		};

		const renderOptionGrid = (
			options: Array<string>,
			currentValue: string,
			onChange: (value: string) => void,
			renderPreview?: (option: string) => JSX.Element
		): JSX.Element => (
			<div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
				{options.map((option) => {
					const displayName = option.replace(/([A-Z])/g, " $1").trim();
					return (
						<div
							key={option}
							className="tooltip tooltip-top"
							data-tip={displayName}
						>
							<button
								className={`relative w-full aspect-square p-2 rounded-lg border-2 transition-all duration-200 hover:scale-105 bg-base-100 hover:shadow-md ${
									currentValue === option
										? "border-primary ring-2 ring-primary ring-opacity-50"
										: "border-base-300 hover:border-primary"
								}`}
								onClick={() => {
									onChange(option);
								}}
							>
								<div className="w-full h-full flex items-center justify-center">
									{renderPreview ? (
										<div className="w-full h-full flex items-center justify-center overflow-hidden">
											{renderPreview(option)}
										</div>
									) : (
										<span className="text-xs font-medium text-center leading-tight">
											{option.slice(0, 3)}
										</span>
									)}
								</div>
							</button>
						</div>
					);
				})}
			</div>
		);

		const renderColorPicker = (
			colors: Array<string>,
			currentValue: string,
			onChange: (value: string) => void
		): JSX.Element => (
			<div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
				{colors.map((color) => (
					<div
						key={color}
						className="tooltip tooltip-top"
						data-tip={color.replace(/([A-Z])/g, " $1").trim()}
					>
						<button
							className={`w-full aspect-square rounded-lg border-2 hover:scale-110 transition-all duration-200 shadow-md hover:shadow-lg p-2 ${
								currentValue === color
									? "border-primary border-4 ring-2 ring-primary ring-opacity-50"
									: "border-base-300 hover:border-primary"
							}`}
							onClick={() => {
								onChange(color);
							}}
						>
							<div
								className="w-full h-full rounded-md"
								style={{
									backgroundColor:
										COLOR_DISPLAY[color as keyof typeof COLOR_DISPLAY] ||
										"#ccc",
								}}
							/>
						</button>
					</div>
				))}
			</div>
		);

		const categories = [
			{
				id: "all",
				name: "All Options",
				icon: "🎨",
				sections: [
					{
						title: "Hair Styles",
						content: renderOptionGrid(
							AVATAR_OPTIONS.topType,
							avatarOptions.topType,
							(value) => {
								updateOption("topType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									hairColor={avatarOptions.hairColor}
									pieceSize="100"
									pieceType="top"
									topType={option}
								/>
							)
						),
					},
					{
						title: "Eyes",
						content: renderOptionGrid(
							AVATAR_OPTIONS.eyeType,
							avatarOptions.eyeType,
							(value) => {
								updateOption("eyeType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									eyeType={option}
									pieceSize="400"
									pieceType="eyes"
								/>
							)
						),
					},
					{
						title: "Eyebrows",
						content: renderOptionGrid(
							AVATAR_OPTIONS.eyebrowType,
							avatarOptions.eyebrowType,
							(value) => {
								updateOption("eyebrowType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									eyebrowType={option}
									pieceSize="100"
									pieceType="eyebrows"
								/>
							)
						),
					},
					{
						title: "Mouth",
						content: renderOptionGrid(
							AVATAR_OPTIONS.mouthType,
							avatarOptions.mouthType,
							(value) => {
								updateOption("mouthType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									mouthType={option}
									pieceSize="100"
									pieceType="mouth"
								/>
							)
						),
					},
					{
						title: "Facial Hair",
						content: renderOptionGrid(
							AVATAR_OPTIONS.facialHairType,
							avatarOptions.facialHairType,
							(value) => {
								updateOption("facialHairType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									facialHairColor={avatarOptions.facialHairColor}
									facialHairType={option}
									pieceSize="100"
									pieceType="facialHair"
								/>
							)
						),
					},
					{
						title: "Accessories",
						content: renderOptionGrid(
							AVATAR_OPTIONS.accessoriesType,
							avatarOptions.accessoriesType,
							(value) => {
								updateOption("accessoriesType", value);
							},
							(option) => (
								<Piece
									accessoriesType={option}
									avatarStyle="Transparent"
									pieceSize="100"
									pieceType="accessories"
								/>
							)
						),
					},
					{
						title: "Clothing",
						content: renderOptionGrid(
							AVATAR_OPTIONS.clotheType,
							avatarOptions.clotheType,
							(value) => {
								updateOption("clotheType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									clotheColor={avatarOptions.clotheColor}
									clotheType={option}
									pieceSize="100"
									pieceType="clothe"
								/>
							)
						),
					},
					{
						title: "Graphics",
						content: renderOptionGrid(
							AVATAR_OPTIONS.graphicType,
							avatarOptions.graphicType,
							(value) => {
								updateOption("graphicType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									graphicType={option}
									pieceSize="100"
									pieceType="graphics"
								/>
							)
						),
					},
					{
						title: "Skin",
						content: renderOptionGrid(
							AVATAR_OPTIONS.skinColor,
							avatarOptions.skinColor,
							(value) => {
								updateOption("skinColor", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									pieceSize="100"
									pieceType="skin"
									skinColor={option}
								/>
							)
						),
					},
					{
						title: "Hair Colors",
						content: renderColorPicker(
							AVATAR_OPTIONS.hairColor,
							avatarOptions.hairColor,
							(value) => {
								updateOption("hairColor", value);
							}
						),
					},
					{
						title: "Skin Colors",
						content: renderColorPicker(
							AVATAR_OPTIONS.skinColor,
							avatarOptions.skinColor,
							(value) => {
								updateOption("skinColor", value);
							}
						),
					},
					{
						title: "Facial Hair Colors",
						content: renderColorPicker(
							AVATAR_OPTIONS.facialHairColor,
							avatarOptions.facialHairColor,
							(value) => {
								updateOption("facialHairColor", value);
							}
						),
					},
					{
						title: "Clothing Colors",
						content: renderColorPicker(
							AVATAR_OPTIONS.clotheColor,
							avatarOptions.clotheColor,
							(value) => {
								updateOption("clotheColor", value);
							}
						),
					},
				],
			},
			{
				id: "hair",
				name: "Hair",
				icon: "💇",
				sections: [
					{
						title: "Style",
						content: renderOptionGrid(
							AVATAR_OPTIONS.topType,
							avatarOptions.topType,
							(value) => {
								updateOption("topType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									hairColor={avatarOptions.hairColor}
									pieceSize="100"
									pieceType="top"
									topType={option}
								/>
							)
						),
					},
					{
						title: "Color",
						content: renderColorPicker(
							AVATAR_OPTIONS.hairColor,
							avatarOptions.hairColor,
							(value) => {
								updateOption("hairColor", value);
							}
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
						title: "Skin",
						content: renderColorPicker(
							AVATAR_OPTIONS.skinColor,
							avatarOptions.skinColor,
							(value) => {
								updateOption("skinColor", value);
							}
						),
					},
					{
						title: "Eyes",
						content: renderOptionGrid(
							AVATAR_OPTIONS.eyeType,
							avatarOptions.eyeType,
							(value) => {
								updateOption("eyeType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									eyeType={option}
									pieceSize="100"
									pieceType="eyes"
								/>
							)
						),
					},
					{
						title: "Eyebrows",
						content: renderOptionGrid(
							AVATAR_OPTIONS.eyebrowType,
							avatarOptions.eyebrowType,
							(value) => {
								updateOption("eyebrowType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									eyebrowType={option}
									pieceSize="100"
									pieceType="eyebrows"
								/>
							)
						),
					},
					{
						title: "Mouth",
						content: renderOptionGrid(
							AVATAR_OPTIONS.mouthType,
							avatarOptions.mouthType,
							(value) => {
								updateOption("mouthType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									mouthType={option}
									pieceSize="100"
									pieceType="mouth"
								/>
							)
						),
					},
				],
			},
			{
				id: "facial",
				name: "Facial Hair",
				icon: "🧔",
				sections: [
					{
						title: "Style",
						content: renderOptionGrid(
							AVATAR_OPTIONS.facialHairType,
							avatarOptions.facialHairType,
							(value) => {
								updateOption("facialHairType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									facialHairColor={avatarOptions.facialHairColor}
									facialHairType={option}
									pieceSize="100"
									pieceType="facialHair"
								/>
							)
						),
					},
					{
						title: "Color",
						content: renderColorPicker(
							AVATAR_OPTIONS.facialHairColor,
							avatarOptions.facialHairColor,
							(value) => {
								updateOption("facialHairColor", value);
							}
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
						title: "Glasses & More",
						content: renderOptionGrid(
							AVATAR_OPTIONS.accessoriesType,
							avatarOptions.accessoriesType,
							(value) => {
								updateOption("accessoriesType", value);
							},
							(option) => (
								<Piece
									accessoriesType={option}
									avatarStyle="Transparent"
									pieceSize="100"
									pieceType="accessories"
								/>
							)
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
						title: "Style",
						content: renderOptionGrid(
							AVATAR_OPTIONS.clotheType,
							avatarOptions.clotheType,
							(value) => {
								updateOption("clotheType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									clotheColor={avatarOptions.clotheColor}
									clotheType={option}
									pieceSize="100"
									pieceType="clothe"
								/>
							)
						),
					},
					{
						title: "Color",
						content: renderColorPicker(
							AVATAR_OPTIONS.clotheColor,
							avatarOptions.clotheColor,
							(value) => {
								updateOption("clotheColor", value);
							}
						),
					},
					{
						title: "Graphics",
						content: renderOptionGrid(
							AVATAR_OPTIONS.graphicType,
							avatarOptions.graphicType,
							(value) => {
								updateOption("graphicType", value);
							},
							(option) => (
								<Piece
									avatarStyle="Transparent"
									graphicType={option}
									pieceSize="100"
									pieceType="graphics"
								/>
							)
						),
					},
				],
			},
		];

		useImperativeHandle(ref, () => ({
			generateAvatarBlob,
		}));

		return (
			<div className="w-full max-w-4xl mx-auto">
				<div className="grid md:grid-cols-3 gap-6">
					{/* Avatar Preview - Left Side */}
					<div className="md:col-span-1">
						<div className="card bg-base-100 shadow-lg border border-base-300 sticky top-4">
							<div className="card-body p-4 text-center">
								<h3 className="font-bold text-lg mb-4">Preview</h3>
								<div
									ref={avatarRef}
									className="w-48 h-48 mx-auto mb-4 bg-gradient-to-br from-base-200 to-base-300 rounded-full flex items-center justify-center shadow-inner"
								>
									<Avatar
										style={{ width: "180px", height: "180px" }}
										{...avatarOptions}
									/>
								</div>
								<div className="flex flex-col gap-2">
									<button
										className="btn btn-primary btn-sm"
										onClick={randomizeAvatar}
									>
										🎲 Randomize
									</button>
									<button
										className="btn btn-secondary btn-sm"
										onClick={() => void downloadAvatar()}
									>
										⬇️ Download
									</button>
								</div>
							</div>
						</div>
					</div>

					{/* Customization Panel - Right Side */}
					<div className="md:col-span-2">
						<div className="card bg-base-100 shadow-lg border border-base-300">
							<div className="card-body p-4">
								<h3 className="font-bold text-lg mb-4">Categories</h3>
								{/* Category Tabs */}
								<div className="tabs tabs-boxed mb-4 bg-base-200 p-1 text-xs">
									{categories.map((category) => (
										<button
											key={category.id}
											className={`tab tab-sm flex-1 ${
												activeCategory === category.id ? "tab-active" : ""
											}`}
											onClick={() => {
												setActiveCategory(category.id);
											}}
										>
											<span className="mr-1">{category.icon}</span>
											<span className="hidden">{category.name}</span>
										</button>
									))}
								</div>

								{/* Active Category Content */}
								<div className="space-y-4 max-h-80 overflow-y-auto">
									{categories
										.find((cat) => cat.id === activeCategory)
										?.sections.map((section, index) => (
											<div key={index} className="space-y-2">
												<h4 className="font-semibold text-sm">
													{section.title}
												</h4>
												<div className="p-3 bg-base-200 rounded-lg">
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
	}
);

export default AvatarBuilder;
