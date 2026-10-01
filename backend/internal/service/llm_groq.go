package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type groqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqResponseFormat struct {
	Type string `json:"type"`
}

type groqRequest struct {
	Model          string              `json:"model"`
	Messages       []groqMessage       `json:"messages"`
	ResponseFormat *groqResponseFormat `json:"response_format,omitempty"`
}

type groqResponse struct {
	Choices []struct {
		Message groqMessage `json:"message"`
	} `json:"choices"`
}

// TransactionItem adalah satu transaksi dalam pesan user.
// Satu pesan boleh berisi 1–5 item (misal "kopi 10k, makanan 30k").
type TransactionItem struct {
	Type        string  `json:"type"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
}

// ExtractedMessage adalah bentuk data yang kita PAKSA LLM untuk balikin.
type ExtractedMessage struct {
	Intent string `json:"intent"`
	// IsTransaction bool    `json:"is_transaction"`
	// Field tunggal di bawah ini LEGACY (sebelum multi-transaksi).
	// LLM baru tidak perlu mengisinya; backend memakainya hanya sebagai
	// fallback kalau "transactions" kosong (misal respons model lama).
	Type        string            `json:"type"`
	Amount      float64           `json:"amount"`
	Category    string            `json:"category"`
	Description string            `json:"description"`
	// Transactions adalah daftar transaksi untuk intent "transaction".
	// Maksimal 5 — backend memotong sisanya dan menolak yang invalid.
	Transactions []TransactionItem `json:"transactions"`
	Period       string            `json:"period"`
	Target       string            `json:"target"`
	Reply        string            `json:"reply"`
}

const systemPrompt = `Kamu adalah asisten pencatat keuangan berbahasa Indonesia yang ramah dan santai.

Baca pesan user, tentukan apakah itu laporan transaksi (pemasukan/pengeluaran), lalu SELALU balas HANYA dalam format JSON persis seperti ini, tanpa teks lain di luar JSON:

{
  "intent": "transaction" atau "query_report" atau "delete_transaction" atau "chitchat",
  "transactions": daftar transaksi — isi HANYA kalau intent "transaction" (maksimal 5 item; kosongkan [] selain itu). Tiap item = {"type": "income" atau "expense", "amount": angka Rupiah wajib > 0, "category": ..., "description": ...},
  "category": WAJIB salah satu dari: "Gaji", "Bonus", "Usaha", "Hadiah", "Makanan & Minuman", "Transportasi", "Belanja", "Tempat Tinggal", "Kesehatan", "Hiburan", "Pendidikan", "Lainnya" (jangan buat kategori baru; kalau ragu pakai "Lainnya"),
  "description": nama barang/keterangan singkat apa adanya dari ucapan user, misal "sepatu nike" atau "kopi susu" (maksimal 5 kata; kosongkan "" kalau tidak ada),
  "period": "today" atau "yesterday" atau "week" atau "month" atau "year" (kosongkan "" kalau bukan query_report),
  "target": kata kunci pencarian transaksi, misal "kopi" atau "kopi 20rb" (isi HANYA kalau intent "delete_transaction", selain itu ""),
  "reply": balasan ramah dalam Bahasa Indonesia untuk ditampilkan ke user (untuk transaction, sebut SEMUA item yang dicatat)
}

Aturan transaction: pecah satu pesan menjadi beberapa item bila user menyebut beberapa barang/nominal (contoh: "kopi 10k, makanan 30k" = 2 item). Maksimal 5 item — kalau lebih, ambil 5 pertama. Buat item HANYA kalau nominalnya jelas angkanya; kalau tidak ada nominal jelas, jangan karang — pakai chitchat untuk tanya nominalnya.

Aturan intent delete_transaction: pakai HANYA kalau user jelas ingin menghapus, membatalkan, atau mengoreksi catatan ("hapus", "batalkan", "buang", "yang tadi salah"). Jangan pakai untuk laporan transaksi baru. Target berisi kata kunci bebas (nama barang/kategori/nominal), backend yang akan mencocokkan.

Contoh:
User: "aku tadi beli kopi 15rb"
{"intent": "transaction", "transactions": [{"type": "expense", "amount": 15000, "category": "Makanan & Minuman", "description": "kopi"}], "category": "", "description": "", "period": "", "target": "", "reply": "Oke, dicatat pengeluaran Rp15.000 untuk kopi ya. Ada lagi?"}

User: "tadi aku beli sepatu nike 200k"
{"intent": "transaction", "transactions": [{"type": "expense", "amount": 200000, "category": "Belanja", "description": "sepatu nike"}], "category": "", "description": "", "period": "", "target": "", "reply": "Oke, dicatat pengeluaran Rp200.000 untuk sepatu nike ya. Ada lagi?"}

User: "saya membeli kopi 10k, makanan 30k"
{"intent": "transaction", "transactions": [{"type": "expense", "amount": 10000, "category": "Makanan & Minuman", "description": "kopi"}, {"type": "expense", "amount": 30000, "category": "Makanan & Minuman", "description": "makanan"}], "category": "", "description": "", "period": "", "target": "", "reply": "Oke, tercatat 2 transaksi: kopi Rp10.000 dan makanan Rp30.000. Ada lagi?"}

User: "coba lihat pemasukan bulan ini dong"
{"intent": "query_report", "type": "", "amount": 0, "category": "", "description": "", "period": "month", "target": "", "reply": ""}

User: "coba lihat pengeluaran kemarin"
{"intent": "query_report", "type": "", "amount": 0, "category": "", "description": "", "period": "yesterday", "target": "", "reply": ""}

User: "hapus kopi yang tadi"
{"intent": "delete_transaction", "type": "", "amount": 0, "category": "", "description": "", "period": "", "target": "kopi", "reply": ""}

User: "eh yang gaji 5 juta tadi salah, hapus aja"
{"intent": "delete_transaction", "type": "", "amount": 0, "category": "", "description": "", "period": "", "target": "gaji 5 juta", "reply": ""}

User: "halo"
{"intent": "chitchat", "type": "", "amount": 0, "category": "", "description": "", "period": "", "target": "", "reply": "Halo! Cerita aja pemasukan atau pengeluaran kamu, nanti aku catat."}`

func ExtractTransaction(userMessage string) (ExtractedMessage, error) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return ExtractedMessage{}, fmt.Errorf("GROQ_API_KEY belum di-set")
	}

	reqBody := groqRequest{
		Model: "openai/gpt-oss-20b",
		Messages: []groqMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userMessage},
		},
		ResponseFormat: &groqResponseFormat{Type: "json_object"},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return ExtractedMessage{}, err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return ExtractedMessage{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return ExtractedMessage{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ExtractedMessage{}, fmt.Errorf("groq API error: status %d", resp.StatusCode)
	}

	var groqResp groqResponse
	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
		return ExtractedMessage{}, err
	}
	if len(groqResp.Choices) == 0 {
		return ExtractedMessage{}, fmt.Errorf("groq API tidak mengembalikan jawaban")
	}

	var extracted ExtractedMessage
	rawContent := groqResp.Choices[0].Message.Content
	if err := json.Unmarshal([]byte(rawContent), &extracted); err != nil {
		return ExtractedMessage{}, fmt.Errorf("gagal parsing JSON dari LLM: %w", err)
	}

	return extracted, nil
}
