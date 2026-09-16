import { TUXApp } from "@byted-tiktok/tux-web";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { useTheme } from "./context/theme";
import { APP_ROUTES } from "./routes";

export default function App() {
  const { resolvedTheme } = useTheme();

  return (
    <TUXApp theme={resolvedTheme} textDirection="ltr" platform="iOS">
      <BrowserRouter>
        <Routes>
          {APP_ROUTES.map((route) => (
            <Route key={route.id} path={route.path} element={route.element} />
          ))}
        </Routes>
      </BrowserRouter>
    </TUXApp>
  );
}
