package com.budgetarian.config;

import com.budgetarian.auth.ClerkAuthInterceptor;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
public class AppConfig implements WebMvcConfigurer {

    @Bean
    public DataSource dataSource() {
        String rawUrl = System.getenv("DATABASE_URL");
        if (rawUrl == null || rawUrl.isBlank()) {
            throw new IllegalStateException("DATABASE_URL environment variable is not set");
        }

        URI uri = URI.create(rawUrl);
        String host = uri.getHost();
        int port = uri.getPort() == -1 ? 5432 : uri.getPort();
        String path = uri.getPath();
        String rawQuery = uri.getRawQuery();

        String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + path
                + (rawQuery != null && !rawQuery.isEmpty() ? "?" + rawQuery : "");

        String userInfo = uri.getUserInfo();
        String username = "";
        String password = "";
        if (userInfo != null) {
            int sep = userInfo.indexOf(':');
            if (sep >= 0) {
                username = userInfo.substring(0, sep);
                password = userInfo.substring(sep + 1);
            } else {
                username = userInfo;
            }
        }

        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(jdbcUrl);
        ds.setUsername(username);
        ds.setPassword(password);
        ds.setMaximumPoolSize(10);
        ds.setConnectionTimeout(30000);
        return ds;
    }

    @Bean
    public ClerkAuthInterceptor clerkAuthInterceptor() {
        return new ClerkAuthInterceptor();
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(clerkAuthInterceptor())
                .addPathPatterns("/**")
                .excludePathPatterns(
                        "/tips",
                        "/health",
                        "/healthz",
                        "/storage/public-objects/**",
                        "/__clerk/**"
                );
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
