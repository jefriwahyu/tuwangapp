package model

import "tuwangapp/backend/internal/repository"

type ChatRequest struct {
	Message string `json:"message" binding:"required"`
	// Periode aktif chart di frontend — supaya ringkasan inline yang
	// dikembalikan backend cocok dengan yang sedang dilihat user.
	Period string `json:"period"`
}

// SavedTransaction adalah satu baris yang berhasil tersimpan dari pesan chat.
// Dikirim agar frontend bisa merender kartu struk persis seperti mock
// (nama + kategori + nominal + status Tersimpan) tanpa fetch ulang.
type SavedTransaction struct {
	Type        string  `json:"type"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
}

type ChatResponse struct {
	Reply      string            `json:"reply"`
	Period     string            `json:"period,omitempty"`
	Action     string            `json:"action,omitempty"`
	Candidates []DeleteCandidate `json:"candidates,omitempty"`
	// Jumlah transaksi yang berhasil tersimpan (intent transaction).
	SavedCount int `json:"saved_count,omitempty"`
	// Rincian yang tersimpan, urut sesuai pesan user (maks 5).
	Saved []SavedTransaction `json:"saved,omitempty"`
	// Ringkasan segar untuk periode aktif — frontend tempel langsung
	// ke chart tanpa fetch ulang.
	Summary *SummarySnapshot `json:"summary,omitempty"`
}

// SummarySnapshot adalah angka ringkasan satu periode, bentuknya sama
// persis dengan respons GET /summary supaya bisa dipakai ulang.
type SummarySnapshot struct {
	Period       string                          `json:"period"`
	Income       float64                         `json:"income"`
	Expense      float64                         `json:"expense"`
	IncomeCount  int                             `json:"income_count,omitempty"`
	ExpenseCount int                             `json:"expense_count,omitempty"`
	Breakdown    []repository.CategoryBreakdown `json:"breakdown,omitempty"`
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
