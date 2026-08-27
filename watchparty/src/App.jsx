import { lazy, Suspense } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    useLocation
} from "react-router-dom";

import Home from "./pages/Home";

import Header from "./components/Header/Header";

import Footer from "./components/Footer/Footer";

const Salas = lazy(() => import("./pages/Salas/Salas"));
const CriarSala = lazy(() => import("./pages/CriarSala/CriarSala"));
const WatchRoom = lazy(() => import("./pages/WatchRoom/WatchRoom"));


function AppContent() {

    const location = useLocation();


    /*
    ============================================================
    DETECTAR WATCH ROOM
    ============================================================
    */

    const isWatchRoom =
        location.pathname.startsWith("/watch/");


    return (
        <>

            {/* ==================================================
                HEADER GLOBAL
            ================================================== */}

            {!isWatchRoom && (
                <Header />
            )}


            {/* ==================================================
                ROTAS
            ================================================== */}

            <Suspense fallback={<main className="route-loading" aria-busy="true" aria-label="Carregando" />}>
            <Routes>


                {/* ==================================================
                    HOME
                ================================================== */}

                <Route
                    path="/"
                    element={
                        <Home />
                    }
                />


                {/* ==================================================
                    SALAS
                ================================================== */}

                <Route
                    path="/salas"
                    element={
                        <Salas />
                    }
                />

                <Route
                    path="/salas/criar"
                    element={
                        <CriarSala />
                    }
                />


                {/* ==================================================
                    WATCH ROOM
                ================================================== */}

                <Route
                    path="/watch/:roomId"
                    element={
                        <WatchRoom />
                    }
                />


            </Routes>
            </Suspense>


            {/* ==================================================
                FOOTER GLOBAL
            ================================================== */}

            {!isWatchRoom && (
                <Footer />
            )}

        </>
    );

}


function App() {

    return (

        <BrowserRouter>

            <AppContent />

        </BrowserRouter>

    );

}


export default App;
