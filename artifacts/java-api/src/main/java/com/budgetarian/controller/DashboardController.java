package com.budgetarian.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class DashboardController {

    private final JdbcTemplate jdbc;

    public DashboardController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private Map<String, Object> mapExpense(ResultSet rs, int rowNum) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", rs.getInt("id"));
        m.put("userId", rs.getString("user_id"));
        BigDecimal amount = rs.getBigDecimal("amount");
        m.put("amount", amount != null ? amount.doubleValue() : 0.0);
        m.put("category", rs.getString("category"));
        m.put("description", rs.getString("description"));
        LocalDate date = rs.getObject("date", LocalDate.class);
        m.put("date", date != null ? date.toString() : null);
        m.put("notes", rs.getString("notes"));
        Timestamp createdAt = rs.getTimestamp("created_at");
        m.put("createdAt", createdAt != null ? createdAt.toInstant().toString() : null);
        return m;
    }

    @GetMapping("/dashboard/summary")
    public ResponseEntity<Map<String, Object>> summary(
            @RequestAttribute("userId") String userId) {

        String today = LocalDate.now().toString();
        String thisMonthStart = LocalDate.now().withDayOfMonth(1).toString();
        String sevenDaysLater = LocalDate.now().plusDays(7).toString();
        String thirtyDaysLater = LocalDate.now().plusDays(30).toString();

        Double totalExpenses = jdbc.queryForObject(
            "SELECT COALESCE(SUM(amount::numeric), 0) FROM expenses "
            + "WHERE user_id = ? AND date >= ?::date",
            Double.class, userId, thisMonthStart);

        List<Double> goalsSaved = jdbc.query(
            "SELECT saved_amount FROM goals WHERE user_id = ?",
            (rs, n) -> {
                BigDecimal v = rs.getBigDecimal("saved_amount");
                return v != null ? v.doubleValue() : 0.0;
            }, userId);

        int activeGoals = goalsSaved.size();
        double totalSaved = goalsSaved.stream().mapToDouble(Double::doubleValue).sum();

        Long upcomingDues = jdbc.queryForObject(
            "SELECT COUNT(*) FROM installments WHERE user_id = ? AND status = 'pending' "
            + "AND due_date >= ?::date AND due_date <= ?::date",
            Long.class, userId, today, sevenDaysLater);

        Long expiringSoonCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM warranties WHERE user_id = ? "
            + "AND expiry_date >= ?::date AND expiry_date <= ?::date",
            Long.class, userId, today, thirtyDaysLater);

        List<Map<String, Object>> recentExpenses = jdbc.query(
            "SELECT * FROM expenses WHERE user_id = ? ORDER BY created_at DESC LIMIT 5",
            this::mapExpense, userId);

        List<Map<String, Object>> categoryBreakdown = jdbc.query(
            "SELECT category, COALESCE(SUM(amount::numeric), 0) AS total "
            + "FROM expenses WHERE user_id = ? AND date >= ?::date GROUP BY category",
            (rs, n) -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("category", rs.getString("category"));
                m.put("total", rs.getDouble("total"));
                return m;
            }, userId, thisMonthStart);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("totalExpensesThisMonth", totalExpenses != null ? totalExpenses : 0.0);
        resp.put("totalSaved", totalSaved);
        resp.put("activeGoals", activeGoals);
        resp.put("upcomingDues", upcomingDues != null ? upcomingDues.intValue() : 0);
        resp.put("expiringSoonCount", expiringSoonCount != null ? expiringSoonCount.intValue() : 0);
        resp.put("recentExpenses", recentExpenses);
        resp.put("categoryBreakdown", categoryBreakdown);
        return ResponseEntity.ok(resp);
    }
}
