import { supabase } from './lib/supabaseClient';

const BASE_URL = 'http://localhost:8080/api/v1';

async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function sendMessage(text) {
    const res = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(await authHeader())
        },
        body: JSON.stringify({ message:text }),
    });

    if (!res.ok) {
        throw new Error('Gagal menghubungi server');
    }

    return res.json();
}

export async function getSummary(period = 'month') {
    const res = await fetch(`${BASE_URL}/summary?period=${period}`, {
        headers: await authHeader(),
    });
    if (!res.ok) {
        throw new Error('Gagal memuat ringkasan');
    }
    return res.json();
}

export { authHeader };
