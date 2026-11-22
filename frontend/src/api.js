import { supabase } from './lib/supabaseClient';

// Di Vercel, set VITE_API_URL ke URL backend Vercel + /api/v1,
// contoh: https://tuwangapp-api.vercel.app/api/v1
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1').replace(/\/+$/, '');

async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function sendMessage(text, period = '') {
    const res = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(await authHeader())
        },
        body: JSON.stringify({ message: text, period }),
    });

    if (!res.ok) {
        throw new Error('Gagal menghubungi server');
    }

    return res.json();
}

export async function getSummary(period = 'month', range = null) {
    const params = new URLSearchParams();
    if (range?.from && range?.to) {
        params.set('from', range.from);
        params.set('to', range.to);
    } else {
        params.set('period', period);
    }
    const res = await fetch(`${BASE_URL}/summary?${params.toString()}`, {
        headers: await authHeader(),
    });
    if (!res.ok) {
        throw new Error('Gagal memuat ringkasan');
    }
    return res.json();
}

export async function getTrend(period = 'month', range = null) {
    const params = new URLSearchParams();
    if (range?.from && range?.to) {
        params.set('from', range.from);
        params.set('to', range.to);
    } else {
        params.set('period', period);
    }
    const res = await fetch(`${BASE_URL}/trend?${params.toString()}`, {
        headers: await authHeader(),
    });
    if (!res.ok) {
        throw new Error('Gagal memuat tren');
    }
    return res.json();
}

export async function getTransactions({ from = '', to = '', period = '', limit = 10, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (!from && !to && period) params.set('period', period);
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
