import HostLiveRoom from "../../components/host_live_room";
import { ThemeScope } from "../../context/theme";
import { useOverlayStyle } from "../../hooks/useOverlayStyle";

export default function HostLivePage() {
  useOverlayStyle({
    homeIndicator: "light",
    statusBar: "light",
    themeColor: "#000000",
  });

  return (
    <ThemeScope mode="dark" className="h-full min-h-0">
      <HostLiveRoom />
    </ThemeScope>
  );
}
