package com.gscix.backend.dto;

public record StreamStatusDto(
        boolean active,
        String lastSyncAt,
        String lastError,
        int consecutiveFailures
) {}
