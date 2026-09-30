package service

import (
	"fmt"
	"log"
	"strings"
	"time"
	"tuwangapp/backend/internal/category"
	"tuwangapp/backend/internal/model"
	"tuwangapp/backend/internal/repository"
)

func ProcessMessage(userID string, req model.ChatRequest) model.ChatResponse {

	extracted, err := ExtractTransaction(req.Message)
	if err != nil {
		log.Println("Groq error:", err)
		return model.ChatResponse{Reply: "Maaf, ada masalah waktu menghubungi AI"}
	}

	switch extracted.Intent {
	case "transaction":
		cleanCategory := category.Normalize(extracted.Category)
		desc := sanitizeDescription(extracted.Description)
		if err := repository.SaveTransaction(userID, extracted.Type, extracted.Amount, cleanCategory, desc); err != nil {
			log.Println("Gagal simpan transaksi:", err)
			return model.ChatResponse{Reply: "Waduh, aku ngerti maksud kamu, tapi gagal nyimpen ke database."}
		}
		return model.ChatResponse{Reply: extracted.Reply}

	case "query_report":
		income, expense, err := repository.GetSummary(userID, extracted.Period)
		if err != nil {
			log.Println("Gagal ambil rekap:", err)
			return model.ChatResponse{Reply: "Waduh, gagal ambil data rekap."}
		}
		reply := fmt.Sprintf(
			"Rekap %s:\nPemasukan: Rp%.0f\nPengeluaran: Rp%.0f",
			periodLabel(extracted.Period), income, expense,
		)
		return model.ChatResponse{Reply: reply, Period: extracted.Period}

	case "delete_transaction":
		return handleDeleteIntent(userID, extracted.Target)

	default: // chitchat
		return model.ChatResponse{Reply: extracted.Reply}
	}
}

// sanitizeDescription merapikan teks bebas dari LLM: spasi ganda
// dibuang, maksimal 60 karakter supaya tidak jadi paragraf.
func sanitizeDescription(raw string) string {
	desc := strings.Join(strings.Fields(raw), " ")
	if len([]rune(desc)) > 60 {
		desc = string([]rune(desc)[:60])
	}
	return desc
}

// displayName memilih teks utama sebuah baris transaksi:
// description kalau ada, category untuk data lama, terakhir jenisnya.
func displayName(desc string, cat string, txType string) string {
	if desc != "" {
		return desc
	}
	if cat != "" {
		return cat
	}
	if txType == "income" {
		return "Pemasukan"
	}
	return "Pengeluaran"
}

// handleDeleteIntent mencari kandidat milik user ini saja lalu
// mengembalikan kartu konfirmasi. TIDAK menghapus langsung:
// eksekusi tetap lewat tombol yang memanggil DELETE /transactions/:id.
func handleDeleteIntent(userID string, target string) model.ChatResponse {
	target = strings.TrimSpace(target)

	// Target "yang tadi" / kosong = transaksi terbaru user ini.
	rows, err := repository.GetTransactions(userID, repository.ListFilter{Limit: 10})
	if err != nil {
		log.Println("Gagal cari kandidat hapus:", err)
		return model.ChatResponse{Reply: "Waduh, gagal cari data transaksinya."}
	}
	if len(rows) == 0 {
		return model.ChatResponse{Reply: "Belum ada transaksi yang bisa dihapus."}
	}

	candidates := matchDeleteCandidates(rows, target)
	if len(candidates) == 0 {
		return model.ChatResponse{Reply: fmt.Sprintf("Aku nggak nemu transaksi yang cocok dengan \"%s\". Coba sebutkan nama atau nominalnya.", target)}
	}

	if len(candidates) == 1 {
		return model.ChatResponse{
			Reply:      fmt.Sprintf("Maksudmu %s? Klik tombol di bawah kalau benar mau dihapus.", candidates[0].Label),
			Action:     "confirm_delete",
			Candidates: candidates,
		}
	}

	return model.ChatResponse{
		Reply:      fmt.Sprintf("Ketemu %d yang mirip \"%s\". Pilih yang mau dihapus:", len(candidates), target),
		Action:     "confirm_delete",
		Candidates: candidates,
	}
}

// matchDeleteCandidates mencocokkan target ke 10 transaksi terbaru.
// Target kosong/"yang tadi" = baris terbaru. Selain itu, tiap kata di
// target harus muncul di gabungan description + category + amount
// (case-insensitive).
func matchDeleteCandidates(rows []repository.TransactionRow, target string) []model.DeleteCandidate {
	lower := strings.ToLower(target)
	if lower == "" || lower == "yang tadi" || lower == "terakhir" || lower == "itu" {
		return []model.DeleteCandidate{toDeleteCandidate(rows[0])}
	}

	words := strings.Fields(lower)
	var out []model.DeleteCandidate
	for _, row := range rows {
		haystack := strings.ToLower(row.Description + " " + row.Category + " " + fmt.Sprintf("%.0f", row.Amount))
		matched := true
		for _, w := range words {
			if !strings.Contains(haystack, w) {
				matched = false
				break
			}
		}
		if matched {
			out = append(out, toDeleteCandidate(row))
			if len(out) == 3 {
				break
			}
		}
	}
	return out
}

func toDeleteCandidate(row repository.TransactionRow) model.DeleteCandidate {
	kind := "Pengeluaran"
	if row.Type == "income" {
		kind = "Pemasukan"
	}
	name := displayName(row.Description, row.Category, row.Type)
	label := fmt.Sprintf("%s %s Rp%.0f (%s)", kind, name, row.Amount, formatShortDate(row.CreatedAt))
	return model.DeleteCandidate{
		ID:          row.ID,
		Type:        row.Type,
		Category:    row.Category,
		Description: row.Description,
		Amount:      row.Amount,
		CreatedAt:   row.CreatedAt,
		Label:       label,
	}
}

func formatShortDate(iso string) string {
	if t, err := time.Parse(time.RFC3339, iso); err == nil {
		return t.Format("2 Jan 2006")
	}
	if len(iso) >= 10 {
		return iso[:10]
	}
	return iso
}

func periodLabel(period string) string {
	switch period {
	case "yesterday":
		return "kemarin"
	case "month":
		return "bulan ini"
	case "week":
		return "7 hari terakhir"
	case "year":
		return "tahun ini"
	default:
		return "hari ini"
	}
}
