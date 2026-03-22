package com.gscix.backend.repository;

import com.gscix.backend.model.GscixEntity;
import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GscixEntityRepository extends ElasticsearchRepository<GscixEntity, String> {
    List<GscixEntity> findByName(String name);
    List<GscixEntity> findByType(String type);

    /**
     * Find an entity by exact type AND name match (case-insensitive via the
     * 'lowercase' normalizer on the name.keyword subfield).
     */
    @Query("{\"bool\":{\"must\":[{\"term\":{\"type\":\"?0\"}},{\"term\":{\"name.keyword\":\"?1\"}}]}}")
    Optional<GscixEntity> findByTypeAndNameKeyword(String type, String name);

    /**
     * Find an entity by type AND normalized dedup key (nameKey).
     * This is the primary dedup lookup during ingestion — it catches fuzzy
     * name variants (CamelCase, parenthetical qualifiers, roman numerals, etc.)
     * that the exact name.keyword match would miss.
     */
    @Query("{\"bool\":{\"must\":[{\"term\":{\"type\":\"?0\"}},{\"term\":{\"nameKey\":\"?1\"}}]}}")
    Optional<GscixEntity> findByTypeAndNameKey(String type, String nameKey);

    /**
     * Find all entities originating from a given source (e.g. "OPENCTI", "GSCIX").
     * Used by the sync-delete logic to enumerate locally-stored OpenCTI entities.
     */
    @Query("{\"term\":{\"source\":\"?0\"}}")
    List<GscixEntity> findBySource(String source);
}
