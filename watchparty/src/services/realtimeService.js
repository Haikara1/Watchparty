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


export const supabase =
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
CONFIGURAÇÕES DO REALTIME
============================================================
*/

const RECONNECT_INITIAL_DELAY = 2000;

const RECONNECT_MAX_DELAY = 10000;


/*
============================================================
CONTROLE INTERNO DOS CANAIS
============================================================
*/

/*
    WeakMap evita manter referências de canais
    que já foram destruídos.
*/

const channelControllers =
    new WeakMap();


let anonymousSessionPromise =
    null;


/*
============================================================
CRIAR CONTROLADOR INTERNO
============================================================
*/

function getChannelController(channel) {

    if (!channel) {

        return null;

    }


    let controller =
        channelControllers.get(channel);


    if (!controller) {

        controller = {

            isActive: true,

            isConnected: false,

            isConnecting: false,

            reconnectTimer: null,

            reconnectAttempts: 0,
            connectPromise: null,

            statusListeners: new Set()

        };


        channelControllers.set(
            channel,
            controller
        );

    }


    return controller;

}

function notifyConnectionStatus(controller, status) {
    controller?.statusListeners?.forEach(listener => {
        try {
            listener(status);
        } catch (error) {
            console.warn("[Realtime] Listener de status falhou:", error);
        }
    });
}


/*
============================================================
LIMPAR TIMER DE RECONEXÃO
============================================================
*/

function clearReconnectTimer(
    controller
) {

    if (
        !controller ||
        !controller.reconnectTimer
    ) {

        return;

    }


    clearTimeout(
        controller.reconnectTimer
    );


    controller.reconnectTimer =
        null;

}


/*
============================================================
CALCULAR DELAY DE RECONEXÃO
============================================================
*/

function getReconnectDelay(
    controller
) {

    if (!controller) {

        return RECONNECT_INITIAL_DELAY;

    }


    const delay =
        RECONNECT_INITIAL_DELAY *
        Math.pow(
            2,
            controller.reconnectAttempts
        );


    return Math.min(
        delay,
        RECONNECT_MAX_DELAY
    );

}


/*
============================================================
AGENDAR RECONEXÃO
============================================================
*/

function scheduleReconnect(
    channel
) {

    const controller =
        getChannelController(
            channel
        );


    if (!controller) {

        return;

    }


    if (
        !controller.isActive
    ) {

        return;

    }


    if (
        controller.isConnected
    ) {

        return;

    }


    if (
        controller.reconnectTimer
    ) {

        return;

    }


    const delay =
        getReconnectDelay(
            controller
        );


    controller.reconnectAttempts += 1;


    console.warn(
        `[Realtime] Reconexão agendada em ${delay}ms. Tentativa ${controller.reconnectAttempts}.`
    );


    controller.reconnectTimer =
        setTimeout(
            async () => {

                controller.reconnectTimer =
                    null;


                if (
                    !controller.isActive
                ) {

                    return;

                }


                console.log(
                    "[Realtime] Tentando reconectar canal..."
                );


                try {

                    await subscribeChannel(
                        channel,
                        controller
                    );


                    console.log(
                        "[Realtime] Reconexão concluída com sucesso."
                    );

                } catch (error) {

                    console.error(
                        "[Realtime] Falha na reconexão:",
                        error
                    );


                    scheduleReconnect(
                        channel
                    );

                }

            },
            delay
        );

}


/*
============================================================
SUBSCREVER CANAL
============================================================
*/

