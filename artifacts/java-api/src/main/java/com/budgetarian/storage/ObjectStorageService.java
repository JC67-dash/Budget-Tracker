package com.budgetarian.storage;

import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.channels.Channels;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ObjectStorageService {

    private static final String SIDECAR = "http://127.0.0.1:1106";
    private static final String ACL_METADATA_KEY = "custom:aclPolicy";

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();
    private volatile Storage storageClient;

    private Storage getStorage() {
        if (storageClient == null) {
            synchronized (this) {
                if (storageClient == null) {
                    String credJson = "{"
                        + "\"type\":\"external_account\","
                        + "\"audience\":\"replit\","
                        + "\"subject_token_type\":\"access_token\","
                        + "\"token_url\":\"" + SIDECAR + "/token\","
                        + "\"credential_source\":{"
                        +   "\"url\":\"" + SIDECAR + "/credential\","
                        +   "\"format\":{"
                        +     "\"type\":\"json\","
                        +     "\"subject_token_field_name\":\"access_token\""
                        +   "}"
                        + "},"
                        + "\"universe_domain\":\"googleapis.com\""
                        + "}";
                    try {
                        GoogleCredentials creds = GoogleCredentials.fromStream(
                            new ByteArrayInputStream(credJson.getBytes(StandardCharsets.UTF_8)));
                        storageClient = StorageOptions.newBuilder()
                            .setCredentials(creds)
                            .setProjectId("replit")
                            .build()
                            .getService();
                    } catch (IOException e) {
                        throw new RuntimeException("Failed to initialize GCS client", e);
                    }
                }
            }
        }
        return storageClient;
    }

    public String getPrivateObjectDir() {
        String dir = System.getenv("PRIVATE_OBJECT_DIR");
        if (dir == null || dir.isBlank()) {
            throw new IllegalStateException("PRIVATE_OBJECT_DIR environment variable is not set");
        }
        return dir;
    }

    public String[] getPublicObjectSearchPaths() {
        String pathsStr = System.getenv("PUBLIC_OBJECT_SEARCH_PATHS");
        if (pathsStr == null || pathsStr.isBlank()) {
            throw new IllegalStateException("PUBLIC_OBJECT_SEARCH_PATHS environment variable is not set");
        }
        Set<String> seen = new java.util.LinkedHashSet<>();
        for (String p : pathsStr.split(",")) {
            String trimmed = p.trim();
            if (!trimmed.isEmpty()) seen.add(trimmed);
        }
        return seen.toArray(new String[0]);
    }

    public Blob searchPublicObject(String filePath) {
        for (String searchPath : getPublicObjectSearchPaths()) {
            String fullPath = searchPath + "/" + filePath;
            BlobComponents bc = parseObjectPath(fullPath);
            Blob blob = getStorage().get(BlobId.of(bc.bucket, bc.object));
            if (blob != null && blob.exists()) {
                return blob;
            }
        }
        return null;
    }

    public Blob getObjectEntityBlob(String objectPath) {
        if (!objectPath.startsWith("/objects/")) {
            throw new ObjectNotFoundError();
        }
        String entityId = objectPath.substring("/objects/".length());
        if (entityId.isBlank()) {
            throw new ObjectNotFoundError();
        }
        String privateDir = getPrivateObjectDir();
        if (!privateDir.endsWith("/")) privateDir += "/";
        String fullPath = privateDir + entityId;
        BlobComponents bc = parseObjectPath(fullPath);
        Blob blob = getStorage().get(BlobId.of(bc.bucket, bc.object));
        if (blob == null || !blob.exists()) {
            throw new ObjectNotFoundError();
        }
        return blob;
    }

    public String getObjectEntityUploadUrl() throws IOException, InterruptedException {
        String privateDir = getPrivateObjectDir();
        if (!privateDir.endsWith("/")) privateDir += "/";
        String objectId = UUID.randomUUID().toString();
        String fullPath = privateDir + "uploads/" + objectId;
        BlobComponents bc = parseObjectPath(fullPath);
        return signObjectUrl(bc.bucket, bc.object, "PUT", 900);
    }

    public String normalizeObjectEntityPath(String rawPath) {
        if (!rawPath.startsWith("https://storage.googleapis.com/")) {
            return rawPath;
        }
        try {
            URI uri = URI.create(rawPath);
            String rawObjectPath = uri.getPath();
            String privateDir = getPrivateObjectDir();
            if (!privateDir.endsWith("/")) privateDir += "/";
            if (!rawObjectPath.startsWith(privateDir)) {
                return rawObjectPath;
            }
            String entityId = rawObjectPath.substring(privateDir.length());
            return "/objects/" + entityId;
        } catch (Exception e) {
            return rawPath;
        }
    }

    public void trySetObjectEntityAclPolicy(String rawPath, String owner,
                                             String visibility) {
        try {
            String normalizedPath = normalizeObjectEntityPath(rawPath);
            if (!normalizedPath.startsWith("/")) return;
            Blob blob = getObjectEntityBlob(normalizedPath);
            setAclPolicy(blob, owner, visibility);
        } catch (ObjectNotFoundError e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to set ACL policy", e);
        }
    }

    public boolean canAccessObjectEntity(String userId, Blob blob) {
        Map<String, String> metadata = blob.getMetadata();
        if (metadata == null) return false;
        String aclJson = metadata.get(ACL_METADATA_KEY);
        if (aclJson == null || aclJson.isBlank()) return false;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> acl = mapper.readValue(aclJson, Map.class);
            String visibility = (String) acl.get("visibility");
            if ("public".equals(visibility)) return true;
            String aclOwner = (String) acl.get("owner");
            return userId != null && userId.equals(aclOwner);
        } catch (Exception e) {
            return false;
        }
    }

    public boolean isPublicBlob(Blob blob) {
        Map<String, String> metadata = blob.getMetadata();
        if (metadata == null) return false;
        String aclJson = metadata.get(ACL_METADATA_KEY);
        if (aclJson == null || aclJson.isBlank()) return false;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> acl = mapper.readValue(aclJson, Map.class);
            return "public".equals(acl.get("visibility"));
        } catch (Exception e) {
            return false;
        }
    }

    public void streamBlob(Blob blob, OutputStream out) throws IOException {
        try (InputStream in = Channels.newInputStream(blob.reader())) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
        }
    }

    private void setAclPolicy(Blob blob, String owner, String visibility) throws Exception {
        Map<String, Object> aclPolicy = new LinkedHashMap<>();
        aclPolicy.put("owner", owner);
        aclPolicy.put("visibility", visibility);
        String aclJson = mapper.writeValueAsString(aclPolicy);

        Map<String, String> existingMeta = blob.getMetadata();
        Map<String, String> newMeta = existingMeta != null
            ? new HashMap<>(existingMeta)
            : new HashMap<>();
        newMeta.put(ACL_METADATA_KEY, aclJson);

        BlobInfo updatedInfo = blob.toBuilder().setMetadata(newMeta).build();
        getStorage().update(updatedInfo);
    }

    private String signObjectUrl(String bucket, String objectName,
                                 String method, int ttlSec)
            throws IOException, InterruptedException {
        Instant expiresAt = Instant.now().plusSeconds(ttlSec);
        Map<String, String> body = new LinkedHashMap<>();
        body.put("bucket_name", bucket);
        body.put("object_name", objectName);
        body.put("method", method);
        body.put("expires_at", expiresAt.toString());
        String bodyJson = mapper.writeValueAsString(body);

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create(SIDECAR + "/object-storage/signed-object-url"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(bodyJson))
            .build();

        HttpResponse<String> resp = http.send(req,
            HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() != 200) {
            throw new IOException("Sidecar signed URL failed: HTTP " + resp.statusCode());
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> json = mapper.readValue(resp.body(), Map.class);
        return (String) json.get("signed_url");
    }

    private BlobComponents parseObjectPath(String path) {
        if (!path.startsWith("/")) path = "/" + path;
        String[] parts = path.split("/", 3);
        if (parts.length < 3) {
            throw new IllegalArgumentException("Invalid object path: " + path);
        }
        return new BlobComponents(parts[1], parts[2]);
    }

    public record BlobComponents(String bucket, String object) {}
}
