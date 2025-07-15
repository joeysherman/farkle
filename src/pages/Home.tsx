import { Link } from "@tanstack/react-router";

interface FeatureCardProps {
	description: string;
	icon: string;
	title: string;
}

export const Home = (): JSX.Element => {
	return (
		<div className="min-h-screen bg-gradient-to-br from-base-200 to-base-100">
			{/* Hero Section */}
			<div className="container mx-auto px-4 py-16">
				<div className="text-center mb-16">
					<h1 className="text-5xl md:text-6xl font-bold mb-6 animate-fade-in text-neutral">
						🎲 Welcome to Farkle
					</h1>
					<p className="text-xl md:text-2xl mb-8 text-slate-500">
						Experience the classic dice game with a modern twist
					</p>
					<Link
						className="btn btn-accent btn-lg font-bold shadow-lg hover:scale-105 transform transition-all"
						to="/signup"
					>
						Play Now
					</Link>
				</div>

				{/* Features Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
					<FeatureCard
						description="Realistic dice rolling with stunning 3D graphics"
						icon="🎲"
						title="3D Dice Physics"
					/>
					<FeatureCard
						description="Play with friends in real-time"
						icon="👥"
						title="Multiplayer"
					/>
					<FeatureCard
						description="Comprehensive scoring system and statistics"
						icon="📊"
						title="Score Tracking"
					/>
					<FeatureCard
						description="Customize the game to your preferences"
						icon="🎮"
						title="Custom Rules"
					/>
				</div>

				{/* How to Play Section */}
				<div className="card bg-base-100 shadow-md ring-1 ring-base-300 mb-16">
					<div className="card-body">
						<h2 className="card-title text-3xl justify-center mb-6 text-neutral">
							How to Play
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
							<div>
								<h3 className="text-xl font-semibold mb-4 text-neutral">
									Basic Rules
								</h3>
								<ul className="space-y-3 text-slate-500">
									<li>• Roll six dice and set aside scoring combinations</li>
									<li>
										• Continue rolling remaining dice to add to your score
									</li>
									<li>• First to reach 10,000 points wins!</li>
								</ul>
							</div>
							<div>
								<h3 className="text-xl font-semibold mb-4 text-neutral">
									Scoring
								</h3>
								<ul className="space-y-3 text-slate-500">
									<li>• Three of a kind: 100 × dice value</li>
									<li>• Four of a kind: 1000 points</li>
									<li>• Five of a kind: 2000 points</li>
									<li>• Six of a kind: 3000 points</li>
								</ul>
							</div>
						</div>
					</div>
				</div>

				{/* Final CTA */}
				<div className="text-center">
					<h2 className="text-3xl font-bold mb-6 text-neutral">
						Ready to Play?
					</h2>
					<Link
						className="btn btn-accent btn-lg font-bold shadow-lg hover:scale-105 transform transition-all"
						to="/signup"
					>
						Sign Up Now
					</Link>
				</div>
			</div>
		</div>
	);
};

const FeatureCard = ({
	description,
	icon,
	title,
}: FeatureCardProps): JSX.Element => {
	return (
		<div className="card bg-base-100 shadow-md ring-1 ring-base-300 hover:ring-accent/40 transition-all duration-200 transform hover:scale-105">
			<div className="card-body text-center">
				<div className="text-4xl mb-4">{icon}</div>
				<h3 className="card-title text-xl justify-center mb-2 text-neutral">
					{title}
				</h3>
				<p className="text-slate-500">{description}</p>
			</div>
		</div>
	);
};