function subscribeChannel(
    channel,
    controller
) {

    if (!channel) {

        return Promise.reject(
            new Error(
                "Canal Supabase é obrigatório."
            )
        );

    }


    if (!controller) {

        return Promise.reject(
            new Error(
                "Controlador do canal não encontrado."
            )
        );

    }


    if (
        !controller.isActive
    ) {

        return Promise.reject(
            new Error(
                "Canal não está ativo."
            )
        );

    }


    if (
        channel.state === "joined"
        &&
        controller.isConnected
    ) {

        return Promise.resolve(
            channel
        );

    }


    if (
        controller.isConnecting &&
        controller.connectPromise
    ) {

        return controller.connectPromise;

    }


    controller.isConnecting =
        true;


    controller.connectPromise =
        new Promise(
            (resolve, reject) => {

                let settled =
                    false;


                const finishSuccess =
                    () => {

                        if (
                            settled
                        ) {

                            return;

                        }


                        settled =
                            true;


                        controller.isConnected =
                            true;


                        controller.isConnecting =
                            false;


                        controller.reconnectAttempts =
                            0;


                        clearReconnectTimer(
                            controller
                        );


                        console.log(
                            "[Realtime] Canal inscrito com sucesso."
                        );


                        resolve(
                            channel
                        );

                    };


                const finishError =
                    (error) => {

                        if (
                            settled
                        ) {

                            return;

                        }


                        settled =
                            true;


                        controller.isConnected =
                            false;


                        controller.isConnecting =
                            false;


                        reject(
                            error
                        );

                    };


                try {

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
                            ==================================
                            CONECTADO
                            ==================================
                            */

                            if (
                                status ===
                                "SUBSCRIBED"
                            ) {

                                notifyConnectionStatus(controller, "connected");

                                finishSuccess();

                                return;

                            }


                            /*
                            ==================================
                            ERRO DO CANAL
                            ==================================
                            */

                            if (
                                status ===
                                "CHANNEL_ERROR"
                            ) {

                                notifyConnectionStatus(controller, "reconnecting");

                                controller.isConnected =
                                    false;


                                console.error(
                                    "[Realtime] Falha no canal: CHANNEL_ERROR"
                                );


                                finishError(
                                    new Error(
                                        "Falha no Realtime: CHANNEL_ERROR"
                                    )
                                );


                                scheduleReconnect(
                                    channel
                                );


                                return;

                            }


                            /*
                            ==================================
                            TIMEOUT
                            ==================================
                            */

                            if (
                                status ===
                                "TIMED_OUT"
                            ) {

                                notifyConnectionStatus(controller, "reconnecting");

                                controller.isConnected =
                                    false;


                                console.error(
                                    "[Realtime] Falha no canal: TIMED_OUT"
                                );


                                finishError(
                                    new Error(
                                        "Falha no Realtime: TIMED_OUT"
                                    )
                                );


                                scheduleReconnect(
                                    channel
                                );


                                return;

                            }


                            /*
                            ==================================
                            CANAL FECHADO
                            ==================================
                            */

                            if (
                                status ===
                                "CLOSED"
                            ) {

                                notifyConnectionStatus(controller, "reconnecting");

                                controller.isConnected =
                                    false;


                                console.log(
                                    "[Realtime] Canal fechado."
                                );


                                /*
                                    CLOSED durante cleanup
                                    não deve gerar reconexão.
                                */

                                if (
                                    controller.isActive
                                ) {

                                    scheduleReconnect(
                                        channel
                                    );

                                }

                            }

                        }
                    );

                } catch (error) {

                    finishError(
                        error
                    );


                    scheduleReconnect(
                        channel
                    );

                }

            }
        );


    /*
    ========================================================
    FINALIZAR PROMISE INTERNA
    ========================================================
    */

    controller.connectPromise
        .finally(
            () => {

                controller.connectPromise =
                    null;

            }
        );


    return controller.connectPromise;

}


/*
============================================================
REALTIME SERVICE
============================================================
*/

