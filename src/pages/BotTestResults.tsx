import React, { useState } from "react";
import BotTestVisualizer from "../components/BotTestVisualizer";
import {
	ExclamationTriangleIcon,
	ArrowPathIcon,
	PlayIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabaseClient";

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

const BotTestResults: React.FC = () => {
	const [testData, setTestData] = useState<BotTestData | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadTestData = async (): Promise<void> => {
		try {
			setLoading(true);
			setError(null);

			// Call the test_bot_decisions RPC function
			const response = await supabase.rpc("test_bot_decisions");

			if (response.error) {
				throw new Error(`Database error: ${response.error.message}`);
			}

			setTestData(response.data as BotTestData);
		} catch (error_) {
			console.error("Error loading bot test data:", error_);
			setError(
				error_ instanceof Error ? error_.message : "Failed to load test data"
			);
		} finally {
			setLoading(false);
		}
	};

	// Remove automatic loading - user will trigger tests manually

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<ArrowPathIcon className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
					<h2 className="text-lg font-medium text-gray-900 mb-2">
						Running Bot Decision Tests
					</h2>
					<p className="text-gray-500">
						Please wait while we execute the bot decision analysis...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center max-w-md mx-auto">
					<ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
					<h2 className="text-lg font-medium text-gray-900 mb-2">
						Failed to Load Test Data
					</h2>
					<p className="text-gray-500 mb-4">{error}</p>
					<button
						className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						onClick={loadTestData}
					>
						<ArrowPathIcon className="w-4 h-4" />
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (!testData) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center max-w-md mx-auto">
					<PlayIcon className="h-12 w-12 text-blue-500 mx-auto mb-4" />
					<h2 className="text-lg font-medium text-gray-900 mb-2">
						Ready to Run Bot Decision Tests
					</h2>
					<p className="text-gray-500 mb-6">
						Execute comprehensive bot decision analysis with 47 different test
						scenarios.
					</p>
					<button
						className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
						disabled={loading}
						onClick={loadTestData}
					>
						<PlayIcon className="w-5 h-5" />
						{loading ? "Running Tests..." : "Run Bot Tests"}
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<BotTestVisualizer
				isRunningTests={loading}
				testData={testData}
				onRerunTests={loadTestData}
			/>
		</div>
	);
};

export default BotTestResults;
