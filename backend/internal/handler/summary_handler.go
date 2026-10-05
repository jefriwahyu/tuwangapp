package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"tuwangapp/backend/internal/repository"
)

func GetSummaryHandler(c *gin.Context) {
	userID := c.GetString("user_id")

	// Filter tanggal bebas dari riwayat: ?from=YYYY-MM-DD&to=YYYY-MM-DD.
	// Kalau diisi, ringkasan (arus kas + kategori) mengikuti tanggal itu.
	if from, to := c.Query("from"), c.Query("to"); from != "" || to != "" {
		if from == "" || to == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "from dan to harus diisi bersamaan (YYYY-MM-DD)"})
			return
		}
		income, expense, incomeCount, expenseCount, err := repository.GetSummaryCustom(userID, from, to)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		breakdown, err := repository.GetCategoryBreakdownCustom(userID, from, to)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"period":        "custom",
			"from":          from,
			"to":            to,
			"income":        income,
			"expense":       expense,
			"income_count":  incomeCount,
			"expense_count": expenseCount,
			"breakdown":     breakdown,
		})
		return
	}

	period := c.DefaultQuery("period", "month")

	income, expense, incomeCount, expenseCount, err := repository.GetSummary(userID, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	breakdown, err := repository.GetCategoryBreakdown(userID, period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"period":        period,
		"income":        income,
		"expense":       expense,
		"income_count":  incomeCount,
		"expense_count": expenseCount,
		"breakdown":     breakdown,
	})
}
