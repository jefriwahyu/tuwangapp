package repository

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"time"

	"tuwangapp/backend/internal/category"
)

type transactionPayload struct {
	UserID      string  `json:"user_id"`
	Type        string  `json:"type"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
}

func SaveTransaction(userID string, txType string, amount float64, category string, description string) error {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	payload := transactionPayload{
		UserID:      userID,
		Type:        txType,
		Amount:      amount,
		Category:    category,
		Description: description,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := supabaseURL + "/rest/v1/transactions"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("supabase error: status %d", resp.StatusCode)
	}

	return nil
}

type TransactionRow struct {
	ID          any     `json:"id"`
	Type        string  `json:"type"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
	CreatedAt   string  `json:"created_at"`
}

func GetSummary(userID string, period string) (income float64, expense float64, incomeCount int, expenseCount int, err error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	startDate, endDate := periodRange(period)

	u, err := url.Parse(supabaseURL + "/rest/v1/transactions")
	if err != nil {
		return 0, 0, 0, 0, err
	}
	q := u.Query()
	q.Set("select", "type,amount")
	q.Set("user_id", "eq."+userID)
	q.Add("created_at", "gte."+startDate)
	q.Add("created_at", "lt."+endDate)
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return 0, 0, 0, 0, fmt.Errorf("supabase error: status %d", resp.StatusCode)
	}

	var rows []TransactionRow
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return 0, 0, 0, 0, err
	}

	for _, row := range rows {
		if row.Type == "income" {
			income += row.Amount
			incomeCount++
		} else if row.Type == "expense" {
			expense += row.Amount
			expenseCount++
		}
	}
	return income, expense, incomeCount, expenseCount, nil
}

// parseCustomRange memvalidasi from/to YYYY-MM-DD dan mengembalikan
// batas Supabase: gte awal hari from, lt awal hari setelah to.
// Hari pakai zona +07:00 seperti ListFilter supaya konsisten.
func parseCustomRange(from, to string) (start, end string, err error) {
	if from == "" || to == "" {
		return "", "", fmt.Errorf("from dan to harus diisi bersamaan (YYYY-MM-DD)")
	}
	fd, err := time.Parse("2006-01-02", from)
	if err != nil {
		return "", "", fmt.Errorf("format from tidak valid (pakai YYYY-MM-DD)")
	}
	td, err := time.Parse("2006-01-02", to)
	if err != nil {
		return "", "", fmt.Errorf("format to tidak valid (pakai YYYY-MM-DD)")
	}
	if td.Before(fd) {
		return "", "", fmt.Errorf("to tidak boleh sebelum from")
	}
	next := td.AddDate(0, 0, 1).Format("2006-01-02")
	return from + "T00:00:00+07:00", next + "T00:00:00+07:00", nil
}

// GetSummaryCustom seperti GetSummary tapi rentang tanggal bebas.
// Dipakai handler ?from=&to= supaya ringkasan ikut filter riwayat.
func GetSummaryCustom(userID, from, to string) (income float64, expense float64, incomeCount int, expenseCount int, err error) {
	startDate, endDate, err := parseCustomRange(from, to)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	u, err := url.Parse(supabaseURL + "/rest/v1/transactions")
	if err != nil {
		return 0, 0, 0, 0, err
	}
	q := u.Query()
	q.Set("select", "type,amount")
	q.Set("user_id", "eq."+userID)
	q.Add("created_at", "gte."+startDate)
	q.Add("created_at", "lt."+endDate)
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return 0, 0, 0, 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return 0, 0, 0, 0, fmt.Errorf("supabase error: status %d", resp.StatusCode)
	}

	var rows []TransactionRow
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return 0, 0, 0, 0, err
	}

	for _, row := range rows {
		if row.Type == "income" {
			income += row.Amount
			incomeCount++
		} else if row.Type == "expense" {
			expense += row.Amount
			expenseCount++
		}
	}
	return income, expense, incomeCount, expenseCount, nil
}

// CategoryBreakdown adalah total per (type, category) untuk satu periode.
type CategoryBreakdown struct {
	Category string  `json:"category"`
	Type     string  `json:"type"`
	Total    float64 `json:"total"`
}

