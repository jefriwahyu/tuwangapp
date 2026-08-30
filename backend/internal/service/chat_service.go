package service

import "tuwangapp/backend/internal/model"

func ProcessMessage(req model.ChatRequest) model.ChatResponse {

	return model.ChatResponse{
		Reply: "Kamu bilang: " + req.Message,
	}
}
