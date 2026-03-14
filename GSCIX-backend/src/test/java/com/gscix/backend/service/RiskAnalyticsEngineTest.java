package com.gscix.backend.service;

import com.gscix.backend.dto.HpiAnalysisResponse;
import com.gscix.backend.model.GscixEntity.GsciAttributes;
import com.gscix.backend.model.GscixEntity;
import com.gscix.backend.model.GscixRelation;
import com.gscix.backend.repository.GscixEntityRepository;
import com.gscix.backend.repository.GscixRelationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RiskAnalyticsEngineTest {

    @Mock
    private GscixEntityRepository entityRepository;

    @Mock
    private GscixRelationRepository relationRepository;

    @InjectMocks
    private RiskAnalyticsEngine engine;

    @Test
    void testPredominantVector_KineticPredominant() {
        String actorId = "actor-1";
        String assessmentId = "assessment-1";
        String campaign1Id = "campaign-1";
        String campaign2Id = "campaign-2";

        // Setup Actor Assessment
        GscixRelation evaluatesActorRel = new GscixRelation();
        evaluatesActorRel.setSourceRef(assessmentId);
        evaluatesActorRel.setTargetRef(actorId);
        when(relationRepository.findByTargetRefAndRelationshipType(actorId, "evaluates"))
                .thenReturn(Collections.singletonList(evaluatesActorRel));

        GscixEntity assessment = new GscixEntity();
        assessment.setStixId(assessmentId);
        assessment.setType("x-strategic-assessment");
        GsciAttributes assessmentAttrs = new GsciAttributes();
        assessmentAttrs.setConfidenceScore(85.0);
        assessmentAttrs.setHybridPressureIndex(5.0);
        assessmentAttrs.setCyberGeopoliticalCouplingIndex(3.0); // No override
        assessmentAttrs.setLastSeen(Instant.now().minus(10, ChronoUnit.DAYS));
        assessment.setGsciAttributes(assessmentAttrs);

        when(entityRepository.findById(assessmentId)).thenReturn(Optional.of(assessment));

        // Ensure no campaigns evaluated the actor directly (for simplification)
        when(relationRepository.findBySourceRefAndRelationshipType(actorId, "executes"))
                .thenReturn(Collections.emptyList());

        // Setup Campaigns Evaluated by Assessment
        GscixRelation evaluatesCampaign1Rel = new GscixRelation();
        evaluatesCampaign1Rel.setSourceRef(assessmentId);
        evaluatesCampaign1Rel.setTargetRef(campaign1Id);

        GscixRelation evaluatesCampaign2Rel = new GscixRelation();
        evaluatesCampaign2Rel.setSourceRef(assessmentId);
        evaluatesCampaign2Rel.setTargetRef(campaign2Id);

        when(relationRepository.findBySourceRefAndRelationshipType(assessmentId, "evaluates"))
                .thenReturn(Arrays.asList(evaluatesCampaign1Rel, evaluatesCampaign2Rel));

        // Campaign 1: Kinetic
        GscixEntity campaign1 = new GscixEntity();
        campaign1.setStixId(campaign1Id);
        campaign1.setType("x-hybrid-campaign");
        GsciAttributes camp1Attrs = new GsciAttributes();
        camp1Attrs.setNature(Arrays.asList("kinetic"));
        campaign1.setGsciAttributes(camp1Attrs);

        // Campaign 2: Kinetic and Cyber
        GscixEntity campaign2 = new GscixEntity();
        campaign2.setStixId(campaign2Id);
        campaign2.setType("x-hybrid-campaign");
        GsciAttributes camp2Attrs = new GsciAttributes();
        camp2Attrs.setNature(Arrays.asList("kinetic", "cyber"));
        campaign2.setGsciAttributes(camp2Attrs);

        when(entityRepository.findById(campaign1Id)).thenReturn(Optional.of(campaign1));
        when(entityRepository.findById(campaign2Id)).thenReturn(Optional.of(campaign2));

        // Execute
        HpiAnalysisResponse response = engine.calculateWeightedHpi(actorId);

        // Verify
        assertNotNull(response);
        assertEquals("kinetic", response.getPredominant_vector());
        assertEquals(2, response.getPressure_breakdown().get("kinetic"));
        assertEquals(1, response.getPressure_breakdown().get("cyber"));
    }

    @Test
    void testPredominantVector_CyberOverride() {
        String actorId = "actor-1";
        String assessmentId = "assessment-1";
        String campaign1Id = "campaign-1";

        // Setup Actor Assessment
        GscixRelation evaluatesActorRel = new GscixRelation();
        evaluatesActorRel.setSourceRef(assessmentId);
        evaluatesActorRel.setTargetRef(actorId);
        when(relationRepository.findByTargetRefAndRelationshipType(actorId, "evaluates"))
                .thenReturn(Collections.singletonList(evaluatesActorRel));

        GscixEntity assessment = new GscixEntity();
        assessment.setStixId(assessmentId);
        assessment.setType("x-strategic-assessment");
        GsciAttributes assessmentAttrs = new GsciAttributes();
        assessmentAttrs.setConfidenceScore(90.0);
        assessmentAttrs.setHybridPressureIndex(8.0);
        assessmentAttrs.setCyberGeopoliticalCouplingIndex(9.5); // OVERRIDE! > 8.0
        assessmentAttrs.setLastSeen(Instant.now());
        assessment.setGsciAttributes(assessmentAttrs);

        when(entityRepository.findById(assessmentId)).thenReturn(Optional.of(assessment));

        when(relationRepository.findBySourceRefAndRelationshipType(actorId, "executes"))
                .thenReturn(Collections.emptyList());

        // Setup Campaigns
        GscixRelation evaluatesCampaign1Rel = new GscixRelation();
        evaluatesCampaign1Rel.setSourceRef(assessmentId);
        evaluatesCampaign1Rel.setTargetRef(campaign1Id);

        when(relationRepository.findBySourceRefAndRelationshipType(assessmentId, "evaluates"))
                .thenReturn(Collections.singletonList(evaluatesCampaign1Rel));

        // Campaign 1: Only Kinetic (even though there's no cyber, the override should
        // force it)
        GscixEntity campaign1 = new GscixEntity();
        campaign1.setStixId(campaign1Id);
        campaign1.setType("x-hybrid-campaign");
        GsciAttributes camp1Attrs = new GsciAttributes();
        camp1Attrs.setNature(Arrays.asList("kinetic", "cognitive")); // 1 kinetic, 1 cognitive
        campaign1.setGsciAttributes(camp1Attrs);

        when(entityRepository.findById(campaign1Id)).thenReturn(Optional.of(campaign1));

        // Execute
        HpiAnalysisResponse response = engine.calculateWeightedHpi(actorId);

        // Verify
        assertNotNull(response);
        assertEquals("cyber", response.getPredominant_vector()); // Cyber should override
        assertEquals(1, response.getPressure_breakdown().get("kinetic"));
        assertEquals(1, response.getPressure_breakdown().get("cognitive"));
        assertNull(response.getPressure_breakdown().get("cyber")); // It's not in the map, but it is the vector!
    }
}
