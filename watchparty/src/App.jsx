import {
    BrowserRouter,
    Routes,
    Route,
    useLocation
} from "react-router-dom";

import Home from "./pages/Home";

import Salas from "./pages/Salas/Salas";

import Header from "./components/Header/Header";

import Footer from "./components/Footer/Footer";

import WatchRoom from "./pages/WatchRoom/WatchRoom";

import CriarSala from "./pages/CriarSala/CriarSala";


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

