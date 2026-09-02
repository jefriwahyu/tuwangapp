package repository

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"
)

type transactionPayload struct {
	Type     string  `json:"type"`
	Amount   float64 `json:"amount"`
	Category string  `json:"category"`
}

func SaveTransaction(txType string, amount float64, category string) error {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	payload := transactionPayload{
		Type:     txType,
		Amount:   amount,
		Category: category,
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

type transactionRow struct {
	Type   string  `json:"type"`
	Amount float64 `json:"amount"`
}

func GetSummary(period string) (income float64, expense float64, err error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_KEY")

	startDate := periodStartDate(period)

	u, err := url.Parse(supabaseURL + "/rest/v1/transactions")
	if err != nil {
		return 0, 0, err
	}
	q := u.Query()
	q.Set("select", "type,amount")
	q.Set("created_at", "gte."+startDate)
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

	var rows []transactionRow
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

func periodStartDate(period string) string {
	now := time.Now()
	var start time.Time
	switch period {
	case "month":
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	case "year":
		start = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	default: // "today"
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	}
	return start.Format(time.RFC3339)
}
