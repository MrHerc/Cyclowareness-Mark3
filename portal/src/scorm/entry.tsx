import { createRoot } from "react-dom/client";
import { dirOf } from "@/i18n/config";
import { ScormApp, type ScormData } from "./app";
import { connect, findApi } from "./scorm-api";

// The offline player's entry (bundled by scripts/build-scorm-player.ts into player.js). lessons.js, loaded
// before it, sets the data: a script rather than a fetch, because an LMS may open the package from file://.
const data = (window as Window & { CYCLOWARENESS_SCORM?: ScormData }).CYCLOWARENESS_SCORM!;
const session = connect(findApi(window), data.lessons);
const html = document.documentElement;
html.lang = data.locale;
html.dir = dirOf(data.locale);
html.dataset.motion = "full";
window.addEventListener("pagehide", () => session.finish());
createRoot(document.getElementById("root")!).render(<ScormApp data={data} session={session} />);
