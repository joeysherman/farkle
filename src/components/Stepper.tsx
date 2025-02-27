import type { FunctionComponent } from "../common/types";

interface Step {
	label: string;
	status: "completed" | "current" | "upcoming";
}

interface StepperProps {
	steps: Array<Step>;
	currentStep: number;
}

export const Stepper = ({
	steps,
	currentStep,
}: StepperProps): FunctionComponent => {
	return (
		<ol className="flex items-center w-full">
			{steps.map((step: Step, index: number) => (
				<li
					key={step.label}
					className={`flex items-center ${
						index !== steps.length - 1 ? "w-full" : ""
					}`}
				>
					{/* Step indicator */}
					<div className="flex items-center">
						<div
							className={`flex items-center justify-center w-10 h-10 rounded-full lg:h-12 lg:w-12 shrink-0 ${
								step.status === "completed"
									? "bg-blue-600 text-white"
									: step.status === "current"
										? "bg-blue-600 text-white"
										: "bg-gray-200 text-gray-500"
							}`}
						>
							{step.status === "completed" ? (
								<svg
									aria-hidden="true"
									className="w-5 h-5"
									fill="none"
									viewBox="0 0 16 12"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										d="M1 5.917 5.724 10.5 15 1.5"
										stroke="currentColor"
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="2"
									/>
								</svg>
							) : (
								<span className="text-lg font-medium">{index + 1}</span>
							)}
						</div>
						<span
							className={`ml-4 text-sm font-medium ${
								step.status === "completed" || step.status === "current"
									? "text-blue-600"
									: "text-gray-500"
							}`}
						>
							{step.label}
						</span>
					</div>
					{/* Connector line */}
					{index !== steps.length - 1 && (
						<div className="flex-1 ml-4 mr-4">
							<div
								className={`h-[1px] ${
									step.status === "completed" ? "bg-blue-600" : "bg-gray-200"
								}`}
							/>
						</div>
					)}
				</li>
			))}
		</ol>
	);
};
