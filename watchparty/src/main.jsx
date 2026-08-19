import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import realtimeService from "./services/realtimeService";
import "./styles/global.css";

async function bootstrap() {
    try {
        await realtimeService.ensureAnonymousSession();
    } catch (error) {
        console.error(
            "[Auth] Não foi possível iniciar a sessão anônima. O aplicativo continuará disponível.",
            error.message
        );
    }

    createRoot(document.getElementById("root")).render(
        <StrictMode>
            <App />
        </StrictMode>
    );
}

bootstrap();
