const playbackService = {

    /*
    ============================================================
    PLAY
    ============================================================
    */

    createPlayEvent(
        currentTime,
        userId
    ) {

        return {

            action: "play",

            currentTime,

            userId,

            timestamp: Date.now()

        };

    },


    /*
    ============================================================
    PAUSE
    ============================================================
    */

    createPauseEvent(
        currentTime,
        userId
    ) {

        return {

            action: "pause",

            currentTime,

            userId,

            timestamp: Date.now()

        };

    },


    /*
    ============================================================
    SEEK
    ============================================================
    */

    createSeekEvent(
        currentTime,
        userId
    ) {

        return {

            action: "seek",

            currentTime,

            userId,

            timestamp: Date.now()

        };

    }

};


export default playbackService;