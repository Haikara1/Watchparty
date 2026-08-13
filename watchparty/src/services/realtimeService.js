import { createClient } from "@supabase/supabase-js";


const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL;


const supabaseKey =
    import.meta.env.VITE_SUPABASE_KEY;


if (!supabaseUrl || !supabaseKey) {

    throw new Error(
        "As variáveis do Supabase não foram configuradas."
    );

}


const supabase =
    createClient(
        supabaseUrl,
        supabaseKey


    );
        console.log("[Supabase] URL:", supabaseUrl);
         console.log("[Supabase] Key existe:", !!supabaseKey);
        console.log(
        "[Supabase] URL válida:",
        supabaseUrl?.startsWith("https://")
    );





const realtimeService = {

    // =========================
    // CRIAR CANAL DA SALA
    // =========================

    createRoomChannel(roomId) {

        if (!roomId) {

            throw new Error(
                "roomId é obrigatório."
            );

        }

        return supabase.channel(
            `watchparty-room-${roomId}`,

        );

    },

    // =========================
    // CONECTAR CANAL
    // =========================

    async connect(channel) {

        if (!channel) {

            throw new Error(
                "Canal Supabase é obrigatório."
            );

        }

        return new Promise((resolve, reject) => {

            channel.subscribe((status) => {

                console.log(
                    "[Realtime] Status:",
                    status
                );

                console.log(
                    "[Realtime] Canal:",
                    channel
                );

                console.log(
                    "[Realtime] Estado interno:",
                    channel.state
                );

                if (status === "SUBSCRIBED") {

                    console.log(
                        "[Realtime] Canal inscrito com sucesso."
                    );

                    resolve(channel);

                    return;

                }

                if (
                    status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT" ||
                    status === "CLOSED"
                ) {

                    console.error(
                        "[Realtime] Falha no canal:",
                        channel
                    );

                    reject(
                        new Error(
                            `Falha no Realtime: ${status}`
                        )
                    );

                }

            });

        });

    },


    // =========================
    // DESCONECTAR CANAL
    // =========================

    async disconnect(channel) {

        if (!channel) {

            return;

        }


        await supabase.removeChannel(
            channel
        );

    },


    // =========================
    // ENVIAR EVENTO
    // =========================

    sendPlaybackEvent(
        channel,
        event
    ) {

        if (
            !channel ||
            !event
        ) {

            return;

        }


        return channel.send({

            type: "broadcast",

            event: "playback",

            payload: event

        });

    },


    // =========================
    // OUVIR PLAYBACK
    // =========================

    onPlaybackEvent(
        channel,
        callback
    ) {

        if (
            !channel ||
            !callback
        ) {

            return;

        }


        channel.on(

            "broadcast",

            {
                event: "playback"
            },

            (payload) => {

                callback(
                    payload.payload
                );

            }

        );

    }

};


export default realtimeService;