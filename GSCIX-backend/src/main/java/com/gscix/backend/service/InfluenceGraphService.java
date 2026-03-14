package com.gscix.backend.service;

import com.gscix.backend.dto.InfluenceGraphResponse;
import com.gscix.backend.model.GscixEntity;
import com.gscix.backend.model.GscixRelation;
import com.gscix.backend.repository.GscixEntityRepository;
import com.gscix.backend.repository.GscixRelationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Service
public class InfluenceGraphService {

    private static final Logger log = LoggerFactory.getLogger(InfluenceGraphService.class);

    private final GscixEntityRepository entityRepository;
    private final GscixRelationRepository relationRepository;

    public InfluenceGraphService(GscixEntityRepository entityRepository, GscixRelationRepository relationRepository) {
        this.entityRepository = entityRepository;
        this.relationRepository = relationRepository;
    }

    /**
     * Build an influence subgraph starting from a root entity using BFS up to
     * maxDepth hops.
     * Returns only entities and relations within the reachable set.
     */
    public InfluenceGraphResponse buildSubgraph(String rootId, int maxDepth) {
        log.info("Building influence subgraph for root={} depth={}", rootId, maxDepth);

        // BFS to collect reachable entity IDs
        Set<String> reachableIds = new LinkedHashSet<>();
        reachableIds.add(rootId);

        Queue<Map.Entry<String, Integer>> queue = new LinkedList<>();
        queue.add(Map.entry(rootId, 0));

        // Collect all relations that touch reachable nodes
        Set<String> collectedRelationIds = new HashSet<>();
        List<GscixRelation> subgraphRelations = new ArrayList<>();

        while (!queue.isEmpty()) {
            Map.Entry<String, Integer> current = queue.poll();
            String currentId = current.getKey();
            int currentDepth = current.getValue();

            if (currentDepth >= maxDepth)
                continue;

            // Find relations where this entity is source or target
            List<GscixRelation> outgoing = relationRepository.findBySourceRef(currentId);
            List<GscixRelation> incoming = relationRepository.findByTargetRef(currentId);

            for (GscixRelation r : outgoing) {
                if (collectedRelationIds.add(r.getId())) {
                    subgraphRelations.add(r);
                }
                if (reachableIds.add(r.getTargetRef())) {
                    queue.add(Map.entry(r.getTargetRef(), currentDepth + 1));
                }
            }

            for (GscixRelation r : incoming) {
                if (collectedRelationIds.add(r.getId())) {
                    subgraphRelations.add(r);
                }
                if (reachableIds.add(r.getSourceRef())) {
                    queue.add(Map.entry(r.getSourceRef(), currentDepth + 1));
                }
            }
        }

        // Fetch the actual entity objects for all reachable IDs
        List<GscixEntity> subgraphEntities = StreamSupport
                .stream(entityRepository.findAllById(reachableIds).spliterator(), false)
                .collect(Collectors.toList());

        log.info("Subgraph built: {} entities, {} relations", subgraphEntities.size(), subgraphRelations.size());

        return InfluenceGraphResponse.builder()
                .entities(subgraphEntities)
                .relations(subgraphRelations)
                .rootId(rootId)
                .depth(maxDepth)
                .nodeCount(subgraphEntities.size())
                .edgeCount(subgraphRelations.size())
                .build();
    }

    /**
     * Build a graph showing all actors and their direct connections (1 hop).
     */
    public InfluenceGraphResponse buildActorsOverview() {
        log.info("Building actors overview graph");

        List<GscixEntity> actors = entityRepository.findByType("x-geo-strategic-actor");
        Set<String> reachableIds = new LinkedHashSet<>(actors.stream().map(GscixEntity::getStixId).toList());

        Set<String> collectedRelationIds = new HashSet<>();
        List<GscixRelation> subgraphRelations = new ArrayList<>();

        for (String actorId : new ArrayList<>(reachableIds)) {
            List<GscixRelation> outgoing = relationRepository.findBySourceRef(actorId);
            List<GscixRelation> incoming = relationRepository.findByTargetRef(actorId);

            for (GscixRelation r : outgoing) {
                if (collectedRelationIds.add(r.getId())) {
                    subgraphRelations.add(r);
                }
                reachableIds.add(r.getTargetRef());
            }
            for (GscixRelation r : incoming) {
                if (collectedRelationIds.add(r.getId())) {
                    subgraphRelations.add(r);
                }
                reachableIds.add(r.getSourceRef());
            }
        }

        List<GscixEntity> subgraphEntities = StreamSupport
                .stream(entityRepository.findAllById(reachableIds).spliterator(), false)
                .collect(Collectors.toList());

        log.info("Actors overview: {} entities, {} relations", subgraphEntities.size(), subgraphRelations.size());

        return InfluenceGraphResponse.builder()
                .entities(subgraphEntities)
                .relations(subgraphRelations)
                .rootId(null)
                .depth(1)
                .nodeCount(subgraphEntities.size())
                .edgeCount(subgraphRelations.size())
                .build();
    }
}
