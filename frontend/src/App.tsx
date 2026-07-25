import { Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { SolvePage } from "./pages/solve/SolvePage";
import { ReviewPage } from "./pages/review/ReviewPage";
import { SettingsPage } from "./pages/settings/SettingsPage";

function App() {
  return (
    <div className="min-h-full">
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/solve/:problemId" element={<SolvePage />} />
        <Route path="/review/:sessionId" element={<ReviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}

export default App;