// GetCategoryBreakdown mengelompokkan total per kategori milik user ini.
// Agregasi di Go (seperti GetSummary) supaya konsisten dan tetap KISS.
func GetCategoryBreakdown(userID string, period string) ([]CategoryBreakdown, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	startDate, endDate := periodRange(period)

	u, err := url.Parse(supabaseURL + "/rest/v1/transactions")
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("select", "type,category,amount")
	q.Set("user_id", "eq."+userID)
	q.Add("created_at", "gte."+startDate)
	q.Add("created_at", "lt."+endDate)
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("supabase error: status %d", resp.StatusCode)
	}

	var rows []TransactionRow
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return nil, err
	}

	return groupBreakdown(rows), nil
}

// groupBreakdown adalah satu-satunya agregasi kategori dari rows.
// Normalisasi di baca juga: data lama yang kategorinya bebas ikut
// dipetakan ke daftar kanonis, kosong = Lainnya.
func groupBreakdown(rows []TransactionRow) []CategoryBreakdown {
	grouped := map[string]*CategoryBreakdown{}
	order := []string{}
	for _, row := range rows {
		cat := category.Normalize(row.Category)
		key := row.Type + "|" + cat
		if g, ok := grouped[key]; ok {
			g.Total += row.Amount
		} else {
			grouped[key] = &CategoryBreakdown{Category: cat, Type: row.Type, Total: row.Amount}
			order = append(order, key)
		}
	}
	out := make([]CategoryBreakdown, 0, len(order))
	for _, k := range order {
		out = append(out, *grouped[k])
	}
	return out
}

// GetCategoryBreakdownCustom seperti GetCategoryBreakdown tapi rentang
// tanggal bebas. Dipakai handler ?from=&to= supaya kategori ikut filter.
func GetCategoryBreakdownCustom(userID, from, to string) ([]CategoryBreakdown, error) {
	startDate, endDate, err := parseCustomRange(from, to)
	if err != nil {
		return nil, err
	}
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	u, err := url.Parse(supabaseURL + "/rest/v1/transactions")
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("select", "type,category,amount")
	q.Set("user_id", "eq."+userID)
	q.Add("created_at", "gte."+startDate)
	q.Add("created_at", "lt."+endDate)
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("supabase error: status %d", resp.StatusCode)
	}

	var rows []TransactionRow
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return nil, err
	}

	return groupBreakdown(rows), nil
}

// ListFilter adalah parameter saring + paging untuk daftar transaksi.
type ListFilter struct {
	From   string // YYYY-MM-DD, opsional
	To     string // YYYY-MM-DD, opsional (inklusif)
	Period string // preset ringkasan: today/yesterday/week/month/year, dipakai kalau From/To kosong
	Limit  int
	Offset int
}

// GetTransactions mengembalikan transaksi milik user, terbaru dulu,
// opsional disaring rentang tanggal, dengan limit/offset.
func GetTransactions(userID string, f ListFilter) ([]TransactionRow, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	if f.Limit <= 0 {
		f.Limit = 10
	}
	if f.Limit > 100 {
		f.Limit = 100
	}
	if f.Offset < 0 {
		f.Offset = 0
	}

	u, err := url.Parse(supabaseURL + "/rest/v1/transactions")
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("select", "id,type,amount,category,description,created_at")
	q.Set("user_id", "eq."+userID)
	if f.From != "" || f.To != "" {
		if f.From != "" {
			q.Add("created_at", "gte."+f.From+"T00:00:00+07:00")
		}
		if f.To != "" {
			// Sampai akhir hari To: pakai lt awal hari berikutnya.
			d, err := time.Parse("2006-01-02", f.To)
			if err != nil {
				return nil, fmt.Errorf("format to tidak valid (pakai YYYY-MM-DD)")
			}
			next := d.AddDate(0, 0, 1).Format("2006-01-02")
			q.Add("created_at", "lt."+next+"T00:00:00+07:00")
		}
	} else if f.Period != "" {
		start, end := periodRange(f.Period)
		q.Add("created_at", "gte."+start)
		q.Add("created_at", "lt."+end)
	}
	q.Set("order", "created_at.desc")
	q.Set("limit", strconv.Itoa(f.Limit))
	q.Set("offset", strconv.Itoa(f.Offset))
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("supabase error: status %d", resp.StatusCode)
	}

	var rows []TransactionRow
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []TransactionRow{}
	}
	return rows, nil
}

// ErrNotFound berarti baris tidak ada atau bukan milik user ini.
var ErrNotFound = errors.New("transaksi tidak ditemukan")

