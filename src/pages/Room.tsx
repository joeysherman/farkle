import { useRef, useState } from "react";
import type { FunctionComponent } from "../common/types";
import { Scene, SceneRef } from "../_game/test";
import { Navbar } from "../components/Navbar";

export const Room = (): FunctionComponent => {
  const sceneRef = useRef<SceneRef>(null);
  const [diceValues, setDiceValues] = useState([1, 2, 3, 4, 5, 6]);

  const handleNumberChange = (index: number, value: string) => {
    const numValue = parseInt(value);
    if (numValue >= 1 && numValue <= 6) {
      setDiceValues(prev => {
        const newValues = [...prev];
        newValues[index] = numValue;
        return newValues;
      });
    }
  };

  const handleRollClick = (index: number) => {
    const value = diceValues[index];
    if (sceneRef.current && typeof value === 'number' && value >= 1 && value <= 6) {
      sceneRef.current.roll(index, value);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex flex-col space-y-4">
              <div className="grid grid-cols-6 gap-4">
                {diceValues.map((value, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={value}
                      onChange={(e) => handleNumberChange(index, e.target.value)}
                      className="w-16 px-2 py-1 border rounded"
                    />
                    <button
                      onClick={() => handleRollClick(index)}
                      className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                      Roll
                    </button>
                  </div>
                ))}
              </div>
              <div className="h-[600px] bg-gray-100 rounded-lg overflow-hidden">
                <Scene ref={sceneRef} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}; 