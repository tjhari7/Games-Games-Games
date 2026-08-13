import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import RandomGame from './pages/RandomGame.jsx';
import GameDetails from './pages/GameDetails.jsx';
import AddEditGame from './pages/AddEditGame.jsx';
import AllGames from './pages/AllGames.jsx';
import CategoryGames from './pages/CategoryGames.jsx';
import GameTypes from './pages/GameTypes.jsx';
import ManageTypes from './pages/ManageTypes.jsx';
import FavoriteGames from './pages/FavoriteGames.jsx';

// .device-frame wraps every route so that on desktop/tablet the whole app is
// pinned inside a 375px phone frame and each `position: fixed` descendant — the
// Add Game FAB, the A-Z index rail and its bubble, the confirm modal — resolves
// to the frame instead of escaping to the window edges. Below the phone
// breakpoint the frame is an inert passthrough and the app is full-bleed, so
// real phones render exactly as before. See the device-frame block in index.css.
//
// The frame is the containing block (via transform) but must NOT be the scroll
// container too: a `position: fixed` child of a scrolling transformed box scrolls
// away with the content instead of staying pinned. So the content scrolls inside
// .device-frame__scroll — which has no transform, so fixed chrome still resolves
// to the frame and stays locked while the list scrolls underneath.
export default function App() {
  return (
    <div className="device-frame">
      <div className="device-frame__scroll">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/random" element={<RandomGame />} />
          <Route path="/game-types" element={<GameTypes />} />
          <Route path="/favorites" element={<FavoriteGames />} />
          <Route path="/games/type/:typeId" element={<CategoryGames />} />
          <Route path="/games/:id" element={<GameDetails />} />
          <Route path="/games/new" element={<AddEditGame />} />
          <Route path="/games/:id/edit" element={<AddEditGame />} />
          <Route path="/games" element={<AllGames />} />
          <Route path="/types" element={<ManageTypes />} />
        </Routes>
      </div>
    </div>
  );
}
