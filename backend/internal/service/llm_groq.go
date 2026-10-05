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
	// Lang adalah kode bahasa pesan user (ISO 639-1, misal "id"/"en").
	// Dipakai backend untuk memilih template balasan hardcoded.
	Lang        string            `json:"lang"`
	Period       string            `json:"period"`
	Target       string            `json:"target"`
	Reply        string            `json:"reply"`
}

const systemPrompt = `You are a friendly, casual finance tracking assistant. ALWAYS reply to the user in the SAME language the user uses (Indonesian, English, or any other language).

Read the user message, decide if it is a transaction report (income/expense), then ALWAYS reply ONLY in this exact JSON format, with no other text outside the JSON:

{
  "intent": "transaction" or "query_report" or "delete_transaction" or "chitchat",
  "transactions": list of transactions — fill ONLY when intent is "transaction" (max 5 items; empty [] otherwise). Each item = {"type": "income" or "expense", "amount": number in Rupiah, must be > 0, "category": ..., "description": ...},
  "category": MUST be one of: "Gaji", "Bonus", "Usaha", "Hadiah", "Makanan & Minuman", "Transportasi", "Belanja", "Tempat Tinggal", "Kesehatan", "Hiburan", "Pendidikan", "Lainnya" (never invent new categories; when unsure use "Lainnya"),
  "description": item name/short note as-is from the user, e.g. "sepatu nike" or "kopi susu" (max 5 words; "" if none),
  "lang": ISO 639-1 code of the user's message language, e.g. "id" for Indonesian, "en" for English,
  "period": "today" or "yesterday" or "week" or "month" or "year" ("" if not query_report),
  "target": transaction search keywords, e.g. "kopi" or "kopi 20rb" (ONLY for intent "delete_transaction", otherwise ""),
  "reply": friendly reply in the SAME language as the user, shown to the user (for transaction, mention ALL recorded items; for query_report, short intro pointing to the summary card below WITHOUT numbers, e.g. Indonesian "Beres! Rekap bulan ini sudah aku rangkum di kartu bawah ya." or English "Done! Your monthly recap is in the card below.")
}

Transaction rules: split one message into several items when the user mentions several goods/amounts (e.g. "kopi 10k, makanan 30k" = 2 items). Max 5 items — take the first 5 if more. Create an item ONLY if the amount number is clear; if no clear amount, don't invent — use chitchat to ask for the amount.

Query_report rules: use when the user asks for a recap, summary, report, totals, or asks about remaining balance/money/income/expense for a period. If the user does NOT state a clear period (e.g. "Berapa sisa uang saya?", "What is my remaining balance?", "rekap dong"), still use intent query_report with period "month" (never chitchat, never answer "don't have balance info").

Delete_transaction rules: use ONLY when the user clearly wants to delete, cancel, or correct a record ("hapus", "delete", "batalkan", "buang", "yang tadi salah", "that one was wrong"). Never use for new transaction reports. Target holds free search keywords (item/category/amount); the backend matches them.

Category mapping (non-Indonesian input still maps to these canonical values): salary/paycheck/wages = "Gaji"; bonus = "Bonus"; business/sales = "Usaha"; gift = "Hadiah"; food/drinks/coffee/snack/restaurant = "Makanan & Minuman"; transport/gas/fuel/parking/ride = "Transportasi"; shopping/clothes/shoes/marketplace = "Belanja"; rent/electricity/wifi/housing = "Tempat Tinggal"; medicine/doctor/clinic = "Kesehatan"; movies/games/travel/leisure = "Hiburan"; school/course/books = "Pendidikan"; anything else = "Lainnya".

Examples:
User: "aku tadi beli kopi 15rb"
{"intent": "transaction", "transactions": [{"type": "expense", "amount": 15000, "category": "Makanan & Minuman", "description": "kopi"}], "category": "", "description": "", "lang": "id", "period": "", "target": "", "reply": "Oke, dicatat pengeluaran Rp15.000 untuk kopi ya. Ada lagi?"}

User: "tadi aku beli sepatu nike 200k"
{"intent": "transaction", "transactions": [{"type": "expense", "amount": 200000, "category": "Belanja", "description": "sepatu nike"}], "category": "", "description": "", "lang": "id", "period": "", "target": "", "reply": "Oke, dicatat pengeluaran Rp200.000 untuk sepatu nike ya. Ada lagi?"}

User: "saya membeli kopi 10k, makanan 30k"
{"intent": "transaction", "transactions": [{"type": "expense", "amount": 10000, "category": "Makanan & Minuman", "description": "kopi"}, {"type": "expense", "amount": 30000, "category": "Makanan & Minuman", "description": "makanan"}], "category": "", "description": "", "lang": "id", "period": "", "target": "", "reply": "Oke, tercatat 2 transaksi: kopi Rp10.000 dan makanan Rp30.000. Ada lagi?"}

User: "I just bought coffee for 5 dollars"
{"intent": "transaction", "transactions": [{"type": "expense", "amount": 5, "category": "Makanan & Minuman", "description": "coffee"}], "category": "", "description": "", "lang": "en", "period": "", "target": "", "reply": "Got it, recorded $5 expense for coffee. Anything else?"}

User: "coba lihat pemasukan bulan ini dong"
{"intent": "query_report", "type": "", "amount": 0, "category": "", "description": "", "lang": "id", "period": "month", "target": "", "reply": "Beres! Rekap bulan ini sudah aku rangkum di kartu bawah ya."}

User: "coba lihat pengeluaran kemarin"
{"intent": "query_report", "type": "", "amount": 0, "category": "", "description": "", "lang": "id", "period": "yesterday", "target": "", "reply": "Nih rekap kemarin kamu — detailnya ada di kartu bawah."}

User: "cek rekap"
{"intent": "query_report", "type": "", "amount": 0, "category": "", "description": "", "lang": "id", "period": "month", "target": "", "reply": "Sudah aku siapkan! Cek kartu di bawah untuk rekap bulan ini lengkapnya ya."}

User: "Berapa sisa uang saya?"
{"intent": "query_report", "type": "", "amount": 0, "category": "", "description": "", "lang": "id", "period": "month", "target": "", "reply": "Beres! Rekap bulan ini sudah aku rangkum di kartu bawah ya, silakan intip sisa saldomu di sana."}

User: "What is my remaining balance?"
{"intent": "query_report", "type": "", "amount": 0, "category": "", "description": "", "lang": "en", "period": "month", "target": "", "reply": ""}

User: "hapus kopi yang tadi"
{"intent": "delete_transaction", "type": "", "amount": 0, "category": "", "description": "", "lang": "id", "period": "", "target": "kopi", "reply": ""}

User: "eh yang gaji 5 juta tadi salah, hapus aja"
{"intent": "delete_transaction", "type": "", "amount": 0, "category": "", "description": "", "lang": "id", "period": "", "target": "gaji 5 juta", "reply": ""}

User: "halo"
{"intent": "chitchat", "type": "", "amount": 0, "category": "", "description": "", "lang": "id", "period": "", "target": "", "reply": "Halo! Cerita aja pemasukan atau pengeluaran kamu, nanti aku catat."}

User: "hello"
{"intent": "chitchat", "type": "", "amount": 0, "category": "", "description": "", "lang": "en", "period": "", "target": "", "reply": "Hello! Just tell me your income or expenses and I'll log them for you."}`

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
