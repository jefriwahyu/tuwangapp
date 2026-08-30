const BASE_URL = 'http://localhost:8080/api/v1';

export async function sendMessage(text) {
    const res = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message:text }),
    });

    if (!res.ok) {
        throw new Error('Gagal menghubungi server');
    }

    return res.json();
}
