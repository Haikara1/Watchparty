import { createClient } from "@supabase/supabase-js";


/*
============================================================
CONFIGURAÇÃO SUPABASE
============================================================
*/

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


console.log(
    "[Supabase] URL:",
    supabaseUrl
);


console.log(
    "[Supabase] Key existe:",
    !!supabaseKey
);


console.log(
    "[Supabase] URL válida:",
    supabaseUrl?.startsWith("https://")
);


/*
============================================================
REALTIME SERVICE
============================================================
*/

const realtimeService = {


    /*
    ========================================================
    CRIAR CANAL DA SALA
    ========================================================
    */

    createRoomChannel(roomId) {

        if (!roomId) {

            throw new Error(
                "roomId é obrigatório."
            );

        }


        const channel =
            supabase.channel(
                `watchparty-room-${roomId}`
            );


        console.log(
            "[Realtime] Canal criado:",
            roomId
        );


        return channel;

    },


    /*
    ========================================================
    CONECTAR CANAL
    ========================================================
    */

    async connect(channel) {

        if (!channel) {

            throw new Error(
                "Canal Supabase é obrigatório."
            );

        }


        return new Promise(
            (resolve, reject) => {

                channel.subscribe(
                    (status) => {

                        console.log(
                            "[Realtime] Status:",
                            status
                        );


                        console.log(
                            "[Realtime] Estado interno:",
                            channel.state
                        );


                        /*
                        ====================================
                        CONECTADO
                        ====================================
                        */

                        if (
                            status ===
                            "SUBSCRIBED"
                        ) {

                            console.log(
                                "[Realtime] Canal inscrito com sucesso."
                            );


                            resolve(channel);


                            return;

                        }


                        /*
                        ====================================
                        ERROS REAIS
                        ====================================
                        */

                        if (
                            status ===
                            "CHANNEL_ERROR"
                            ||
                            status ===
                            "TIMED_OUT"
                        ) {

                            console.error(
                                "[Realtime] Falha no canal:",
                                status
                            );


                            reject(
                                new Error(
                                    `Falha no Realtime: ${status}`
                                )
                            );

                        }

                    }
                );

            }
        );

    },


    /*
    ========================================================
    DESCONECTAR CANAL
    ========================================================
    */

    async disconnect(channel) {

        if (!channel) {

            return;

        }


        console.log(
            "[Realtime] Desconectando canal."
        );


        await supabase.removeChannel(
            channel
        );

    },


    /*
    ========================================================
    PLAYBACK
    ========================================================
    */


    /*
    --------------------------------------------------------
    ENVIAR EVENTO DE PLAYBACK
    --------------------------------------------------------
    */

    async sendPlaybackEvent(
        channel,
        event
    ) {

        if (
            !channel ||
            !event
        ) {

            console.warn(
                "[Realtime] Não foi possível enviar evento."
            );


            return null;

        }


        console.log(
            "[Realtime] Enviando evento:",
            event
        );


        const result =
            await channel.send({

                type: "broadcast",

                event: "playback",

                payload: event

            });


        console.log(
            "[Realtime] Evento enviado:",
            result
        );


        return result;

    },


    /*
    --------------------------------------------------------
    OUVIR EVENTOS DE PLAYBACK
    --------------------------------------------------------
    */

    onPlaybackEvent(
        channel,
        callback
    ) {

        if (
            !channel ||
            !callback
        ) {

            console.warn(
                "[Realtime] Canal ou callback inválido."
            );


            return null;

        }


        console.log(
            "[Realtime] Registrando listener de playback."
        );


        const listener =
            channel.on(

                "broadcast",

                {
                    event: "playback"
                },

                (payload) => {

                    console.log(
                        "[Realtime] Evento recebido:",
                        payload
                    );


                    const event =
                        payload?.payload;


                    if (!event) {

                        console.warn(
                            "[Realtime] Evento recebido sem payload."
                        );


                        return;

                    }


                    callback(
                        event
                    );

                }

            );


        return listener;

    },


    /*
    ========================================================
    CHAT
    ========================================================
    */


    /*
    --------------------------------------------------------
    ENVIAR MENSAGEM DO CHAT
    --------------------------------------------------------
    */

    async sendChatMessage(
        channel,
        message
    ) {

        if (
            !channel ||
            !message
        ) {

            console.warn(
                "[Realtime] Não foi possível enviar mensagem."
            );


            return null;

        }


        console.log(
            "[Realtime] Enviando mensagem:",
            message
        );


        const result =
            await channel.send({

                type: "broadcast",

                event: "chat",

                payload: message

            });


        console.log(
            "[Realtime] Mensagem enviada:",
            result
        );


        return result;

    },


    /*
    --------------------------------------------------------
    OUVIR MENSAGENS DO CHAT
    --------------------------------------------------------
    */

    onChatMessage(
        channel,
        callback
    ) {

        if (
            !channel ||
            !callback
        ) {

            console.warn(
                "[Realtime] Canal ou callback inválido."
            );


            return null;

        }


        console.log(
            "[Realtime] Registrando listener de chat."
        );


        const listener =
            channel.on(

                "broadcast",

                {
                    event: "chat"
                },

                (payload) => {

                    console.log(
                        "[Realtime] Mensagem recebida:",
                        payload
                    );


                    const message =
                        payload?.payload;


                    if (!message) {

                        console.warn(
                            "[Realtime] Mensagem recebida sem payload."
                        );


                        return;

                    }


                    callback(
                        message
                    );

                }

            );


        return listener;

    },


    /*
    ========================================================
    PRESENCE
    ========================================================
    */


    /*
    --------------------------------------------------------
    REGISTRAR USUÁRIO NA SALA
    --------------------------------------------------------
    */

    async trackPresence(
        channel,
        user
    ) {

        if (
            !channel ||
            !user
        ) {

            console.warn(
                "[Presence] Canal ou usuário inválido."
            );


            return null;

        }


        console.log(
            "[Presence] Registrando usuário:",
            user
        );


        const result =
            await channel.track(
                user
            );


        console.log(
            "[Presence] Usuário registrado:",
            result
        );


        return result;

    },


    /*
    --------------------------------------------------------
    OUVIR SINCRONIZAÇÃO DE PRESENCE
    --------------------------------------------------------
    */

    onPresenceChange(
        channel,
        callback
    ) {

        if (
            !channel ||
            !callback
        ) {

            console.warn(
                "[Presence] Canal ou callback inválido."
            );


            return null;

        }


        console.log(
            "[Presence] Registrando listener de presença."
        );


        const listener =
            channel.on(

                "presence",

                {
                    event: "sync"
                },

                () => {

                    const state =
                        channel.presenceState();


                    console.log(
                        "[Presence] Estado atualizado:",
                        state
                    );


                    callback(
                        state
                    );

                }

            );


        return listener;

    },


    /*
    --------------------------------------------------------
    DETECTAR ENTRADA DE PARTICIPANTE
    --------------------------------------------------------
    */

    onPresenceJoin(
        channel,
        callback
    ) {

        if (
            !channel ||
            !callback
        ) {

            console.warn(
                "[Presence] Canal ou callback inválido."
            );


            return null;

        }


        console.log(
            "[Presence] Registrando listener de entrada."
        );


        const listener =
            channel.on(

                "presence",

                {
                    event: "join"
                },

                (payload) => {

                    console.log(
                        "[Presence] Usuário entrou:",
                        payload
                    );


                    callback(
                        payload
                    );

                }

            );


        return listener;

    },


    /*
    --------------------------------------------------------
    DETECTAR SAÍDA DE PARTICIPANTE
    --------------------------------------------------------
    */

    onPresenceLeave(
        channel,
        callback
    ) {

        if (
            !channel ||
            !callback
        ) {

            console.warn(
                "[Presence] Canal ou callback inválido."
            );


            return null;

        }


        console.log(
            "[Presence] Registrando listener de saída."
        );


        const listener =
            channel.on(

                "presence",

                {
                    event: "leave"
                },

                (payload) => {

                    console.log(
                        "[Presence] Usuário saiu:",
                        payload
                    );


                    callback(
                        payload
                    );

                }

            );


        return listener;

    },


    /*
    --------------------------------------------------------
    OBTER ESTADO ATUAL DO PRESENCE
    --------------------------------------------------------
    */

    getPresenceState(
        channel
    ) {

        if (!channel) {

            return {};

        }


        return channel.presenceState();

    }

};


/*
============================================================
EXPORT
============================================================
*/

export default realtimeService;