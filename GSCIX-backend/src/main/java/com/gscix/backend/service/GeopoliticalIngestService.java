package com.gscix.backend.service;

import com.gscix.backend.model.GscixEntity;
import com.gscix.backend.model.GscixRelation;
import com.gscix.backend.repository.GscixEntityRepository;
import com.gscix.backend.repository.GscixRelationRepository;
import com.gscix.backend.service.dto.GeopoliticalIngestRequest;
import com.gscix.backend.service.dto.GeopoliticalIngestResponse;
import com.gscix.backend.service.dto.GraphQLResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.*;

/**
 * Service that processes geopolitical ingestion requests covering all GSCIX
 * custom schemas:
 * x-geo-strategic-actor, x-strategic-objective, x-hybrid-campaign,
 * x-influence-vector, x-strategic-impact, x-strategic-assessment.
 *
 * For each ingest, it:
 * 1. Creates GscixEntity entries for each schema type provided.
 * 2. Creates GscixRelation entries linking them together.
 * 3. Auto-discovers related Threat Actors in OpenCTI by name search.
 */
@Service
public class GeopoliticalIngestService {

    private static final Logger logger = LoggerFactory.getLogger(GeopoliticalIngestService.class);

    private static final String GSCI_EXTENSION_ID = "extension-definition--6b53a3e2-8947-414b-876a-7d499edec5b8";

    private final GscixEntityRepository entityRepository;
    private final GscixRelationRepository relationRepository;
    private final WebClient webClient;

