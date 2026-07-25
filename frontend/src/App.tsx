import { Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { SolvePage } from "./pages/solve/SolvePage";
import { ReviewPage } from "./pages/review/ReviewPage";

function App() {
  return (
    <div className="min-h-full">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/solve/:problemId" element={<SolvePage />} />
        <Route path="/review/:sessionId" element={<ReviewPage />} />
      </Routes>
    </div>
  );
}

export default App;
