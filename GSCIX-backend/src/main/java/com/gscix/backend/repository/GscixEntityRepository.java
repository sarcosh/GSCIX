package com.gscix.backend.repository;

import com.gscix.backend.model.GscixEntity;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GscixEntityRepository extends ElasticsearchRepository<GscixEntity, String> {
    List<GscixEntity> findByName(String name);
    List<GscixEntity> findByType(String type);
}
