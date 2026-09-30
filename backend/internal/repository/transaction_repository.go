package repository

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
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

func GetSummary(userID string, period string) (income float64, expense float64, err error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	startDate, endDate := periodRange(period)

	u, err := url.Parse(supabaseURL + "/rest/v1/transactions")
	if err != nil {
		return 0, 0, err
	}
	q := u.Query()
	q.Set("select", "type,amount")
	q.Set("user_id", "eq."+userID)
	q.Add("created_at", "gte."+startDate)
	q.Add("created_at", "lt."+endDate)
	u.RawQuery = q.Encode()

	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return 0, 0, err
	}
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return 0, 0, fmt.Errorf("supabase error: status %d", resp.StatusCode)
	}

	var rows []TransactionRow
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return 0, 0, err
	}

	for _, row := range rows {
		if row.Type == "income" {
			income += row.Amount
		} else if row.Type == "expense" {
			expense += row.Amount
		}
	}
	return income, expense, nil
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

	grouped := map[string]*CategoryBreakdown{}
	order := []string{}
	for _, row := range rows {
		// Normalisasi di baca juga: data lama yang kategorinya bebas
		// ikut dipetakan ke daftar kanonis, kosong = Lainnya.
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
	return out, nil
}

// ListFilter adalah parameter saring + paging untuk daftar transaksi.
type ListFilter struct {
	From   string // YYYY-MM-DD, opsional
	To     string // YYYY-MM-DD, opsional (inklusif)
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
