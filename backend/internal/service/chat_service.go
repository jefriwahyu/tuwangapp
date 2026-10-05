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
		if guessLang(req.Message) == "en" {
			return model.ChatResponse{Reply: "Sorry, I had trouble reaching the AI. Please try again."}
		}
		return model.ChatResponse{Reply: "Maaf, ada masalah waktu menghubungi AI"}
	}
	// LLM lama kadang mengosongkan lang — tebak dari teks user.
	if strings.TrimSpace(extracted.Lang) == "" {
		extracted.Lang = guessLang(req.Message)
	}

	switch extracted.Intent {
	case "transaction":
		return handleTransactionIntent(userID, req.Period, extracted)

	case "query_report":
		period := normalizeReportPeriod(extracted.Period, req.Period)
		income, expense, incomeCount, expenseCount, err := repository.GetSummary(userID, period)
		if err != nil {
			log.Println("Gagal ambil rekap:", err)
			if langIsEnglish(extracted.Lang) {
				return model.ChatResponse{Reply: "Oops, I failed to fetch your recap."}
			}
			return model.ChatResponse{Reply: "Waduh, gagal ambil data rekap."}
		}
		breakdown, err := repository.GetCategoryBreakdown(userID, period)
		if err != nil {
			log.Println("Gagal ambil breakdown:", err)
			breakdown = nil
		}
		// LLM diminta mengisi reply intro tanpa angka dalam bahasa user.
		// Kalau kosong (contoh lama), backend yang buatkan versi id/en.
		reply := strings.TrimSpace(extracted.Reply)
		if reply == "" {
			reply = randomReportIntro(period, extracted.Lang)
		}
		return model.ChatResponse{
			Reply:  reply,
			Period: period,
			Summary: &model.SummarySnapshot{
				Period:       period,
				Income:       income,
				Expense:      expense,
				IncomeCount:  incomeCount,
				ExpenseCount: expenseCount,
				Breakdown:    breakdown,
			},
		}

	case "delete_transaction":
		return handleDeleteIntent(userID, extracted.Target)

	default: // chitchat
		return model.ChatResponse{Reply: extracted.Reply}
	}
}

// maxTransactionsPerMessage membatasi satu pesan ke maksimal 5 transaksi.
// Lebih dari itu hampir pasti LLM mengarang — potong, jangan tolak.
const maxTransactionsPerMessage = 5

// handleTransactionIntent menyimpan 1..5 item dari satu pesan chat.
// Tiap item divalidasi sendiri (type income/expense, amount > 0):
// item invalid dilewati tanpa menggagalkan yang valid.
// Ringkasan segar untuk periode aktif ikut dikembalikan supaya
// chart langsung update tanpa fetch ulang.
func handleTransactionIntent(userID string, activePeriod string, extracted ExtractedMessage) model.ChatResponse {
	items := extracted.Transactions
	if len(items) == 0 {
		// Fallback respons model lama yang masih pakai field tunggal.
		if extracted.Amount > 0 || extracted.Type != "" || extracted.Category != "" || extracted.Description != "" {
			items = []TransactionItem{{
				Type:        extracted.Type,
				Amount:      extracted.Amount,
				Category:    extracted.Category,
				Description: extracted.Description,
			}}
		}
	}
	if len(items) > maxTransactionsPerMessage {
		items = items[:maxTransactionsPerMessage]
	}
	if len(items) == 0 {
		return model.ChatResponse{Reply: "Nominalnya berapa? Sebutkan angkanya, misal \"kopi 15rb\"."}
	}

	var valid []TransactionItem
	for _, it := range items {
		t := strings.ToLower(strings.TrimSpace(it.Type))
		if t != "income" && t != "expense" {
			continue
		}
		if it.Amount <= 0 {
			continue
		}
		valid = append(valid, TransactionItem{
			Type:        t,
			Amount:      it.Amount,
			Category:    category.Normalize(it.Category),
			Description: sanitizeDescription(it.Description),
		})
	}
	if len(valid) == 0 {
		return model.ChatResponse{Reply: "Waduh, nominalnya nggak kebaca. Coba tulis lagi, misal \"kopi 15rb\"."}
	}
	if len(valid) < len(items) {
		log.Printf("Sebagian item ditolak validasi (%d dari %d)", len(valid), len(items))
	}

	for _, v := range valid {
		if err := repository.SaveTransaction(userID, v.Type, v.Amount, v.Category, v.Description); err != nil {
			log.Println("Gagal simpan transaksi:", err)
			return model.ChatResponse{Reply: "Waduh, aku ngerti maksud kamu, tapi gagal nyimpen ke database."}
		}
	}

	reply := extracted.Reply
	if len(valid) > 1 {
		reply = multiReply(valid)
	}

	return model.ChatResponse{
		Reply:      reply,
		Summary:    freshSummary(userID, activePeriod),
		SavedCount: len(valid),
		Saved:      toSaved(valid),
	}
}

// toSaved menyalin item valid ke respons agar frontend bisa merender
// kartu struk persis mock (nama + kategori + nominal + status Tersimpan).
func toSaved(valid []TransactionItem) []model.SavedTransaction {
	out := make([]model.SavedTransaction, 0, len(valid))
	for _, v := range valid {
		out = append(out, model.SavedTransaction{
			Type:        v.Type,
			Amount:      v.Amount,
			Category:    v.Category,
			Description: v.Description,
		})
	}
	return out
}

