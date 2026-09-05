package service

import (
	"fmt"
	"log"
	"tuwangapp/backend/internal/model"
	"tuwangapp/backend/internal/repository"
)

func ProcessMessage(req model.ChatRequest) model.ChatResponse {

	extracted, err := ExtractTransaction(req.Message)
	if err != nil {
		log.Println("Groq error:", err)
		return model.ChatResponse{Reply: "Maaf, ada masalah waktu menghubungi AI"}
	}

	switch extracted.Intent {
	case "transaction":
		if err := repository.SaveTransaction(extracted.Type, extracted.Amount, extracted.Category); err != nil {
			log.Println("Gagal simpan transaksi:", err)
			return model.ChatResponse{Reply: "Waduh, aku ngerti maksud kamu, tapi gagal nyimpen ke database."}
		}
		return model.ChatResponse{Reply: extracted.Reply}

	case "query_report":
		income, expense, err := repository.GetSummary(extracted.Period)
		if err != nil {
			log.Println("Gagal ambil rekap:", err)
			return model.ChatResponse{Reply: "Waduh, gagal ambil data rekap."}
		}
		reply := fmt.Sprintf(
			"Rekap %s:\nPemasukan: Rp%.0f\nPengeluaran: Rp%.0f",
			periodLabel(extracted.Period), income, expense,
		)
		return model.ChatResponse{Reply: reply, Period: extracted.Period}

	default: // chitchat
		return model.ChatResponse{Reply: extracted.Reply}
	}
}

func periodLabel(period string) string {
	switch period {
	case "yesterday":
		return "kemarin"
	case "month":
		return "bulan ini"
	case "year":
		return "tahun ini"
	default:
		return "hari ini"
	}
}
