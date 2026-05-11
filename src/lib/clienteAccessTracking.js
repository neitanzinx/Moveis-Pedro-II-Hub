import { supabase } from "@/lib/supabase";

const SESSION_STORAGE_KEY = "cliente_portal_access_session";
const EVENT_DEDUPE_STORAGE_KEY = "cliente_portal_event_dedupe";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function safeParse(jsonValue, fallback) {
    try {
        return jsonValue ? JSON.parse(jsonValue) : fallback;
    } catch {
        return fallback;
    }
}

function getDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|ipod/.test(ua)) return "mobile";
    return "desktop";
}

function getStoredSession() {
    return safeParse(localStorage.getItem(SESSION_STORAGE_KEY), null);
}

function setStoredSession(sessionData) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
}

function getEventDedupeMap() {
    return safeParse(sessionStorage.getItem(EVENT_DEDUPE_STORAGE_KEY), {});
}

function setEventDedupeMap(map) {
    sessionStorage.setItem(EVENT_DEDUPE_STORAGE_KEY, JSON.stringify(map));
}

export async function ensureClientPortalSession({ authUserId, clienteId, pagePath }) {
    if (!authUserId) return null;

    const now = Date.now();
    const stored = getStoredSession();

    if (stored?.authUserId === authUserId && stored?.sessionId && stored?.sessionToken) {
        const inactiveFor = now - (stored.lastSeenAt || 0);

        if (inactiveFor <= SESSION_TIMEOUT_MS) {
            await supabase
                .from("cliente_sessoes_portal")
                .update({
                    session_last_seen_at: new Date().toISOString(),
                    cliente_id: clienteId || null,
                    metadata: {
                        source: "portal_cliente",
                        resumed_session: true,
                    },
                })
                .eq("id", stored.sessionId)
                .eq("auth_user_id", authUserId);

            const updated = { ...stored, lastSeenAt: now };
            setStoredSession(updated);
            return updated;
        }
    }

    const sessionToken = `${authUserId}-${now}-${Math.random().toString(36).slice(2, 10)}`;
    const payload = {
        auth_user_id: authUserId,
        cliente_id: clienteId || null,
        session_token: sessionToken,
        started_from: pagePath || "/area-cliente",
        device_type: getDeviceType(),
        user_agent: navigator.userAgent,
        metadata: {
            source: "portal_cliente",
            resumed_session: false,
        },
    };

    const { data, error } = await supabase
        .from("cliente_sessoes_portal")
        .insert(payload)
        .select("id")
        .single();

    if (error) {
        console.error("Erro ao criar sessao de acesso do cliente:", error);
        return null;
    }

    const created = {
        sessionId: data.id,
        sessionToken,
        authUserId,
        clienteId: clienteId || null,
        lastSeenAt: now,
    };

    setStoredSession(created);
    return created;
}

export async function markClientSessionAlive(sessionId, authUserId, clienteId) {
    if (!sessionId || !authUserId) return;

    const { error } = await supabase
        .from("cliente_sessoes_portal")
        .update({
            session_last_seen_at: new Date().toISOString(),
            cliente_id: clienteId || null,
            metadata: {
                source: "portal_cliente",
                heartbeat: true,
            },
        })
        .eq("id", sessionId)
        .eq("auth_user_id", authUserId);

    if (error) {
        console.error("Erro ao atualizar heartbeat da sessao do cliente:", error);
        return;
    }

    const stored = getStoredSession();
    if (stored?.sessionId === sessionId) {
        setStoredSession({ ...stored, lastSeenAt: Date.now(), clienteId: clienteId || null });
    }
}

export async function trackClientAccessEvent({
    sessionId,
    authUserId,
    clienteId,
    eventName,
    eventCategory,
    pagePath,
    metadata = {},
    dedupeKey,
    dedupeWindowMs = 4000,
}) {
    if (!sessionId || !authUserId || !eventName || !eventCategory) return;

    if (dedupeKey) {
        const map = getEventDedupeMap();
        const now = Date.now();
        const lastEventTs = map[dedupeKey] || 0;

        if (now - lastEventTs < dedupeWindowMs) return;

        map[dedupeKey] = now;
        setEventDedupeMap(map);
    }

    const { error } = await supabase
        .from("cliente_acesso_eventos")
        .insert({
            sessao_id: sessionId,
            auth_user_id: authUserId,
            cliente_id: clienteId || null,
            event_name: eventName,
            event_category: eventCategory,
            page_path: pagePath || null,
            metadata,
        });

    if (error) {
        console.error("Erro ao registrar evento de acesso do cliente:", error);
    }
}