// multiReply membangun balasan dari data valid (backend sumber kebenaran).
// LLM kadang hanya menyebut item pertama — daftar ini selalu lengkap.
func multiReply(valid []TransactionItem) string {
	parts := make([]string, 0, len(valid))
	for _, v := range valid {
		name := displayName(v.Description, v.Category, v.Type)
		parts = append(parts, fmt.Sprintf("%s Rp%.0f", name, v.Amount))
	}
	return fmt.Sprintf("Tercatat %d transaksi: %s. Ada lagi?", len(valid), strings.Join(parts, ", "))
}

// freshSummary mengambil angka terbaru untuk periode aktif.
// Gagal = nil — frontend mengabaikannya dan tetap pakai jalur fetch biasa.
func freshSummary(userID string, activePeriod string) *model.SummarySnapshot {
	period := activePeriod
	switch period {
	case "today", "yesterday", "week", "month", "year":
	default:
		period = "month"
	}
	income, expense, incomeCount, expenseCount, err := repository.GetSummary(userID, period)
	if err != nil {
		log.Println("Gagal ambil ringkasan inline:", err)
		return nil
	}
	breakdown, err := repository.GetCategoryBreakdown(userID, period)
	if err != nil {
		log.Println("Gagal ambil breakdown inline:", err)
		breakdown = nil
	}
	return &model.SummarySnapshot{
		Period:       period,
		Income:       income,
		Expense:      expense,
		IncomeCount:  incomeCount,
		ExpenseCount: expenseCount,
		Breakdown:    breakdown,
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

// periodLabelEn pasangan periodLabel untuk balasan bahasa Inggris.
func periodLabelEn(period string) string {
	switch period {
	case "yesterday":
		return "yesterday"
	case "month":
		return "this month"
	case "week":
		return "the last 7 days"
	case "year":
		return "this year"
	default:
		return "today"
	}
}

// langIsEnglish true untuk kode bahasa Inggris (en, en-US, ...).
func langIsEnglish(lang string) bool {
	l := strings.ToLower(strings.TrimSpace(lang))
	return l == "en" || strings.HasPrefix(l, "en-") || strings.HasPrefix(l, "en_")
}

// guessLang tebakan kasar bahasa pesan user bila LLM mengosongkan lang.
// "en" kalau penanda Inggris lebih banyak, selain itu "id" (default lama).
// Bahasa lain selain keduanya tetap dijawab LLM via extracted.Reply,
// backend hanya butuh pembeda id vs non-id untuk template hardcoded.
func guessLang(msg string) string {
	lower := strings.ToLower(msg)
	idMarks := []string{"aku", "saya", "kamu", "beli", "berapa", "rekap", "bulan", "kemarin", "hari ini", "uang", "saldo", "tolong", "coba", "lihat", "tadi", "dong", "hapus", "gaji", "kopi", "makan", "bayar", "dapat", "pemasukan", "pengeluaran", "tercatat", "nggak", "udah", "aja"}
	enMarks := []string{"bought", "buy ", "how much", "how many", "what is", "what's", "balance", "recap", "summary", "month", "yesterday", "today", "money", "please", "show me", "coffee", "delete", "remove", "salary", "expense", "income", "i spent", "i paid", "i got", "my "}
	idCount, enCount := 0, 0
	for _, w := range idMarks {
		if strings.Contains(lower, w) {
			idCount++
		}
	}
	for _, w := range enMarks {
		if strings.Contains(lower, w) {
			enCount++
		}
	}
	if enCount > idCount {
		return "en"
	}
	return "id"
}

// randomReportIntro intro rekap tanpa angka (angka ada di kartu).
// Bahasa mengikuti pesan user; default Indonesia.
func randomReportIntro(period, lang string) string {
	if langIsEnglish(lang) {
		label := periodLabelEn(period)
		en := []string{
			"Done! Your recap for %s is in the card below, take a peek at your balance there.",
			"Here is your recap for %s — income, expense, and balance details are in the card below.",
			"All set! Check the card below for your full %s recap.",
		}
		return fmt.Sprintf(en[int(time.Now().UnixNano())%len(en)], label)
	}
	label := periodLabel(period)
	id := []string{
		"Beres! Rekap %s sudah aku rangkum di kartu bawah ya, silakan intip sisa saldomu di sana.",
		"Nih rekap %s kamu — detail pemasukan, pengeluaran, dan sisa saldonya ada di kartu bawah.",
		"Sudah aku siapkan! Cek kartu di bawah untuk rekap %s lengkapnya ya.",
	}
	return fmt.Sprintf(id[int(time.Now().UnixNano())%len(id)], label)
}

// normalizeReportPeriod memastikan periode rekap selalu valid.
// LLM kadang mengosongkan period (terutama untuk "sisa saldo") —
// fallback ke periode aktif frontend, terakhir "month".
func normalizeReportPeriod(extracted, active string) string {
	switch extracted {
	case "today", "yesterday", "week", "month", "year":
		return extracted
	}
	switch active {
	case "today", "yesterday", "week", "month", "year":
		return active
	}
	return "month"
}
