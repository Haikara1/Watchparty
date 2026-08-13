const playbackService = {

    createPlayEvent(currentTime) {

        return {
            action: "play",

            currentTime,

            timestamp: Date.now()
        };

    },


    createPauseEvent(currentTime) {

        return {
            action: "pause",

            currentTime,

            timestamp: Date.now()
        };

    },


    createSeekEvent(currentTime) {

        return {
            action: "seek",

            currentTime,

            timestamp: Date.now()
        };

    }

};


export default playbackService;