// DeleteTransaction menghapus satu transaksi milik user.
// Filter ganda id + user_id mencegah user menghapus milik orang lain.
func DeleteTransaction(userID string, id string) error {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	u, err := url.Parse(supabaseURL + "/rest/v1/transactions")
	if err != nil {
		return err
	}
	q := u.Query()
	q.Set("id", "eq."+id)
	q.Set("user_id", "eq."+userID)
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodDelete, u.String(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("Prefer", "return=representation")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("supabase error: status %d", resp.StatusCode)
	}

	// Dengan Prefer return=representation, Supabase mengembalikan
	// baris yang terhapus. Kosong = id tidak ada / bukan milik user.
	var deleted []TransactionRow
	if err := json.NewDecoder(resp.Body).Decode(&deleted); err != nil {
		return err
	}
	if len(deleted) == 0 {
		return ErrNotFound
	}
	return nil
}

func periodRange(period string) (start, end string) {
	now := time.Now()
	var startTime, endTime time.Time

	switch period {
	case "yesterday":
		y := now.AddDate(0, 0, -1)
		startTime = time.Date(y.Year(), y.Month(), y.Day(), 0, 0, 0, 0, now.Location())
		endTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	case "week":
		// 7 hari terakhir termasuk hari ini: awal hari 6 hari lalu s/d sekarang.
		weekAgo := now.AddDate(0, 0, -6)
		startTime = time.Date(weekAgo.Year(), weekAgo.Month(), weekAgo.Day(), 0, 0, 0, 0, now.Location())
		endTime = now
	case "month":
		startTime = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		endTime = now
	case "year":
		startTime = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		endTime = now
	default: // "today"
		startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endTime = now
	}
	return startTime.Format(time.RFC3339), endTime.Format(time.RFC3339)
}

// TrendBucket adalah satu titik deret waktu untuk grafik garis.
type TrendBucket struct {
	Label   string  `json:"label"`
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
}

// fetchTrendRows mengambil type+amount+created_at milik user pada rentang.
func fetchTrendRows(userID, startDate, endDate string) ([]TransactionRow, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	u, err := url.Parse(supabaseURL + "/rest/v1/transactions")
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("select", "type,amount,created_at")
	q.Set("user_id", "eq."+userID)
	q.Add("created_at", "gte."+startDate)
	q.Add("created_at", "lt."+endDate)
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("supabase error: status %d", resp.StatusCode)
	}

	var rows []TransactionRow
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return nil, err
	}
	return rows, nil
}

// trendDayKey mengubah created_at ISO menjadi YYYY-MM-DD (+07:00).
func trendDayKey(iso string) string {
	if t, err := time.Parse(time.RFC3339, iso); err == nil {
		return t.Format("2006-01-02")
	}
	if len(iso) >= 10 {
		return iso[:10]
	}
	return iso
}

// shortDayLabel "2026-10-05" -> "5 Okt" untuk label grafik.
func shortDayLabel(ymd string) string {
	if d, err := time.Parse("2006-01-02", ymd); err == nil {
		return d.Format("2 Jan")
	}
	return ymd
}

// GetTrend deret waktu preset: month = per minggu bulan berjalan,
// year = per bulan tahun berjalan. Periode lain ditolak (400).
func GetTrend(userID, period string) ([]TrendBucket, error) {
	now := time.Now()
	switch period {
	case "month":
		start, end := periodRange("month")
		rows, err := fetchTrendRows(userID, start, end)
		if err != nil {
			return nil, err
		}
		// 4-5 bucket minggu: 1-7, 8-14, 15-21, 22-akhir.
		buckets := []TrendBucket{
			{Label: "Minggu 1"}, {Label: "Minggu 2"}, {Label: "Minggu 3"}, {Label: "Minggu 4"},
		}
		// Bulan 28+ hari: hari 29+ masuk bucket terakhir.
		for _, row := range rows {
			day := 1
			if d, err := time.Parse("2006-01-02", trendDayKey(row.CreatedAt)); err == nil {
				day = d.Day()
			}
			idx := (day - 1) / 7
			if idx > 3 {
				idx = 3
			}
			if row.Type == "income" {
				buckets[idx].Income += row.Amount
			} else if row.Type == "expense" {
				buckets[idx].Expense += row.Amount
			}
		}
		return buckets, nil
	case "year":
		start, end := periodRange("year")
		rows, err := fetchTrendRows(userID, start, end)
		if err != nil {
			return nil, err
		}
		buckets := make([]TrendBucket, 12)
		for i := range buckets {
			buckets[i].Label = time.Date(now.Year(), time.Month(i+1), 1, 0, 0, 0, 0, now.Location()).Format("Jan")
		}
		for _, row := range rows {
			m := -1
			if t, err := time.Parse(time.RFC3339, row.CreatedAt); err == nil {
				m = int(t.Month()) - 1
			} else if len(row.CreatedAt) >= 7 {
				if mm, err := strconv.Atoi(row.CreatedAt[5:7]); err == nil {
					m = mm - 1
				}
			}
			if m < 0 || m > 11 {
				continue
			}
			if row.Type == "income" {
				buckets[m].Income += row.Amount
			} else if row.Type == "expense" {
				buckets[m].Expense += row.Amount
			}
		}
		return buckets, nil
	default:
		return nil, fmt.Errorf("period tren didukung: month, year")
	}
}

