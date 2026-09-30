package model

type ChatRequest struct {
	Message string `json:"message" binding:"required"`
}

type ChatResponse struct {
	Reply      string            `json:"reply"`
	Period     string            `json:"period,omitempty"`
	Action     string            `json:"action,omitempty"`
	Candidates []DeleteCandidate `json:"candidates,omitempty"`
}

// DeleteCandidate adalah satu transaksi kandidat hapus yang
// ditampilkan sebagai tombol konfirmasi di chat.
type DeleteCandidate struct {
	ID          any     `json:"id"`
	Type        string  `json:"type"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	CreatedAt   string  `json:"created_at"`
	Label       string  `json:"label"`
}
