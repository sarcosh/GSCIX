package com.gscix.backend.repository;

import com.gscix.backend.model.GscixEntity;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GscixEntityRepository extends ElasticsearchRepository<GscixEntity, String> {
}