    public GeopoliticalIngestService(
            GscixEntityRepository entityRepository,
            GscixRelationRepository relationRepository,
            @Value("${opencti.url}") String openctiUrl,
            @Value("${opencti.token}") String openctiToken) {
        this.entityRepository = entityRepository;
        this.relationRepository = relationRepository;
        this.webClient = WebClient.builder()
                .baseUrl(openctiUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + openctiToken)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public GeopoliticalIngestResponse ingest(GeopoliticalIngestRequest request) {
        logger.info("Starting geopolitical ingestion for actor: {}", request.getActorName());

        int entitiesCreated = 0;
        int relationsCreated = 0;

        // =====================================================================
        // 1. Create x-geo-strategic-actor
        // =====================================================================
        GscixEntity actor = createEntity(
                "x-geo-strategic-actor",
                request.getActorName(),
                request.getGeopoliticalContext(),
                "GSCIX-INGEST");
        GscixEntity.GsciAttributes actorAttrs = new GscixEntity.GsciAttributes();
        actorAttrs.setStrategicAlignment(request.getStrategicAlignment());
        actorAttrs.setGeopoliticalDoctrine(request.getGeopoliticalDoctrine());
        actorAttrs.setRevisionistIndex(request.getRevisionistIndex());
        actor.setGsciAttributes(actorAttrs);
        entityRepository.save(actor);
        entitiesCreated++;
        logger.info("Created x-geo-strategic-actor: {}", actor.getStixId());

        // =====================================================================
        // 2. Create x-strategic-objective entries
        // =====================================================================
        if (request.getObjectives() != null) {
            for (GeopoliticalIngestRequest.ObjectiveDTO obj : request.getObjectives()) {
                GscixEntity objective = createEntity(
                        "x-strategic-objective",
                        obj.getName() != null ? obj.getName() : obj.getDescription(),
                        obj.getDescription(),
                        "GSCIX-INGEST");
                GscixEntity.GsciAttributes objAttrs = new GscixEntity.GsciAttributes();
                objAttrs.setObjectiveType(obj.getObjectiveType());
                objAttrs.setPriorityLevel(obj.getPriorityLevel());
                objAttrs.setTimeHorizon(obj.getTimeHorizon());
                objective.setGsciAttributes(objAttrs);
                entityRepository.save(objective);
                entitiesCreated++;

                // Relation: actor --pursues--> objective
                relationsCreated += createRelation(actor.getStixId(), objective.getStixId(), "pursues", null);
            }
        }

        // =====================================================================
        // 3. Create x-hybrid-campaign
        // =====================================================================
        if (request.getCampaign() != null) {
            GeopoliticalIngestRequest.CampaignDTO camp = request.getCampaign();
            GscixEntity campaign = createEntity(
                    "x-hybrid-campaign",
                    camp.getName(),
                    camp.getDescription(),
                    "GSCIX-INGEST");
            GscixEntity.GsciAttributes campAttrs = new GscixEntity.GsciAttributes();
            campAttrs.setPhase(camp.getPhase());
            campAttrs.setIntegrationLevel(camp.getIntegrationLevel());
            campAttrs.setGeographicScope(camp.getGeographicScope());
            campAttrs.setEscalationRiskScore(camp.getEscalationRiskScore());
            campaign.setGsciAttributes(campAttrs);
            entityRepository.save(campaign);
            entitiesCreated++;

            // Relation: actor --executes--> campaign
            relationsCreated += createRelation(actor.getStixId(), campaign.getStixId(), "executes", null);

            // Relation: campaign --targets--> (General Context or specific target if
            // defined)
            if (camp.getGeographicScope() != null) {
                relationsCreated += createRelation(campaign.getStixId(), "identity--geographic-scope", "targets",
                        "Targeted region: " + camp.getGeographicScope());
            }
        }

        // =====================================================================
        // 4. Create x-influence-vector entries
        // =====================================================================
        if (request.getInfluenceVectors() != null) {
            for (GeopoliticalIngestRequest.InfluenceVectorDTO iv : request.getInfluenceVectors()) {
                GscixEntity vector = createEntity(
                        "x-influence-vector",
                        iv.getName(),
                        iv.getDescription(),
                        "GSCIX-INGEST");
                GscixEntity.GsciAttributes ivAttrs = new GscixEntity.GsciAttributes();
                ivAttrs.setNarrative(iv.getNarrative());
                ivAttrs.setChannel(iv.getChannel());
                ivAttrs.setTargetAudience(iv.getTargetAudience());
                vector.setGsciAttributes(ivAttrs);
                entityRepository.save(vector);
                entitiesCreated++;

                // If there's a campaign, link: campaign --integrates--> influence-vector
                if (request.getCampaign() != null) {
                    String campaignId = "x-hybrid-campaign--" + request.getCampaign().getName();
                    // Search for the campaign entity we just created
                    List<GscixEntity> campaigns = entityRepository.findByType("x-hybrid-campaign");
                    for (GscixEntity c : campaigns) {
                        if (c.getName() != null && c.getName().equals(request.getCampaign().getName())) {
                            relationsCreated += createRelation(c.getStixId(), vector.getStixId(), "integrates", null);
                            break;
                        }
                    }
                }

                // Relation: vector --targets--> (Target Audience)
                if (iv.getTargetAudience() != null) {
                    relationsCreated += createRelation(vector.getStixId(), "identity--target-audience", "targets",
                            "Targeted audience: " + iv.getTargetAudience());
                }
            }
        }

        // =====================================================================
        // 5. Create x-strategic-impact
        // =====================================================================
        if (request.getImpact() != null) {
            GeopoliticalIngestRequest.ImpactDTO imp = request.getImpact();
            GscixEntity impact = createEntity(
                    "x-strategic-impact",
                    imp.getName() != null ? imp.getName() : "Impact of " + request.getActorName(),
                    imp.getDescription(),
                    "GSCIX-INGEST");
            GscixEntity.GsciAttributes impAttrs = new GscixEntity.GsciAttributes();
            impAttrs.setPoliticalDestabilizationIndex(imp.getPoliticalDestabilizationIndex());
            impAttrs.setEconomicDisruptionIndex(imp.getEconomicDisruptionIndex());
            impAttrs.setAllianceFragmentationScore(imp.getAllianceFragmentationScore());
            impAttrs.setDeterrenceSignalStrength(imp.getDeterrenceSignalStrength());
            impAttrs.setConfidenceScore(imp.getConfidenceScore());
            impact.setGsciAttributes(impAttrs);
            entityRepository.save(impact);
            entitiesCreated++;

            // Relation: actor --generates--> impact
            relationsCreated += createRelation(actor.getStixId(), impact.getStixId(), "generates", null);
        }

        // =====================================================================
        // 6. Create x-strategic-assessment
        // =====================================================================
        if (request.getAssessment() != null) {
            GeopoliticalIngestRequest.AssessmentDTO assess = request.getAssessment();
            GscixEntity assessment = createEntity(
                    "x-strategic-assessment",
                    assess.getName() != null ? assess.getName() : "Assessment of " + request.getActorName(),
                    assess.getDescription(),
                    "GSCIX-INGEST");
            GscixEntity.GsciAttributes assessAttrs = new GscixEntity.GsciAttributes();
            assessAttrs.setHybridPressureIndex(assess.getHybridPressureIndex());
            assessAttrs.setEscalationProbabilityScore(assess.getEscalationProbabilityScore());
            assessAttrs.setStrategicSignalingScore(assess.getStrategicSignalingScore());
            assessAttrs.setCyberGeopoliticalCouplingIndex(assess.getCyberGeopoliticalCouplingIndex());
            assessAttrs.setNarrativePenetrationScore(assess.getNarrativePenetrationScore());
            assessment.setGsciAttributes(assessAttrs);
            entityRepository.save(assessment);
            entitiesCreated++;

            // Relation: assessment --evaluates--> actor
            relationsCreated += createRelation(assessment.getStixId(), actor.getStixId(), "evaluates",
                    "Strategic evaluation of " + actor.getName());

            // Relation: assessment --evaluates--> campaign (if exists)
            if (request.getCampaign() != null) {
                List<GscixEntity> campaigns = entityRepository.findByType("x-hybrid-campaign");
                for (GscixEntity c : campaigns) {
                    if (c.getName() != null && c.getName().equals(request.getCampaign().getName())) {
                        relationsCreated += createRelation(assessment.getStixId(), c.getStixId(), "evaluates",
                                "Performance evaluation of campaign " + c.getName());
                        break;
                    }
                }
            }

            // Relation: assessment --evaluates--> impact (if exists)
            if (request.getImpact() != null) {
                List<GscixEntity> impacts = entityRepository.findByType("x-strategic-impact");
                for (GscixEntity i : impacts) {
                    if (i.getName() != null && i.getMetadata().getCreatedAt().isAfter(Instant.now().minusSeconds(10))) {
                        relationsCreated += createRelation(assessment.getStixId(), i.getStixId(), "evaluates",
                                "Effectiveness assessment");
                        break;
                    }
                }
            }
        }

        // =====================================================================
        // 7. Auto-Discovery: Search OpenCTI for matching Threat Actors
        // =====================================================================
        List<GeopoliticalIngestResponse.OpenCtiMatch> matches = autoDiscoverOpenCti(actor,
                request.getGeopoliticalDoctrine());
        for (GeopoliticalIngestResponse.OpenCtiMatch match : matches) {
            relationsCreated += createRelation(actor.getStixId(), match.getStandardId(), match.getRelationshipType(),
                    "Automated linkage via OpenCTI Discovery");
        }

        // =====================================================================
        // Build response
        // =====================================================================
        GeopoliticalIngestResponse response = new GeopoliticalIngestResponse();
        response.setStatus("OK");
        response.setMessage(String.format(
                "Ingested actor '%s' with %d entities and %d relations. Found %d OpenCTI matches.",
                request.getActorName(), entitiesCreated, relationsCreated, matches.size()));
        response.setActorEntityId(actor.getStixId());
        response.setEntitiesCreated(entitiesCreated);
        response.setRelationsCreated(relationsCreated);
        response.setOpenctiMatches(matches);

        logger.info("Ingestion complete: {} entities, {} relations, {} OpenCTI matches",
                entitiesCreated, relationsCreated, matches.size());
        return response;
    }

    // =========================================================================
    // Helper methods
    // =========================================================================

    private GscixEntity createEntity(String type, String name, String description, String source) {
        GscixEntity entity = new GscixEntity();
        entity.setStixId(type + "--" + UUID.randomUUID());
        entity.setExtensions(java.util.Collections.singletonList(GSCI_EXTENSION_ID));
        entity.setType(type);
        entity.setName(name);
        entity.setDescription(description);
        entity.setSource(source);

        GscixEntity.EntityMetadata metadata = new GscixEntity.EntityMetadata();
        metadata.setCreatedAt(Instant.now());
        metadata.setUpdatedAt(Instant.now());
        entity.setMetadata(metadata);

        return entity;
    }

    private int createRelation(String sourceRef, String targetRef, String relationshipType, String description) {
        GscixRelation relation = new GscixRelation();
        relation.setId("relationship--" + UUID.randomUUID());
        relation.setExtensions(java.util.Collections.singletonList(GSCI_EXTENSION_ID));
        relation.setSourceRef(sourceRef);
        relation.setTargetRef(targetRef);
        relation.setRelationshipType(relationshipType);
        relation.setDescription(description);
        relation.setStartTime(Instant.now());
        relation.setConfidence(75);
        relationRepository.save(relation);
        logger.debug("Created relation: {} --{}--> {}", sourceRef, relationshipType, targetRef);
        return 1;
    }

    /**
     * Queries OpenCTI GraphQL API searching for Threat Actors whose name
     * matches the ingested actor, and returns matches with relationship types
     * based on the x-geo-strategic-actor schema (controls, sponsors).
     */
    private List<GeopoliticalIngestResponse.OpenCtiMatch> autoDiscoverOpenCti(GscixEntity actor, String doctrine) {
        List<GeopoliticalIngestResponse.OpenCtiMatch> matches = new ArrayList<>();

        // Determine relationship type: controls (state units) vs sponsors (proxies)
        String relType = "sponsors";
        if (doctrine != null
                && (doctrine.toLowerCase().contains("unit") || doctrine.toLowerCase().contains("command"))) {
            relType = "controls";
        }

        String query = String.format("""
                query SearchThreatActors {
                  threatActors(search: "%s", first: 20) {
                    edges {
                      node {
                        id
                        standard_id
                        name
                        description
                        entity_type
                      }
                    }
                  }
                }
                """, actor.getName());

        try {
            GraphQLResponse response = webClient.post()
                    .uri("/graphql")
                    .bodyValue(Map.of("query", query))
                    .retrieve()
                    .bodyToMono(GraphQLResponse.class)
                    .block();

            if (response != null && response.getData() != null && response.getData().getThreatActors() != null) {
                for (GraphQLResponse.Edge edge : response.getData().getThreatActors().getEdges()) {
                    GraphQLResponse.Node node = edge.getNode();
                    if (node.getStandard_id() == null)
                        continue;

                    GeopoliticalIngestResponse.OpenCtiMatch match = new GeopoliticalIngestResponse.OpenCtiMatch();
                    match.setName(node.getName());
                    match.setOpenctiId(node.getId());
                    match.setStandardId(node.getStandard_id());
                    match.setRelationshipType(relType);
                    matches.add(match);

                    logger.info("Auto-discovered OpenCTI Threat Actor: {} ({})", node.getName(), node.getStandard_id());
                }
            }
        } catch (Exception e) {
            logger.warn("OpenCTI auto-discovery failed (non-blocking): {}", e.getMessage());
        }

        return matches;
    }
}
