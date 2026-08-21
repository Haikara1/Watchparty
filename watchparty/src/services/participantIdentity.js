const PARTICIPANT_ID_KEY = "watchparty_participant_id";
const USERNAME_KEY = "watchparty_username";

export function getOrCreateParticipantId() {
    const storedId = localStorage.getItem(PARTICIPANT_ID_KEY)?.trim();

    if (storedId) {
        return storedId;
    }

    const participantId = crypto.randomUUID();
    localStorage.setItem(PARTICIPANT_ID_KEY, participantId);
    return participantId;
}

export function normalizeUsername(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
}

export function getSavedUsername() {
    const username = normalizeUsername(localStorage.getItem(USERNAME_KEY));
    return username.length >= 2 && username.length <= 24 ? username : "";
}

export function validateUsername(value) {
    const username = normalizeUsername(value);

    if (username.length < 2) {
        return "Digite um nome com pelo menos 2 caracteres.";
    }

    if (username.length > 24) {
        return "Digite um nome com no máximo 24 caracteres.";
    }

    return "";
}

export function saveUsername(value) {
    const username = normalizeUsername(value);
    localStorage.setItem(USERNAME_KEY, username);
    return username;
}
