package service

import (
	"log"
	"tuwangapp/backend/internal/model"
)

func ProcessMessage(req model.ChatRequest) model.ChatResponse {

	extracted, err := ExtractTransaction(req.Message)
	if err != nil {
		log.Println("Groq error:", err)
		return model.ChatResponse{Reply: "Maaf, ada masalah waktu menghubungi AI"}
	}
	if extracted.IsTransaction {
		// TODO: simpan ke database — ini langkah berikutnya
		log.Printf("Transaksi terdeteksi: %s Rp%.0f (%s)\n", extracted.Type, extracted.Amount, extracted.Category)
	}
	return model.ChatResponse{Reply: extracted.Reply}
}
