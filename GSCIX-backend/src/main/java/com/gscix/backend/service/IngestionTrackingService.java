package com.gscix.backend.service;

import com.gscix.backend.model.IngestionJob;
import com.gscix.backend.repository.IngestionJobRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class IngestionTrackingService {

    private final IngestionJobRepository repository;

    public IngestionTrackingService(IngestionJobRepository repository) {
        this.repository = repository;
    }

    public IngestionJob logJob(String filename, String status, String message, int entities, int relations) {
        IngestionJob job = new IngestionJob();
        job.setId(UUID.randomUUID().toString());
        job.setFilename(filename);
        job.setStatus(status);
        job.setMessage(message);
        job.setTimestamp(Instant.now());
        job.setEntitiesCreated(entities);
        job.setRelationsCreated(relations);
        return repository.save(job);
    }

    public List<IngestionJob> getRecentJobs() {
        return repository.findTop10ByOrderByTimestampDesc();
    }
}