// GetTrendCustom tren rentang bebas dengan bucket adaptif:
// <=31 hari = harian, <=120 hari = mingguan, selebihnya = bulanan.
func GetTrendCustom(userID, from, to string) ([]TrendBucket, error) {
	startDate, endDate, err := parseCustomRange(from, to)
	if err != nil {
		return nil, err
	}
	fd, _ := time.Parse("2006-01-02", from)
	td, _ := time.Parse("2006-01-02", to)
	days := int(td.Sub(fd).Hours()/24) + 1

	rows, err := fetchTrendRows(userID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	switch {
	case days <= 31:
		// Bucket harian, urut tanggal.
		keys := []string{}
		seen := map[string]bool{}
		for d := fd; !d.After(td); d = d.AddDate(0, 0, 1) {
			k := d.Format("2006-01-02")
			keys = append(keys, k)
			seen[k] = true
		}
		agg := map[string]*TrendBucket{}
		for _, k := range keys {
			agg[k] = &TrendBucket{Label: shortDayLabel(k)}
		}
		for _, row := range rows {
			k := trendDayKey(row.CreatedAt)
			b, ok := agg[k]
			if !ok {
				continue
			}
			if row.Type == "income" {
				b.Income += row.Amount
			} else if row.Type == "expense" {
				b.Expense += row.Amount
			}
		}
		_ = seen
		out := make([]TrendBucket, 0, len(keys))
		for _, k := range keys {
			out = append(out, *agg[k])
		}
		return out, nil
	case days <= 120:
		// Bucket mingguan: potong per 7 hari dari from.
		type span struct{ start, end time.Time }
		var spans []span
		for s := fd; !s.After(td); {
			e := s.AddDate(0, 0, 6)
			if e.After(td) {
				e = td
			}
			spans = append(spans, span{s, e})
			s = e.AddDate(0, 0, 1)
		}
		buckets := make([]TrendBucket, len(spans))
		for i, sp := range spans {
			if sp.start.Format("2006-01-02") == sp.end.Format("2006-01-02") {
				buckets[i].Label = shortDayLabel(sp.start.Format("2006-01-02"))
			} else {
				buckets[i].Label = shortDayLabel(sp.start.Format("2006-01-02")) + "-" + shortDayLabel(sp.end.Format("2006-01-02"))
			}
		}
		for _, row := range rows {
			rd, err := time.Parse("2006-01-02", trendDayKey(row.CreatedAt))
			if err != nil {
				continue
			}
			for i, sp := range spans {
				if !rd.Before(sp.start) && !rd.After(sp.end) {
					if row.Type == "income" {
						buckets[i].Income += row.Amount
					} else if row.Type == "expense" {
						buckets[i].Expense += row.Amount
					}
					break
				}
			}
		}
		return buckets, nil
	default:
		// Bucket bulanan: YYYY-MM urut.
		keys := []string{}
		agg := map[string]*TrendBucket{}
		for d := time.Date(fd.Year(), fd.Month(), 1, 0, 0, 0, 0, fd.Location()); !d.After(td); d = d.AddDate(0, 1, 0) {
			k := d.Format("2006-01")
			keys = append(keys, k)
			agg[k] = &TrendBucket{Label: d.Format("Jan 2006")}
		}
		sort.Strings(keys)
		// keys sudah urut karena dibangun kronologis; sort jaga-jaga.
		for _, row := range rows {
			k := ""
			if t, err := time.Parse(time.RFC3339, row.CreatedAt); err == nil {
				k = t.Format("2006-01")
			} else if len(row.CreatedAt) >= 7 {
				k = row.CreatedAt[:7]
			}
			b, ok := agg[k]
			if !ok {
				continue
			}
			if row.Type == "income" {
				b.Income += row.Amount
			} else if row.Type == "expense" {
				b.Expense += row.Amount
			}
		}
		out := make([]TrendBucket, 0, len(keys))
		for _, k := range keys {
			out = append(out, *agg[k])
		}
		return out, nil
	}
}
