import React, { useState, useMemo } from "react";
import {
	MagnifyingGlassIcon,
	FunnelIcon,
	ChartBarIcon,
	ArrowPathIcon,
	Squares2X2Icon,
	TableCellsIcon,
} from "@heroicons/react/24/outline";

interface BotTestResult {
	action: string;
	inputs: {
		turn_score: number;
		dice_values: Array<number>;
		player_score: number;
		target_score: number;
	};
	outputs: {
		action: string;
		reasoning: string;
		dice_to_keep: Array<number>;
		selected_dice: Array<number>;
		expected_score: number;
		remaining_dice: number;
		farkle_probability?: number;
		total_turn_score?: number;
	};
	reasoning: string;
	description: string;
	selected_dice: Array<number>;
	expected_score: number;
}

interface BotTestData {
	[key: string]: BotTestResult;
}

interface BotTestVisualizerProps {
	testData: BotTestData;
	onRerunTests?: () => void;
	isRunningTests?: boolean;
}

const BotTestVisualizer: React.FC<BotTestVisualizerProps> = ({
	testData,
	onRerunTests,
	isRunningTests = false,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [actionFilter, setActionFilter] = useState<
		"all" | "continue" | "bank" | "bust"
	>("all");
	const [scoreRange, setScoreRange] = useState<
		"all" | "low" | "medium" | "high"
	>("all");
	const [showStats, setShowStats] = useState(false);
	const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

	// Dice component mappings
	const getDiceIcon = (value: number) => {
		const getDicePattern = (num: number) => {
			const patterns = {
				1: [false, false, false, false, true, false, false, false, false],
				2: [true, false, false, false, false, false, false, false, true],
				3: [true, false, false, false, true, false, false, false, true],
				4: [true, false, true, false, false, false, true, false, true],
				5: [true, false, true, false, true, false, true, false, true],
				6: [true, false, true, true, false, true, true, false, true],
			};
			return patterns[num as keyof typeof patterns] || patterns[1];
		};

		const pattern = getDicePattern(value);

		return (
			<div className="w-4 h-4 border border-blue-600 rounded bg-white grid grid-cols-3 gap-0 p-0.5">
				{pattern.map((dot, index) => (
					<div
						key={index}
						className={`w-0.5 h-0.5 rounded-full ${dot ? "bg-blue-600" : "bg-transparent"}`}
					/>
				))}
			</div>
		);
	};

	// Filter and search logic
	const filteredData = useMemo(() => {
		return Object.entries(testData).filter(([key, result]) => {
			// Search filter
			const matchesSearch =
				searchTerm === "" ||
				key.toLowerCase().includes(searchTerm.toLowerCase()) ||
				result.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
				result.reasoning.toLowerCase().includes(searchTerm.toLowerCase());

			// Action filter
			const matchesAction =
				actionFilter === "all" || result.action === actionFilter;

			// Score range filter
			let matchesScore = true;
			if (scoreRange !== "all") {
				const score = result.expected_score;
				switch (scoreRange) {
					case "low":
						matchesScore = score <= 200;
						break;
					case "medium":
						matchesScore = score > 200 && score <= 500;
						break;
					case "high":
						matchesScore = score > 500;
						break;
				}
			}

			return matchesSearch && matchesAction && matchesScore;
		});
	}, [testData, searchTerm, actionFilter, scoreRange]);

	// Statistics calculation
	const stats = useMemo(() => {
		const results = Object.values(testData);
		const totalTests = results.length;
		const continueCount = results.filter((r) => r.action === "continue").length;
		const bankCount = results.filter((r) => r.action === "bank").length;
		const bustCount = results.filter((r) => r.action === "bust").length;

		const avgScore =
			results.reduce((sum, r) => sum + r.expected_score, 0) / totalTests;
		const maxScore = Math.max(...results.map((r) => r.expected_score));
		const minScore = Math.min(...results.map((r) => r.expected_score));

		return {
			totalTests,
			continueCount,
			bankCount,
			bustCount,
			avgScore: avgScore.toFixed(1),
			maxScore,
			minScore,
			continuePercentage: ((continueCount / totalTests) * 100).toFixed(1),
			bankPercentage: ((bankCount / totalTests) * 100).toFixed(1),
		};
	}, [testData]);

	const getActionColor = (action: string) => {
		switch (action) {
			case "continue":
				return "bg-green-100 text-green-800 border-green-200";
			case "bank":
				return "bg-blue-100 text-blue-800 border-blue-200";
			case "bust":
				return "bg-red-100 text-red-800 border-red-200";
			default:
				return "bg-gray-100 text-gray-800 border-gray-200";
		}
	};

	const getRiskColor = (probability?: number) => {
		if (!probability) return "text-gray-500";
		if (probability < 0.2) return "text-green-600";
		if (probability < 0.4) return "text-yellow-600";
		return "text-red-600";
	};

	const renderCardView = () => (
		<div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
			{filteredData.map(([testName, result]) => (
				<div
					key={testName}
					className="border border-gray-200 rounded p-1.5 hover:shadow-md transition-shadow bg-white text-xs"
				>
					{/* Compact Header */}
					<div className="flex items-center justify-between mb-1">
						<h3 className="font-medium text-gray-900 text-xs leading-tight">
							{testName.replace(/_/g, " ")}
						</h3>
						<span
							className={`px-1 py-0.5 text-xs font-medium rounded ${getActionColor(result.action)}`}
						>
							{result.action.toUpperCase()}
						</span>
					</div>

					{/* Compact Game State */}
					<div className="grid grid-cols-4 gap-1 mb-1 text-xs">
						<div className="text-center">
							<div className="text-gray-500">Turn</div>
							<div className="font-medium">{result.inputs.turn_score}</div>
						</div>
						<div className="text-center">
							<div className="text-gray-500">Player</div>
							<div className="font-medium">{result.inputs.player_score}</div>
						</div>
						<div className="text-center">
							<div className="text-gray-500">Expected</div>
							<div className="font-medium text-green-600">
								+{result.expected_score}
							</div>
						</div>
						<div className="text-center">
							<div className="text-gray-500">Dice</div>
							<div className="font-medium">{result.outputs.remaining_dice}</div>
						</div>
					</div>

					{/* Compact Dice Display */}
					<div className="mb-1">
						<div className="flex items-center gap-1 justify-center">
							{result.inputs.dice_values.map((value, index) => (
								<div
									key={index}
									className={`p-0.5 border rounded ${
										result.selected_dice.includes(index)
											? "bg-green-100 border-green-300"
											: "bg-gray-50 border-gray-200"
									}`}
								>
									{getDiceIcon(value)}
								</div>
							))}
						</div>
					</div>

					{/* Risk & Reasoning */}
					<div className="space-y-1">
						{result.outputs.farkle_probability && (
							<div className="text-center">
								<span className="text-gray-600">Risk: </span>
								<span
									className={`font-medium ${getRiskColor(result.outputs.farkle_probability)}`}
								>
									{(result.outputs.farkle_probability * 100).toFixed(1)}%
								</span>
							</div>
						)}
						<div className="text-xs text-gray-700 bg-blue-50 p-1 rounded">
							{result.reasoning}
						</div>
					</div>
				</div>
			))}
		</div>
	);

	const renderTableView = () => (
		<div className="overflow-x-auto max-h-[70vh] overflow-y-auto border border-gray-200 rounded-lg">
			<table className="min-w-full bg-white text-sm">
				<thead className="bg-gray-50 sticky top-0 z-10">
					<tr>
						<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
							Test
						</th>
						<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
							Action
						</th>
						<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
							Roll
						</th>
						<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
							Selected
						</th>
						<th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
							Turn
						</th>
						<th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
							Player
						</th>
						<th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
							Expected
						</th>
						<th className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
							Risk
						</th>
						<th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
							Reasoning
						</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-gray-200">
					{filteredData.map(([testName, result]) => (
						<tr key={testName} className="hover:bg-gray-50">
							<td className="px-2 py-2 text-xs text-gray-900 border-b">
								{testName.replace(/_/g, " ")}
							</td>
							<td className="px-2 py-2 text-xs border-b">
								<span
									className={`px-1.5 py-0.5 text-xs font-medium rounded ${getActionColor(result.action)}`}
								>
									{result.action.toUpperCase()}
								</span>
							</td>
							<td className="px-2 py-2 text-xs border-b">
								<div className="flex gap-0.5">
									{result.inputs.dice_values.map((value, index) => (
										<div
											key={index}
											className={`p-0.5 border rounded ${
												result.selected_dice.includes(index)
													? "bg-green-100 border-green-300"
													: "bg-gray-50 border-gray-200"
											}`}
										>
											{getDiceIcon(value)}
										</div>
									))}
								</div>
							</td>
							<td className="px-2 py-2 text-xs text-gray-900 border-b">
								{result.selected_dice
									.map((i) => result.inputs.dice_values[i])
									.join(", ")}
							</td>
							<td className="px-2 py-2 text-xs text-right text-gray-900 border-b">
								{result.inputs.turn_score}
							</td>
							<td className="px-2 py-2 text-xs text-right text-gray-900 border-b">
								{result.inputs.player_score}
							</td>
							<td className="px-2 py-2 text-xs text-right text-green-600 font-medium border-b">
								+{result.expected_score}
							</td>
							<td className="px-2 py-2 text-xs text-right border-b">
								{result.outputs.farkle_probability ? (
									<span
										className={`font-medium ${getRiskColor(result.outputs.farkle_probability)}`}
									>
										{(result.outputs.farkle_probability * 100).toFixed(1)}%
									</span>
								) : (
									"-"
								)}
							</td>
							<td className="px-2 py-2 text-xs text-gray-700 border-b max-w-xs">
								<div className="truncate" title={result.reasoning}>
									{result.reasoning}
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);

	return (
		<div className="p-6 bg-white">
			<div className="mb-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-2xl font-bold text-gray-900">
						Bot Decision Test Results
					</h2>
					{onRerunTests && (
						<button
							className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
							disabled={isRunningTests}
							onClick={onRerunTests}
						>
							<ArrowPathIcon
								className={`w-4 h-4 ${isRunningTests ? "animate-spin" : ""}`}
							/>
							{isRunningTests ? "Running Tests..." : "Re-run Tests"}
						</button>
					)}
				</div>

				{/* Info Banner */}
				<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
					<div className="flex items-center gap-2 text-blue-800 text-sm">
						<ChartBarIcon className="w-4 h-4" />
						<span className="font-medium">Live Test Results:</span>
						<span>
							Showing {Object.keys(testData).length} bot decision scenarios
							executed from the database.
						</span>
					</div>
				</div>

				{/* Controls */}
				<div className="flex flex-wrap gap-4 mb-4">
					{/* Search */}
					<div className="relative flex-1 min-w-64">
						<MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
						<input
							className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Search tests..."
							type="text"
							value={searchTerm}
						/>
					</div>

					{/* Action Filter */}
					<select
						className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						onChange={(e) => setActionFilter(e.target.value as any)}
						value={actionFilter}
					>
						<option value="all">All Actions</option>
						<option value="continue">Continue</option>
						<option value="bank">Bank</option>
						<option value="bust">Bust</option>
					</select>

					{/* Score Range Filter */}
					<select
						className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						onChange={(e) => setScoreRange(e.target.value as any)}
						value={scoreRange}
					>
						<option value="all">All Scores</option>
						<option value="low">Low (≤200)</option>
						<option value="medium">Medium (201-500)</option>
						<option value="high">High (&gt;500)</option>
					</select>

					{/* View Mode Toggle */}
					<div className="flex border border-gray-300 rounded-lg overflow-hidden">
						<button
							className={`px-3 py-2 text-sm font-medium transition-colors ${
								viewMode === "cards"
									? "bg-blue-600 text-white"
									: "bg-white text-gray-700 hover:bg-gray-50"
							}`}
							onClick={() => setViewMode("cards")}
						>
							<Squares2X2Icon className="w-4 h-4" />
						</button>
						<button
							className={`px-3 py-2 text-sm font-medium transition-colors ${
								viewMode === "table"
									? "bg-blue-600 text-white"
									: "bg-white text-gray-700 hover:bg-gray-50"
							}`}
							onClick={() => setViewMode("table")}
						>
							<TableCellsIcon className="w-4 h-4" />
						</button>
					</div>

					{/* Stats Toggle */}
					<button
						className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						onClick={() => setShowStats(!showStats)}
					>
						<ChartBarIcon className="w-4 h-4" />
						{showStats ? "Hide Stats" : "Show Stats"}
					</button>
				</div>

				{/* Statistics Panel */}
				{showStats && (
					<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg mb-6">
						<div className="text-center">
							<div className="text-2xl font-bold text-gray-900">
								{stats.totalTests}
							</div>
							<div className="text-sm text-gray-600">Total Tests</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-green-600">
								{stats.continuePercentage}%
							</div>
							<div className="text-sm text-gray-600">
								Continue ({stats.continueCount})
							</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-blue-600">
								{stats.bankPercentage}%
							</div>
							<div className="text-sm text-gray-600">
								Bank ({stats.bankCount})
							</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-red-600">
								{stats.bustCount}
							</div>
							<div className="text-sm text-gray-600">Bust</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-gray-900">
								{stats.avgScore}
							</div>
							<div className="text-sm text-gray-600">Avg Score</div>
						</div>
						<div className="text-center">
							<div className="text-2xl font-bold text-gray-900">
								{stats.maxScore}
							</div>
							<div className="text-sm text-gray-600">Max Score</div>
						</div>
					</div>
				)}
			</div>

			{/* Content based on view mode */}
			{viewMode === "cards" ? renderCardView() : renderTableView()}

			{/* No Results */}
			{filteredData.length === 0 && (
				<div className="text-center py-12">
					<div className="text-gray-400 mb-2">
						<FunnelIcon className="w-12 h-12 mx-auto" />
					</div>
					<h3 className="text-lg font-medium text-gray-900 mb-1">
						No results found
					</h3>
					<p className="text-gray-500">
						Try adjusting your search or filter criteria
					</p>
				</div>
			)}

			{/* Results Count */}
			<div className="mt-6 text-center text-sm text-gray-500">
				Showing {filteredData.length} of {Object.keys(testData).length} test
				results
			</div>
		</div>
	);
};

export default BotTestVisualizer;
