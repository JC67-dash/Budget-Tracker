package com.budgetarian.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class InstallmentsController {

    private final JdbcTemplate jdbc;

    public InstallmentsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private Map<String, Object> mapInstallment(ResultSet rs, int rowNum) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", rs.getInt("id"));
        m.put("userId", rs.getString("user_id"));
        m.put("name", rs.getString("name"));
        BigDecimal amount = rs.getBigDecimal("amount");
        m.put("amount", amount != null ? amount.doubleValue() : 0.0);
        LocalDate dueDate = rs.getObject("due_date", LocalDate.class);
        m.put("dueDate", dueDate != null ? dueDate.toString() : null);
        m.put("status", rs.getString("status"));
        m.put("notes", rs.getString("notes"));
        Timestamp createdAt = rs.getTimestamp("created_at");
        m.put("createdAt", createdAt != null ? createdAt.toInstant().toString() : null);
        return m;
    }

    @GetMapping("/installments")
    public ResponseEntity<Map<String, Object>> list(
            @RequestAttribute("userId") String userId) {
        List<Map<String, Object>> installments = jdbc.query(
            "SELECT * FROM installments WHERE user_id = ? ORDER BY due_date",
            this::mapInstallment, userId);
        return ResponseEntity.ok(Map.of("installments", installments));
    }

    @PostMapping("/installments")
    public ResponseEntity<Map<String, Object>> create(
            @RequestAttribute("userId") String userId,
            @RequestBody Map<String, Object> body) {

        String name = (String) body.get("name");
        Object amountRaw = body.get("amount");
        String dueDate = (String) body.get("dueDate");

        if (name == null || amountRaw == null || dueDate == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        }

        BigDecimal amount = new BigDecimal(String.valueOf(amountRaw));
        String status = body.containsKey("status") ? (String) body.get("status") : "pending";
        String notes = (String) body.get("notes");

        List<Map<String, Object>> results = jdbc.query(
            "INSERT INTO installments (user_id, name, amount, due_date, status, notes) "
            + "VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
            this::mapInstallment, userId, name, amount, dueDate, status, notes);

        if (results.isEmpty()) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Insert failed"));
        }
        return ResponseEntity.status(201).body(results.get(0));
    }

    @GetMapping("/installments/upcoming")
    public ResponseEntity<Map<String, Object>> upcoming(
            @RequestAttribute("userId") String userId) {

        String today = LocalDate.now().toString();
        String sevenDaysLater = LocalDate.now().plusDays(7).toString();

        List<Map<String, Object>> installments = jdbc.query(
            "SELECT * FROM installments WHERE user_id = ? AND status = 'pending' "
            + "AND due_date >= ?::date AND due_date <= ?::date ORDER BY due_date",
            this::mapInstallment, userId, today, sevenDaysLater);

        return ResponseEntity.ok(Map.of("installments", installments));
    }

    @PatchMapping("/installments/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @RequestAttribute("userId") String userId,
            @PathVariable int id,
            @RequestBody Map<String, Object> body) {

        List<Map<String, Object>> existing = jdbc.query(
            "SELECT * FROM installments WHERE id = ? AND user_id = ?",
            this::mapInstallment, id, userId);
        if (existing.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Installment not found"));
        }

        StringBuilder sql = new StringBuilder("UPDATE installments SET ");
        List<Object> params = new ArrayList<>();
        boolean first = true;

        if (body.containsKey("name")) {
            sql.append("name = ?"); params.add(body.get("name")); first = false;
        }
        if (body.containsKey("amount")) {
            if (!first) sql.append(", ");
            sql.append("amount = ?");
            params.add(new BigDecimal(String.valueOf(body.get("amount"))));
            first = false;
        }
        if (body.containsKey("dueDate")) {
            if (!first) sql.append(", "); sql.append("due_date = ?"); params.add(body.get("dueDate")); first = false;
        }
        if (body.containsKey("status")) {
            if (!first) sql.append(", "); sql.append("status = ?"); params.add(body.get("status")); first = false;
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

        List<Map<String, Object>> results = jdbc.query(
            sql.toString(), this::mapInstallment, params.toArray());
        if (results.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Installment not found"));
        }
        return ResponseEntity.ok(results.get(0));
    }

    @PatchMapping("/installments/{id}/mark-paid")
    public ResponseEntity<Map<String, Object>> markPaid(
            @RequestAttribute("userId") String userId,
            @PathVariable int id) {

        List<Map<String, Object>> results = jdbc.query(
            "UPDATE installments SET status = 'paid' WHERE id = ? AND user_id = ? RETURNING *",
            this::mapInstallment, id, userId);

        if (results.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Installment not found"));
        }
        return ResponseEntity.ok(results.get(0));
    }

    @DeleteMapping("/installments/{id}")
    public ResponseEntity<Void> delete(
            @RequestAttribute("userId") String userId,
            @PathVariable int id) {

        List<Map<String, Object>> results = jdbc.query(
            "DELETE FROM installments WHERE id = ? AND user_id = ? RETURNING id",
            (rs, n) -> Map.of("id", rs.getInt("id")), id, userId);

        if (results.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
