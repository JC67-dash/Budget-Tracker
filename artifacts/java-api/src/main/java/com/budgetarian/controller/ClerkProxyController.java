package com.budgetarian.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Base64;
import java.util.Enumeration;
import java.util.Optional;

@RestController
public class ClerkProxyController {

    private static final String DEFAULT_CLERK_FAPI = "https://frontend-api.clerk.dev";
    private static final HttpClient httpClient = HttpClient.newBuilder().build();

    private static String resolveClerkFapi() {
        String pk = System.getenv("CLERK_PUBLISHABLE_KEY");
        if (pk == null || pk.isBlank()) {
            return DEFAULT_CLERK_FAPI;
        }
        int underscore = pk.indexOf('_', 3);
        if (underscore < 0) {
            return DEFAULT_CLERK_FAPI;
        }
        String encoded = pk.substring(underscore + 1);
        try {
            String padded = encoded;
            int rem = padded.length() % 4;
            if (rem != 0) {
                padded = padded + "====".substring(rem);
            }
            String decoded = new String(Base64.getUrlDecoder().decode(padded));
            String host = decoded.endsWith("$") ? decoded.substring(0, decoded.length() - 1) : decoded;
            if (host.isBlank()) {
                return DEFAULT_CLERK_FAPI;
            }
            return "https://" + host;
        } catch (IllegalArgumentException e) {
            return DEFAULT_CLERK_FAPI;
        }
    }

    private static final String CLERK_FAPI = resolveClerkFapi();

    @RequestMapping("/__clerk/**")
    public ResponseEntity<byte[]> proxy(HttpServletRequest request) throws Exception {

        String secretKey = System.getenv("CLERK_SECRET_KEY");
        if (secretKey == null || secretKey.isBlank()) {
            return ResponseEntity.notFound().build();
        }

        String servletPath = request.getServletPath();
        String targetPath = servletPath.replaceFirst("^/__clerk", "");
        String queryString = request.getQueryString();
        String targetUrl = CLERK_FAPI + (targetPath.isEmpty() ? "/" : targetPath)
                + (queryString != null ? "?" + queryString : "");

        String xfProto = request.getHeader("x-forwarded-proto");
        String protocol = (xfProto != null && !xfProto.isBlank())
                ? xfProto.split(",")[0].trim()
                : "https";
        String xfHost = request.getHeader("x-forwarded-host");
        String host;
        if (xfHost != null && !xfHost.isBlank()) {
            host = xfHost.split(",")[0].trim();
        } else {
            host = Optional.ofNullable(request.getHeader("host")).orElse(request.getServerName());
        }
        String proxyUrl = protocol + "://" + host + "/api/__clerk";

        byte[] bodyBytes = request.getInputStream().readAllBytes();

        HttpRequest.BodyPublisher bodyPublisher = bodyBytes.length > 0
                ? HttpRequest.BodyPublishers.ofByteArray(bodyBytes)
                : HttpRequest.BodyPublishers.noBody();

        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(targetUrl))
                .method(request.getMethod(), bodyPublisher);

        Enumeration<String> headerNames = request.getHeaderNames();
        if (headerNames != null) {
            while (headerNames.hasMoreElements()) {
                String name = headerNames.nextElement();
                if (name.equalsIgnoreCase("host")
                        || name.equalsIgnoreCase("content-length")
                        || name.equalsIgnoreCase("transfer-encoding")
                        || name.equalsIgnoreCase("connection")) {
                    continue;
                }
                reqBuilder.header(name, request.getHeader(name));
            }
        }

        reqBuilder.header("Clerk-Proxy-Url", proxyUrl);
        reqBuilder.header("Clerk-Secret-Key", secretKey);

        String xff = request.getHeader("x-forwarded-for");
        String clientIp = xff != null ? xff.split(",")[0].trim()
                : Optional.ofNullable(request.getRemoteAddr()).orElse("");
        if (!clientIp.isEmpty()) {
            reqBuilder.header("X-Forwarded-For", clientIp);
        }

        HttpResponse<byte[]> upstreamResp = httpClient.send(
                reqBuilder.build(), HttpResponse.BodyHandlers.ofByteArray());

        HttpHeaders responseHeaders = new HttpHeaders();
        upstreamResp.headers().map().forEach((name, values) -> {
            if (name.startsWith(":")
                    || name.equalsIgnoreCase("transfer-encoding")
                    || name.equalsIgnoreCase("connection")
                    || name.equalsIgnoreCase("content-length")) {
                return;
            }
            responseHeaders.addAll(name, values);
        });

        return ResponseEntity.status(upstreamResp.statusCode())
                .headers(responseHeaders)
                .body(upstreamResp.body());
    }
}
