package com.budgetarian.controller;

import com.budgetarian.storage.ObjectStorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class WarrantiesController {

    private final JdbcTemplate jdbc;
    private final ObjectStorageService objectStorage;

    public WarrantiesController(JdbcTemplate jdbc, ObjectStorageService objectStorage) {
        this.jdbc = jdbc;
        this.objectStorage = objectStorage;
    }

    private Map<String, Object> mapWarranty(ResultSet rs, int rowNum) throws SQLException {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", rs.getInt("id"));
        m.put("userId", rs.getString("user_id"));
        m.put("productName", rs.getString("product_name"));
        m.put("store", rs.getString("store"));
        LocalDate purchaseDate = rs.getObject("purchase_date", LocalDate.class);
        m.put("purchaseDate", purchaseDate != null ? purchaseDate.toString() : null);
        LocalDate expiryDate = rs.getObject("expiry_date", LocalDate.class);
        m.put("expiryDate", expiryDate != null ? expiryDate.toString() : null);
        m.put("receiptPath", rs.getString("receipt_path"));
        m.put("notes", rs.getString("notes"));
        Timestamp createdAt = rs.getTimestamp("created_at");
        m.put("createdAt", createdAt != null ? createdAt.toInstant().toString() : null);
        return m;
    }

    @GetMapping("/warranties")
    public ResponseEntity<Map<String, Object>> list(
            @RequestAttribute("userId") String userId) {
        List<Map<String, Object>> warranties = jdbc.query(
            "SELECT * FROM warranties WHERE user_id = ? ORDER BY expiry_date",
            this::mapWarranty, userId);
        return ResponseEntity.ok(Map.of("warranties", warranties));
    }

    @PostMapping("/warranties")
    public ResponseEntity<Map<String, Object>> create(
            @RequestAttribute("userId") String userId,
            @RequestBody Map<String, Object> body) {

        String productName = (String) body.get("productName");
        String purchaseDate = (String) body.get("purchaseDate");
        String expiryDate = (String) body.get("expiryDate");

        if (productName == null || purchaseDate == null || expiryDate == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required fields"));
        }

        String store = (String) body.get("store");
        String receiptPath = (String) body.get("receiptPath");
        String notes = (String) body.get("notes");

        List<Map<String, Object>> results = jdbc.query(
            "INSERT INTO warranties (user_id, product_name, store, purchase_date, expiry_date, receipt_path, notes) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *",
            this::mapWarranty,
            userId, productName, store, purchaseDate, expiryDate, receiptPath, notes);

        if (results.isEmpty()) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Insert failed"));
        }

        Map<String, Object> warranty = results.get(0);

        if (receiptPath != null) {
            trySetReceiptOwner(receiptPath, userId);
        }

        return ResponseEntity.status(201).body(warranty);
    }

    @GetMapping("/warranties/expiring-soon")
    public ResponseEntity<Map<String, Object>> expiringSoon(
            @RequestAttribute("userId") String userId) {

        String today = LocalDate.now().toString();
        String thirtyDaysLater = LocalDate.now().plusDays(30).toString();

        List<Map<String, Object>> warranties = jdbc.query(
            "SELECT * FROM warranties WHERE user_id = ? "
            + "AND expiry_date >= ?::date AND expiry_date <= ?::date ORDER BY expiry_date",
            this::mapWarranty, userId, today, thirtyDaysLater);

        return ResponseEntity.ok(Map.of("warranties", warranties));
    }

    @PatchMapping("/warranties/{id}")
    public ResponseEntity<Map<String, Object>> update(
            @RequestAttribute("userId") String userId,
            @PathVariable int id,
            @RequestBody Map<String, Object> body) {

        List<Map<String, Object>> existing = jdbc.query(
            "SELECT * FROM warranties WHERE id = ? AND user_id = ?",
            this::mapWarranty, id, userId);
        if (existing.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Warranty not found"));
        }

        StringBuilder sql = new StringBuilder("UPDATE warranties SET ");
        List<Object> params = new ArrayList<>();
        boolean first = true;

        if (body.containsKey("productName")) {
            sql.append("product_name = ?"); params.add(body.get("productName")); first = false;
        }
        if (body.containsKey("store")) {
            if (!first) sql.append(", "); sql.append("store = ?"); params.add(body.get("store")); first = false;
        }
        if (body.containsKey("purchaseDate")) {
            if (!first) sql.append(", "); sql.append("purchase_date = ?"); params.add(body.get("purchaseDate")); first = false;
        }
        if (body.containsKey("expiryDate")) {
            if (!first) sql.append(", "); sql.append("expiry_date = ?"); params.add(body.get("expiryDate")); first = false;
        }
        if (body.containsKey("receiptPath")) {
            if (!first) sql.append(", "); sql.append("receipt_path = ?"); params.add(body.get("receiptPath")); first = false;
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
            sql.toString(), this::mapWarranty, params.toArray());
        if (results.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Warranty not found"));
        }

        Map<String, Object> warranty = results.get(0);

        if (body.containsKey("receiptPath") && body.get("receiptPath") != null) {
            trySetReceiptOwner((String) body.get("receiptPath"), userId);
        }

        return ResponseEntity.ok(warranty);
    }

    @DeleteMapping("/warranties/{id}")
    public ResponseEntity<Void> delete(
            @RequestAttribute("userId") String userId,
            @PathVariable int id) {

        List<Map<String, Object>> results = jdbc.query(
            "DELETE FROM warranties WHERE id = ? AND user_id = ? RETURNING id",
            (rs, n) -> Map.of("id", rs.getInt("id")), id, userId);

        if (results.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }

    private void trySetReceiptOwner(String receiptPath, String userId) {
        try {
            objectStorage.trySetObjectEntityAclPolicy(receiptPath, userId, "private");
        } catch (Exception e) {
            // best-effort: log but don't block
            System.err.println("Warning: failed to set receipt ACL for " + receiptPath + ": " + e.getMessage());
        }
    }
}
