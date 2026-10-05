package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"tuwangapp/backend/internal/repository"
)

// GET /api/v1/trend?period=month|year — deret waktu untuk grafik garis.
// month = per minggu bulan berjalan, year = per bulan tahun berjalan.
// Kalau ?from=&to= (YYYY-MM-DD) diisi, tren mengikuti rentang tanggal
// bebas dari filter riwayat dengan bucket adaptif (harian/mingguan/bulanan).
func GetTrendHandler(c *gin.Context) {
	userID := c.GetString("user_id")

	if from, to := c.Query("from"), c.Query("to"); from != "" || to != "" {
		if from == "" || to == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "from dan to harus diisi bersamaan (YYYY-MM-DD)"})
			return
		}
		buckets, err := repository.GetTrendCustom(userID, from, to)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"period":  "custom",
			"from":    from,
			"to":      to,
			"buckets": buckets,
		})
		return
	}

	period := c.DefaultQuery("period", "month")

	buckets, err := repository.GetTrend(userID, period)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"period":  period,
		"buckets": buckets,
	})
}
