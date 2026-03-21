package com.gscix.backend.service;

import com.gscix.backend.dto.StreamStatusDto;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * In-memory singleton that tracks the health of the OpenCTI periodic sync.
 * Each @Scheduled method in OpenCtiSyncService calls recordSuccess() or
 * recordFailure() after every cycle. The combined state is exposed via getStatus().
 *
 * Active criteria:
 *   - lastSyncAt is not null (at least one successful sync has occurred)
 *   - consecutiveFailures == 0
 *   - lastSyncAt is within the last 3 minutes (3× the 60s schedule interval)
 */
@Service
public class StreamStatusService {

    private static final Duration STALENESS_THRESHOLD = Duration.ofMinutes(3);

    private volatile Instant lastSyncAt = null;
    private volatile String lastError = null;
    private volatile int consecutiveFailures = 0;

    /**
     * Record a successful sync cycle.
     */
    public synchronized void recordSuccess() {
        this.lastSyncAt = Instant.now();
        this.lastError = null;
        this.consecutiveFailures = 0;
    }

    /**
     * Record a failed sync cycle.
     */
    public synchronized void recordFailure(String errorMessage) {
        this.consecutiveFailures++;
        this.lastError = errorMessage;
    }

    /**
     * Build the current status DTO.
     */
    public synchronized StreamStatusDto getStatus() {
        boolean active = lastSyncAt != null
                && consecutiveFailures == 0
                && Duration.between(lastSyncAt, Instant.now()).compareTo(STALENESS_THRESHOLD) < 0;

        return new StreamStatusDto(
                active,
                lastSyncAt != null ? lastSyncAt.toString() : null,
                lastError,
                consecutiveFailures
        );
    }
}