const realtimeService = {

    /*
    ========================================================
    SESSÃO ANÔNIMA
    ========================================================
    */

    ensureAnonymousSession() {

        if (anonymousSessionPromise) {

            return anonymousSessionPromise;

        }


        anonymousSessionPromise =
            (async () => {

                const {
                    data,
                    error
                } = await supabase.auth.getSession();


                if (error) {

                    throw error;

                }


                if (
                    data.session?.user &&
                    data.session.user.is_anonymous === true
                ) {

                    console.log(
                        "[Auth] Usuário anônimo:",
                        {
                            id: data.session.user.id,
                            is_anonymous:
                                data.session.user.is_anonymous,
                            role: data.session.user.role,
                            aud: data.session.user.aud,
                            provider:
                                data.session.user.app_metadata?.provider
                        }
                    );


                    console.log(
                        "[Auth] Supabase URL:",
                        supabaseUrl
                    );

                    console.log(
                        "[Auth] Sessão anônima existente encontrada."
                    );


                    return data.session;

                }


                if (data.session) {

                    console.log(
                        "[Auth] Sessão existente não é anônima."
                    );

                }


                console.log(
                    "[Auth] Nenhuma sessão válida. Criando sessão anônima..."
                );


                const {
                    data: signInData,
                    error: signInError
                } = await supabase.auth.signInAnonymously();


                if (signInError) {

                    throw signInError;

                }


                if (
                    !signInData.session ||
                    !signInData.user ||
                    signInData.user.is_anonymous !== true
                ) {

                    throw new Error(
                        "O Supabase não retornou um usuário anônimo."
                    );

                }


                console.log(
                    "[Auth] Sessão anônima criada com sucesso."
                );


                return signInData.session;

            })()

                .catch((error) => {

                    console.error(
                        "[Auth] Erro ao criar sessão anônima."
                    );

                    anonymousSessionPromise =
                        null;


                    throw error;

                });


        return anonymousSessionPromise;

    },


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


        /*
        ====================================================
        CRIAR CONTROLADOR DO CANAL
        ====================================================
        */

        getChannelController(
            channel
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


        const controller =
            getChannelController(
                channel
            );


        controller.isActive =
            true;


        /*
        ====================================================
        EVITAR CONEXÃO DUPLICADA
        ====================================================
        */

        if (
            controller.isConnected
            &&
            channel.state === "joined"
        ) {

            console.log(
                "[Realtime] Canal já está conectado."
            );


            return channel;

        }


        console.log(
            "[Realtime] Conectando canal..."
        );


        try {

            return await subscribeChannel(
                channel,
                controller
            );

        } catch (error) {

            console.error(
                "[Realtime] Erro na conexão inicial:",
                error
            );


            throw error;

        }

    },


    /*
    ========================================================
    VERIFICAR SE CANAL ESTÁ DISPONÍVEL
    ========================================================
    */

    isChannelReady(channel) {

        if (!channel) {

            return false;

        }


        const controller =
            getChannelController(
                channel
            );


        return Boolean(
            controller?.isConnected
            &&
            channel.state === "joined"
        );

    },

    onConnectionStatus(channel, callback) {
        const controller = getChannelController(channel);
        if (!controller || typeof callback !== "function") {
            return () => {};
        }

        controller.statusListeners.add(callback);
        return () => controller.statusListeners.delete(callback);
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


        const controller =
            getChannelController(
                channel
            );


        console.log(
            "[Realtime] Desconectando canal."
        );


        /*
        ====================================================
        IMPEDIR NOVAS RECONEXÕES
        ====================================================
        */

        controller.isActive =
            false;


        controller.isConnected =
            false;


        controller.isConnecting =
            false;


        clearReconnectTimer(
            controller
        );


        controller.connectPromise =
            null;


        /*
        ====================================================
        REMOVER CANAL DO SUPABASE
        ====================================================
        */

        try {

            await supabase.removeChannel(
                channel
            );

        } catch (error) {

            console.error(
                "[Realtime] Erro ao desconectar canal:",
                error
            );

        }


        console.log(
            "[Realtime] Canal desconectado."
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


        if (
            !this.isChannelReady(
                channel
            )
        ) {

            console.warn(
                "[Realtime] Canal não está conectado. Playback não enviado."
            );


            return null;

        }


        console.log(
            "[Realtime] Enviando evento:",
            event
        );


        try {

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

        } catch (error) {

            console.error(
                "[Realtime] Erro ao enviar evento:",
                error
            );


            return null;

        }

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


        if (
            !this.isChannelReady(
                channel
            )
        ) {

            console.warn(
                "[Realtime] Canal não está conectado. Mensagem não enviada."
            );


            return null;

        }


        console.log(
            "[Realtime] Enviando mensagem:",
            message
        );


        try {

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

        } catch (error) {

            console.error(
                "[Realtime] Erro ao enviar mensagem:",
                error
            );


            return null;

        }

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


        if (
            !this.isChannelReady(
                channel
            )
        ) {

            console.warn(
                "[Presence] Canal não está conectado."
            );


            return null;

        }


        console.log(
            "[Presence] Registrando usuário:",
            user
        );


        try {

            const result =
                await channel.track(
                    user
                );


            console.log(
                "[Presence] Usuário registrado:",
                result
            );


            return result;

        } catch (error) {

            console.error(
                "[Presence] Erro ao registrar usuário:",
                error
            );


            throw error;

        }

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
