package service

import (
	"log"
	"tuwangapp/backend/internal/model"
)

func ProcessMessage(req model.ChatRequest) model.ChatResponse {

	reply, err := CallGroq(req.Message)
	if err != nil {
		log.Println("Groq error:", err)
		return model.ChatResponse{Reply: "Maaf, ada masalah waktu menghubungi AI"}
	}
	return model.ChatResponse{Reply: reply}
}
