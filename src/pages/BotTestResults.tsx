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
			<div className="min-h-screen bg-gradient-to-br from-base-200 to-base-100 flex items-center justify-center p-8">
				<div className="text-center">
					<ArrowPathIcon className="animate-spin h-8 w-8 text-accent mx-auto mb-4" />
					<h2 className="text-lg font-medium text-neutral mb-2">
						Running Bot Decision Tests
					</h2>
					<p className="text-slate-500">
						Please wait while we execute the bot decision analysis...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-base-200 to-base-100 flex items-center justify-center p-8">
				<div className="text-center max-w-md mx-auto">
					<ExclamationTriangleIcon className="h-12 w-12 text-error mx-auto mb-4" />
					<h2 className="text-lg font-medium text-neutral mb-2">
						Failed to Load Test Data
					</h2>
					<p className="text-slate-500 mb-4">{error}</p>
					<button className="btn btn-accent" onClick={loadTestData}>
						<ArrowPathIcon className="w-4 h-4" />
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (!testData) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-base-200 to-base-100 flex items-center justify-center p-8">
				<div className="text-center max-w-md mx-auto">
					<PlayIcon className="h-12 w-12 text-accent mx-auto mb-4" />
					<h2 className="text-lg font-medium text-neutral mb-2">
						Ready to Run Bot Decision Tests
					</h2>
					<p className="text-slate-500 mb-6">
						Execute comprehensive bot decision analysis with 47 different test
						scenarios.
					</p>
					<button
						className="btn btn-accent"
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
		<div className="min-h-screen bg-gradient-to-br from-base-200 to-base-100">
			<BotTestVisualizer
				isRunningTests={loading}
				testData={testData}
				onRerunTests={loadTestData}
			/>
		</div>
	);
};

export default BotTestResults;
