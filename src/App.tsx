import { Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </div>
  );
}
