import { TUXApp } from "@byted-tiktok/tux-web";

import ArExperience from "./features/ar/ar_experience";

export default function App() {
  return (
    <TUXApp theme="dark" textDirection="ltr" platform="iOS">
      <ArExperience />
    </TUXApp>
  );
}
