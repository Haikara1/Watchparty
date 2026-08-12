import {
    BrowserRouter,
    Routes,
    Route,
    useLocation
} from "react-router-dom";

import Home from "./pages/Home";
import Header from "./components/Header/Header";
import Footer from "./components/Footer/Footer";
import WatchRoom from "./pages/WatchRoom/WatchRoom";


function AppContent() {

    const location = useLocation();


    const isWatchRoom =
        location.pathname.startsWith("/watch/");


    return (
        <>

            {/* HEADER GLOBAL */}

            {!isWatchRoom && (
                <Header />
            )}


            {/* ROTAS */}

            <Routes>

                <Route
                    path="/"
                    element={<Home />}
                />

                <Route
                    path="/watch/:roomId"
                    element={<WatchRoom />}
                />

            </Routes>


            {/* FOOTER GLOBAL */}

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