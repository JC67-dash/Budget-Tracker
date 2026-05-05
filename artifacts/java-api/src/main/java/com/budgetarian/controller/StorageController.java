package com.budgetarian.controller;

import com.budgetarian.storage.ObjectNotFoundError;
import com.budgetarian.storage.ObjectStorageService;
import com.google.cloud.storage.Blob;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class StorageController {

    private final ObjectStorageService objectStorage;

    public StorageController(ObjectStorageService objectStorage) {
        this.objectStorage = objectStorage;
    }

    @PostMapping("/storage/uploads/request-url")
    public ResponseEntity<Map<String, Object>> requestUploadUrl(
            @RequestAttribute("userId") String userId,
            @RequestBody Map<String, Object> body) {

        String name = (String) body.get("name");
        Object size = body.get("size");
        String contentType = (String) body.get("contentType");

        if (name == null || size == null || contentType == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing or invalid required fields"));
        }

        try {
            String uploadUrl = objectStorage.getObjectEntityUploadUrl();
            String objectPath = objectStorage.normalizeObjectEntityPath(uploadUrl);

            Map<String, Object> metadata = new LinkedHashMap<>();
            metadata.put("name", name);
            metadata.put("size", size);
            metadata.put("contentType", contentType);

            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("uploadURL", uploadUrl);
            resp.put("objectPath", objectPath);
            resp.put("metadata", metadata);
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "Failed to generate upload URL"));
        }
    }

    @GetMapping("/storage/public-objects/{*wildcardPath}")
    public void getPublicObject(
            @PathVariable String wildcardPath,
            HttpServletResponse response) throws IOException {

        String filePath = wildcardPath.startsWith("/")
            ? wildcardPath.substring(1) : wildcardPath;

        try {
            Blob blob = objectStorage.searchPublicObject(filePath);
            if (blob == null) {
                response.setStatus(404);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"File not found\"}");
                return;
            }
            serveBlob(blob, true, response);
        } catch (Exception e) {
            response.setStatus(500);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Failed to serve public object\"}");
        }
    }

    @GetMapping("/storage/objects/{*wildcardPath}")
    public void getObject(
            @PathVariable String wildcardPath,
            @RequestAttribute("userId") String userId,
            HttpServletResponse response) throws IOException {

        String cleanPath = wildcardPath.startsWith("/")
            ? wildcardPath.substring(1) : wildcardPath;
        String objectPath = "/objects/" + cleanPath;

        try {
            Blob blob = objectStorage.getObjectEntityBlob(objectPath);

            if (!objectStorage.canAccessObjectEntity(userId, blob)) {
                response.setStatus(403);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"Forbidden\"}");
                return;
            }

            serveBlob(blob, false, response);
        } catch (ObjectNotFoundError e) {
            response.setStatus(404);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Object not found\"}");
        } catch (Exception e) {
            response.setStatus(500);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Failed to serve object\"}");
        }
    }

    private void serveBlob(Blob blob, boolean isPublic, HttpServletResponse response)
            throws IOException {
        String contentType = blob.getContentType();
        response.setContentType(contentType != null ? contentType : "application/octet-stream");

        boolean pub = isPublic || objectStorage.isPublicBlob(blob);
        response.setHeader("Cache-Control", (pub ? "public" : "private") + ", max-age=3600");

        Long size = blob.getSize();
        if (size != null) {
            response.setContentLengthLong(size);
        }

        objectStorage.streamBlob(blob, response.getOutputStream());
    }
}
