package com.gscix.backend.repository;

import com.gscix.backend.model.IngestionJob;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

import java.util.List;

public interface IngestionJobRepository extends ElasticsearchRepository<IngestionJob, String> {
    List<IngestionJob> findTop10ByOrderByTimestampDesc();
}
