package com.budgetarian.auth;

import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.JwkProviderBuilder;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;

import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

public class ClerkAuthInterceptor implements HandlerInterceptor {

    public static final String USER_ID_ATTRIBUTE = "userId";

    private volatile JwkProvider jwkProvider;
    private volatile String clerkDomain;

    private synchronized void ensureInitialized() {
        if (jwkProvider == null) {
            clerkDomain = resolveClerkDomain();
            String jwksUrl = "https://" + clerkDomain + "/.well-known/jwks.json";
            try {
                jwkProvider = new JwkProviderBuilder(new URL(jwksUrl))
                        .cached(10, 24, TimeUnit.HOURS)
                        .rateLimited(10, 1, TimeUnit.MINUTES)
                        .build();
            } catch (Exception e) {
                throw new RuntimeException("Failed to initialize JWKS provider from: " + jwksUrl, e);
            }
        }
    }

    private String resolveClerkDomain() {
        String customUrl = System.getenv("CLERK_JWKS_URL");
        if (customUrl != null && !customUrl.isBlank()) {
            try {
                return new URL(customUrl).getHost();
            } catch (Exception e) {
                throw new RuntimeException("Invalid CLERK_JWKS_URL: " + customUrl, e);
            }
        }

        String pubKey = System.getenv("VITE_CLERK_PUBLISHABLE_KEY");
        if (pubKey == null || pubKey.isBlank()) {
            throw new IllegalStateException(
                "Neither CLERK_JWKS_URL nor VITE_CLERK_PUBLISHABLE_KEY is set");
        }

        String[] parts = pubKey.split("_", 3);
        if (parts.length < 3) {
            throw new IllegalStateException(
                "Invalid VITE_CLERK_PUBLISHABLE_KEY format: " + pubKey);
        }

        String base64Part = parts[2];

        String decoded = new String(
            Base64.getUrlDecoder().decode(base64Part), StandardCharsets.UTF_8);
        return decoded.replace("$", "").trim();
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            sendUnauthorized(response, "Unauthorized");
            return false;
        }

        String token = authHeader.substring(7);
        try {
            ensureInitialized();

            DecodedJWT decoded = JWT.decode(token);
            String kid = decoded.getKeyId();

            RSAPublicKey publicKey = (RSAPublicKey) jwkProvider.get(kid).getPublicKey();
            Algorithm algorithm = Algorithm.RSA256(publicKey, null);

            String expectedIssuer = "https://" + clerkDomain;
            JWT.require(algorithm)
                .withIssuer(expectedIssuer)
                .build()
                .verify(token);

            String userId = decoded.getSubject();
            if (userId == null || userId.isBlank()) {
                sendUnauthorized(response, "Missing subject in token");
                return false;
            }

            request.setAttribute(USER_ID_ATTRIBUTE, userId);
            return true;
        } catch (Exception e) {
            sendUnauthorized(response, "Invalid token");
            return false;
        }
    }

    private void sendUnauthorized(HttpServletResponse response, String message) throws Exception {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
