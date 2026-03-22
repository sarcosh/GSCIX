package com.gscix.backend.repository;

import com.gscix.backend.model.GscixRelation;
import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GscixRelationRepository extends ElasticsearchRepository<GscixRelation, String> {
    List<GscixRelation> findBySourceRef(String sourceRef);

    List<GscixRelation> findByTargetRef(String targetRef);

    List<GscixRelation> findBySourceRefAndRelationshipType(String sourceRef, String relationshipType);

    List<GscixRelation> findByTargetRefAndRelationshipType(String targetRef, String relationshipType);

    /**
     * Find all relations originating from a given source (e.g. "OPENCTI").
     * Used by the sync-delete logic to enumerate locally-stored OpenCTI relations.
     */
    @Query("{\"term\":{\"source\":\"?0\"}}")
    List<GscixRelation> findBySource(String source);
}
