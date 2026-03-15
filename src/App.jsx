import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPages";
// User Home Page
import UserHomePage from "./pages/UserHomePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        // User Home Page
        <Route path="/user-home" element={<UserPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
