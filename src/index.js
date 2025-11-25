import { createRoot } from "react-dom/client";
import App from "./app";

createRoot(document.getElementById("chatgpt-app-root")).render(<App />);

export { App };
export default App;