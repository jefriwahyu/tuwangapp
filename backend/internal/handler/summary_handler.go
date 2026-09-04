package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"tuwangapp/backend/internal/repository"
)

func GetSummaryHandler(c *gin.Context) {
	period := c.DefaultQuery("period", "month")

	income, expense, err := repository.GetSummary(period)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"period":  period,
		"income":  income,
		"expense": expense,
	})
}
