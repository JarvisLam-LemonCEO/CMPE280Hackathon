import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./ThemeContext";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPages";
import UserHomePage from "./pages/UserHomePage";
import UserProfile from "./pages/UserProfile";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/user-home" element={<UserHomePage />} />
          <Route path="/user-profile" element={<UserProfile />} />
          <Route path="/home" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
