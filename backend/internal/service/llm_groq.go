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

// ExtractedMessage adalah bentuk data yang kita PAKSA LLM untuk balikin.
type ExtractedMessage struct {
	IsTransaction bool    `json:"is_transaction"`
	Type          string  `json:"type"`
	Amount        float64 `json:"amount"`
	Category      string  `json:"category"`
	Reply         string  `json:"reply"`
}

const systemPrompt = `Kamu adalah asisten pencatat keuangan berbahasa Indonesia yang ramah dan santai.

Baca pesan user, tentukan apakah itu laporan transaksi (pemasukan/pengeluaran), lalu SELALU balas HANYA dalam format JSON persis seperti ini, tanpa teks lain di luar JSON:

{
  "is_transaction": true atau false,
  "type": "income" atau "expense" (kosongkan "" kalau is_transaction false),
  "amount": angka nominal dalam Rupiah (0 kalau is_transaction false),
  "category": kategori singkat, misal "Makanan", "Gaji", "Transportasi" (kosongkan "" kalau is_transaction false),
  "reply": balasan ramah dalam Bahasa Indonesia untuk ditampilkan ke user
}

Contoh:
User: "aku tadi beli kopi 15rb"
{"is_transaction": true, "type": "expense", "amount": 15000, "category": "Makanan & Minuman", "reply": "Oke, dicatat pengeluaran Rp15.000 untuk kopi ya. Ada lagi?"}

User: "halo"
{"is_transaction": false, "type": "", "amount": 0, "category": "", "reply": "Halo! Cerita aja pemasukan atau pengeluaran kamu, nanti aku catat."}`

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
