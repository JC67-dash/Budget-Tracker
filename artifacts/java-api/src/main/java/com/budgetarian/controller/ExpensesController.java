package com.budgetarian.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class ExpensesController {

    private final JdbcTemplate jdbc;

    public ExpensesController(JdbcTemplate jdbc) {
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

    @GetMapping("/expenses")
    public ResponseEntity<Map<String, Object>> list(
            @RequestAttribute("userId") String userId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(required = false) String category) {

        List<Map<String, Object>> expenses;
        long total;

        if (category != null) {
            expenses = jdbc.query(
                "SELECT * FROM expenses WHERE user_id = ? AND category = ? ORDER BY created_at LIMIT ? OFFSET ?",
                this::mapExpense, userId, category, limit, offset);
            total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM expenses WHERE user_id = ? AND category = ?",
                Long.class, userId, category);
        } else {
            expenses = jdbc.query(
                "SELECT * FROM expenses WHERE user_id = ? ORDER BY created_at LIMIT ? OFFSET ?",
                this::mapExpense, userId, limit, offset);
            total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM expenses WHERE user_id = ?",
                Long.class, userId);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("expenses", expenses);
        resp.put("total", total);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/expenses")
    public ResponseEntity<Map<String, Object>> create(
            @RequestAttribute("userId") String userId,
            @RequestBody Map<String, Object> body) {

        String amount = body.get("amount") != null ? String.valueOf(body.get("amount")) : null;
        String category = (String) body.get("category");
        String description = (String) body.get("description");
        String date = (String) body.get("date");
        String notes = (String) body.get("notes");

        if (amount == null || category == null || description == null || date == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        }

        List<Map<String, Object>> results = jdbc.query(
            "INSERT INTO expenses (user_id, amount, category, description, date, notes) "
            + "VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
            this::mapExpense, userId, new BigDecimal(amount), category, description, date, notes);

        if (results.isEmpty()) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Insert failed"));
        }
        return ResponseEntity.status(201).body(results.get(0));
    }

    @GetMapping("/expenses/summary")
    public ResponseEntity<Map<String, Object>> summary(
            @RequestAttribute("userId") String userId) {

        String thisMonthStart = LocalDate.now().withDayOfMonth(1).toString();
        LocalDate now = LocalDate.now();
        String lastMonthStart = now.minusMonths(1).withDayOfMonth(1).toString();
        String lastMonthEnd = now.withDayOfMonth(1).minusDays(1).toString();

        Double thisMonth = jdbc.queryForObject(
            "SELECT COALESCE(SUM(amount::numeric), 0) FROM expenses WHERE user_id = ? AND date >= ?::date",
            Double.class, userId, thisMonthStart);

        Double lastMonth = jdbc.queryForObject(
            "SELECT COALESCE(SUM(amount::numeric), 0) FROM expenses "
            + "WHERE user_id = ? AND date >= ?::date AND date <= ?::date",
            Double.class, userId, lastMonthStart, lastMonthEnd);

        List<Map<String, Object>> byCategory = jdbc.query(
            "SELECT category, COALESCE(SUM(amount::numeric), 0) AS total "
            + "FROM expenses WHERE user_id = ? GROUP BY category",
            (rs, n) -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("category", rs.getString("category"));
                m.put("total", rs.getDouble("total"));
                return m;
            }, userId);

        List<Map<String, Object>> monthlyTrend = jdbc.query(
            "SELECT TO_CHAR(date, 'YYYY-MM') AS month, COALESCE(SUM(amount::numeric), 0) AS total "
            + "FROM expenses WHERE user_id = ? AND date >= NOW() - INTERVAL '6 months' "
            + "GROUP BY TO_CHAR(date, 'YYYY-MM') ORDER BY month",
            (rs, n) -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("month", rs.getString("month"));
                m.put("total", rs.getDouble("total"));
                return m;
            }, userId);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("thisMonth", thisMonth != null ? thisMonth : 0.0);
        resp.put("lastMonth", lastMonth != null ? lastMonth : 0.0);
        resp.put("byCategory", byCategory);
        resp.put("monthlyTrend", monthlyTrend);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/expenses/{id}")
    public ResponseEntity<Map<String, Object>> getOne(
            @RequestAttribute("userId") String userId,
            @PathVariable int id) {

        List<Map<String, Object>> results = jdbc.query(
            "SELECT * FROM expenses WHERE id = ? AND user_id = ?",
            this::mapExpense, id, userId);

        if (results.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Expense not found"));
        }
        return ResponseEntity.ok(results.get(0));
    }

    @PatchMapping("/expenses/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @RequestAttribute("userId") String userId,
            @PathVariable int id,
            @RequestBody Map<String, Object> body) {

        List<Map<String, Object>> existing = jdbc.query(
            "SELECT * FROM expenses WHERE id = ? AND user_id = ?",
            this::mapExpense, id, userId);
        if (existing.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Expense not found"));
        }

        StringBuilder sql = new StringBuilder("UPDATE expenses SET ");
        List<Object> params = new java.util.ArrayList<>();
        boolean first = true;

        if (body.containsKey("amount")) {
            sql.append("amount = ?"); params.add(new BigDecimal(String.valueOf(body.get("amount")))); first = false;
        }
        if (body.containsKey("category")) {
            if (!first) sql.append(", "); sql.append("category = ?"); params.add(body.get("category")); first = false;
        }
        if (body.containsKey("description")) {
            if (!first) sql.append(", "); sql.append("description = ?"); params.add(body.get("description")); first = false;
        }
        if (body.containsKey("date")) {
            if (!first) sql.append(", "); sql.append("date = ?"); params.add(body.get("date")); first = false;
        }
        if (body.containsKey("notes")) {
            if (!first) sql.append(", "); sql.append("notes = ?"); params.add(body.get("notes"));
        }

        if (params.isEmpty()) {
            return ResponseEntity.ok(existing.get(0));
        }

        sql.append(" WHERE id = ? AND user_id = ? RETURNING *");
        params.add(id);
        params.add(userId);

        List<Map<String, Object>> results = jdbc.query(sql.toString(), this::mapExpense, params.toArray());
        if (results.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Expense not found"));
        }
        return ResponseEntity.ok(results.get(0));
    }

    @DeleteMapping("/expenses/{id}")
    public ResponseEntity<?> delete(
            @RequestAttribute("userId") String userId,
            @PathVariable int id) {

        List<Map<String, Object>> results = jdbc.query(
            "DELETE FROM expenses WHERE id = ? AND user_id = ? RETURNING id",
            (rs, n) -> Map.of("id", rs.getInt("id")), id, userId);

        if (results.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Expense not found"));
        }
        return ResponseEntity.noContent().build();
    }
}
