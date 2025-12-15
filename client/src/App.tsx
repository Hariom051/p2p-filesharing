import "./App.css";
import Layout from "./shared/components/main-layout";
import Receive from "./components/receive";
import Sender from "./components/sender";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Sender />} />
          <Route path="/receive/:roomId" element={<Receive />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
