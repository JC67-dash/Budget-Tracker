package com.budgetarian.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class GoalsController {

    private final JdbcTemplate jdbc;

    public GoalsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private Map<String, Object> mapGoal(ResultSet rs, int rowNum) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", rs.getInt("id"));
        m.put("userId", rs.getString("user_id"));
        m.put("name", rs.getString("name"));
        BigDecimal target = rs.getBigDecimal("target_amount");
        m.put("targetAmount", target != null ? target.doubleValue() : 0.0);
        BigDecimal saved = rs.getBigDecimal("saved_amount");
        m.put("savedAmount", saved != null ? saved.doubleValue() : 0.0);
        m.put("period", rs.getString("period"));
        m.put("notes", rs.getString("notes"));
        Timestamp createdAt = rs.getTimestamp("created_at");
        m.put("createdAt", createdAt != null ? createdAt.toInstant().toString() : null);
        return m;
    }

    @GetMapping("/goals")
    public ResponseEntity<Map<String, Object>> list(
            @RequestAttribute("userId") String userId) {
        List<Map<String, Object>> goals = jdbc.query(
            "SELECT * FROM goals WHERE user_id = ? ORDER BY created_at",
            this::mapGoal, userId);
        return ResponseEntity.ok(Map.of("goals", goals));
    }

    @PostMapping("/goals")
    public ResponseEntity<Map<String, Object>> create(
            @RequestAttribute("userId") String userId,
            @RequestBody Map<String, Object> body) {

        String name = (String) body.get("name");
        Object targetAmountRaw = body.get("targetAmount");
        if (name == null || targetAmountRaw == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        }

        BigDecimal targetAmount = new BigDecimal(String.valueOf(targetAmountRaw));
        Object savedAmountRaw = body.get("savedAmount");
        BigDecimal savedAmount = savedAmountRaw != null
            ? new BigDecimal(String.valueOf(savedAmountRaw))
            : BigDecimal.ZERO;
        String period = body.containsKey("period") ? (String) body.get("period") : "monthly";
        String notes = (String) body.get("notes");

        List<Map<String, Object>> results = jdbc.query(
            "INSERT INTO goals (user_id, name, target_amount, saved_amount, period, notes) "
            + "VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
            this::mapGoal, userId, name, targetAmount, savedAmount, period, notes);

        if (results.isEmpty()) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Insert failed"));
        }
        return ResponseEntity.status(201).body(results.get(0));
    }

    @PatchMapping("/goals/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @RequestAttribute("userId") String userId,
            @PathVariable int id,
            @RequestBody Map<String, Object> body) {

        List<Map<String, Object>> existing = jdbc.query(
            "SELECT * FROM goals WHERE id = ? AND user_id = ?",
            this::mapGoal, id, userId);
        if (existing.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Goal not found"));
        }

        StringBuilder sql = new StringBuilder("UPDATE goals SET ");
        List<Object> params = new ArrayList<>();
        boolean first = true;

        if (body.containsKey("name")) {
            sql.append("name = ?"); params.add(body.get("name")); first = false;
        }
        if (body.containsKey("targetAmount")) {
            if (!first) sql.append(", ");
            sql.append("target_amount = ?");
            params.add(new BigDecimal(String.valueOf(body.get("targetAmount"))));
            first = false;
        }
        if (body.containsKey("savedAmount")) {
            if (!first) sql.append(", ");
            sql.append("saved_amount = ?");
            params.add(new BigDecimal(String.valueOf(body.get("savedAmount"))));
            first = false;
        }
        if (body.containsKey("period")) {
            if (!first) sql.append(", "); sql.append("period = ?"); params.add(body.get("period")); first = false;
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

        List<Map<String, Object>> results = jdbc.query(sql.toString(), this::mapGoal, params.toArray());
        if (results.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Goal not found"));
        }
        return ResponseEntity.ok(results.get(0));
    }

    @DeleteMapping("/goals/{id}")
    public ResponseEntity<Void> delete(
            @RequestAttribute("userId") String userId,
            @PathVariable int id) {

        List<Map<String, Object>> results = jdbc.query(
            "DELETE FROM goals WHERE id = ? AND user_id = ? RETURNING id",
            (rs, n) -> Map.of("id", rs.getInt("id")), id, userId);

        if (results.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
