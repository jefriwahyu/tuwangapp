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

export async function getTransactions({ from = '', to = '', limit = 10, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const res = await fetch(`${BASE_URL}/transactions?${params.toString()}`, {
        headers: await authHeader(),
    });
    if (!res.ok) {
        throw new Error('Gagal memuat riwayat');
    }
    return res.json();
}

export async function deleteTransaction(id) {
    const res = await fetch(`${BASE_URL}/transactions/${id}`, {
        method: 'DELETE',
        headers: await authHeader(),
    });
    if (res.status === 404) {
        throw new Error('Transaksi tidak ditemukan');
    }
    if (!res.ok) {
        throw new Error('Gagal menghapus transaksi');
    }
    return res.json();
}

export { authHeader };
