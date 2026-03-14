package com.gscix.backend.service;

import com.gscix.backend.dto.HpiAnalysisResponse;
import com.gscix.backend.dto.HpiTrendPoint;
import com.gscix.backend.model.GscixEntity;
import com.gscix.backend.model.GscixRelation;
import com.gscix.backend.repository.GscixEntityRepository;
import com.gscix.backend.repository.GscixRelationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RiskAnalyticsEngine {
        private static final Logger logger = LoggerFactory.getLogger(RiskAnalyticsEngine.class);

        private final GscixEntityRepository entityRepository;
        private final GscixRelationRepository relationRepository;

        public HpiAnalysisResponse calculateWeightedHpi(String actorId) {
                logger.info("Calculating weighted HPI for actor: {}", actorId);

                // 1. Get all assessments evaluating this actor directly
                List<GscixEntity> actorAssessments = getAssessmentsForTarget(actorId);

                // 2. Get all campaigns executed by this actor
                List<GscixRelation> executesRelations = relationRepository.findBySourceRefAndRelationshipType(actorId,
                                "executes");

                // 3. Get assessments evaluating those campaigns
                List<GscixEntity> campaignAssessments = new ArrayList<>();
                for (GscixRelation relation : executesRelations) {
                        campaignAssessments.addAll(getAssessmentsForTarget(relation.getTargetRef()));
                }

                // Combine and filter by confidence_score > 80%
                List<GscixEntity> allAssessments = new ArrayList<>();
                allAssessments.addAll(actorAssessments);
                allAssessments.addAll(campaignAssessments);

                List<GscixEntity> filteredAssessments = allAssessments.stream()
                                .filter(a -> a.getGsciAttributes() != null &&
                                                a.getGsciAttributes().getConfidenceScore() != null &&
                                                a.getGsciAttributes().getConfidenceScore() > 80.0)
                                .collect(Collectors.toList());

                if (filteredAssessments.isEmpty()) {
                        return HpiAnalysisResponse.builder()
                                        .current_hpi(0.0)
                                        .historical_avg(0.0)
                                        .spike_detected(false)
                                        .avg_confidence_score(0.0)
                                        .pressure_breakdown(new HashMap<>())
                                        .build();
                }

                Instant now = Instant.now();
                Instant twelveMonthsAgo = now.minus(365, ChronoUnit.DAYS);
                Instant tenYearsAgo = now.minus(3650, ChronoUnit.DAYS);
                Instant oneMonthAgo = now.minus(30, ChronoUnit.DAYS);

                // Temporal Decay Weights
                double recentWeight = 0.7;
                double historicalWeight = 0.3;

                List<GscixEntity> recentAssessments = new ArrayList<>();
                List<GscixEntity> historicalAssessments = new ArrayList<>();

                for (GscixEntity assessment : filteredAssessments) {
                        Instant lastSeen = assessment.getGsciAttributes().getLastSeen();
                        if (lastSeen == null)
                                continue;

                        if (lastSeen.isAfter(twelveMonthsAgo)) {
                                recentAssessments.add(assessment);
                        } else if (lastSeen.isAfter(tenYearsAgo)) {
                                historicalAssessments.add(assessment);
                        }
                }

                double avgRecentHpi = recentAssessments.stream()
                                .map(a -> a.getGsciAttributes().getHybridPressureIndex())
                                .filter(Objects::nonNull)
                                .mapToDouble(Double::doubleValue)
                                .average()
                                .orElse(0.0);

                double avgHistoricalHpi = historicalAssessments.stream()
                                .map(a -> a.getGsciAttributes().getHybridPressureIndex())
                                .filter(Objects::nonNull)
                                .mapToDouble(Double::doubleValue)
                                .average()
                                .orElse(0.0);

                double weightedHpi = (avgRecentHpi * recentWeight) + (avgHistoricalHpi * historicalWeight);
                // Normalize if one category is empty
                if (recentAssessments.isEmpty() && !historicalAssessments.isEmpty())
                        weightedHpi = avgHistoricalHpi;
                if (historicalAssessments.isEmpty() && !recentAssessments.isEmpty())
                        weightedHpi = avgRecentHpi;

                double totalHistoricalAvg = filteredAssessments.stream()
                                .map(a -> a.getGsciAttributes().getHybridPressureIndex())
                                .filter(Objects::nonNull)
                                .mapToDouble(Double::doubleValue)
                                .average()
                                .orElse(0.0);

                // Spike Detection: Cyber Geopolitical Coupling Index increase > 2.0 in the last
                // month
                boolean spikeDetected = detectSpike(filteredAssessments, oneMonthAgo);

                // Average Confidence Score
                double avgConfidenceScore = filteredAssessments.stream()
                                .map(a -> a.getGsciAttributes().getConfidenceScore())
                                .filter(Objects::nonNull)
                                .mapToDouble(Double::doubleValue)
                                .average()
                                .orElse(0.0);

                // Pressure Breakdown (Nature) and Predominant Vector
                Map<String, Integer> pressureBreakdown = new HashMap<>();
                boolean overrideCyber = false;

                for (GscixEntity assessment : filteredAssessments) {
                        // Check for > 8.0 Cyber-Geopolitical Coupling Index
                        Double cyberIndex = assessment.getGsciAttributes().getCyberGeopoliticalCouplingIndex();
                        if (cyberIndex != null && cyberIndex > 8.0) {
                                overrideCyber = true;
                        }

                        // Get campaigns evaluated by this assessment
                        List<GscixRelation> evaluatesRelations = relationRepository
                                        .findBySourceRefAndRelationshipType(assessment.getStixId(), "evaluates");
                        List<GscixEntity> campaigns = evaluatesRelations.stream()
                                        .map(r -> entityRepository.findById(r.getTargetRef()))
                                        .filter(Optional::isPresent)
                                        .map(Optional::get)
                                        .filter(e -> "x-hybrid-campaign".equals(e.getType()))
                                        .collect(Collectors.toList());

                        // Aggregate nature tags from those campaigns
                        for (GscixEntity campaign : campaigns) {
                                if (campaign.getGsciAttributes() != null
                                                && campaign.getGsciAttributes().getNature() != null) {
                                        for (String nature : campaign.getGsciAttributes().getNature()) {
                                                if (nature != null && !nature.trim().isEmpty()) {
                                                        String cleanNature = nature.trim().toLowerCase();
                                                        pressureBreakdown.put(cleanNature,
                                                                        pressureBreakdown.getOrDefault(cleanNature, 0)
                                                                                        + 1);
                                                }
                                        }
                                }
                        }
                }

                // Calculate Predominant Vector
                String predominantVector = "None";
                if (overrideCyber) {
                        predominantVector = "cyber";
                } else if (!pressureBreakdown.isEmpty()) {
                        predominantVector = Collections
                                        .max(pressureBreakdown.entrySet(), Comparator.comparingInt(Map.Entry::getValue))
                                        .getKey();
                }

                // Calculate Trend Data (time-series for chart)
                List<HpiTrendPoint> trendData = new ArrayList<>();
                List<GscixEntity> sortedAssessments = filteredAssessments.stream()
                                .filter(a -> a.getGsciAttributes().getLastSeen() != null
                                                && a.getGsciAttributes().getHybridPressureIndex() != null)
                                .sorted((a, b) -> a.getGsciAttributes().getLastSeen()
                                                .compareTo(b.getGsciAttributes().getLastSeen()))
                                .collect(Collectors.toList());

                double runningSum = 0.0;
                for (int i = 0; i < sortedAssessments.size(); i++) {
                        GscixEntity sa = sortedAssessments.get(i);
                        double hpiVal = sa.getGsciAttributes().getHybridPressureIndex();
                        runningSum += hpiVal;
                        double drift = runningSum / (i + 1);
                        trendData.add(HpiTrendPoint.builder()
                                        .date(sa.getGsciAttributes().getLastSeen().toString())
                                        .hpi(hpiVal)
                                        .drift(Math.round(drift * 10.0) / 10.0)
                                        .build());
                }

                // Calculate Max Doctrine-Capacity Divergence Score
                Double maxDivergenceScore = filteredAssessments.stream()
                                .map(a -> a.getGsciAttributes().getDoctrineCapacityDivergenceScore())
                                .filter(Objects::nonNull)
                                .mapToDouble(Double::doubleValue)
                                .max()
                                .orElse(0.0);

                return HpiAnalysisResponse.builder()
                                .current_hpi(weightedHpi)
                                .historical_avg(totalHistoricalAvg)
                                .spike_detected(spikeDetected)
                                .avg_confidence_score(avgConfidenceScore)
                                .pressure_breakdown(pressureBreakdown)
                                .predominant_vector(predominantVector)
                                .trend_data(trendData)
                                .max_divergence_score(maxDivergenceScore)
                                .build();
        }

        private List<GscixEntity> getAssessmentsForTarget(String targetId) {
                List<GscixRelation> relations = relationRepository.findByTargetRefAndRelationshipType(targetId,
                                "evaluates");
                return relations.stream()
                                .map(r -> entityRepository.findById(r.getSourceRef()))
                                .filter(Optional::isPresent)
                                .map(Optional::get)
                                .filter(e -> "x-strategic-assessment".equals(e.getType()))
                                .collect(Collectors.toList());
        }

        private boolean detectSpike(List<GscixEntity> assessments, Instant oneMonthAgo) {
                double currentMonthAvg = assessments.stream()
                                .filter(a -> a.getGsciAttributes().getLastSeen() != null
                                                && a.getGsciAttributes().getLastSeen().isAfter(oneMonthAgo))
                                .map(a -> a.getGsciAttributes().getCyberGeopoliticalCouplingIndex())
                                .filter(Objects::nonNull)
                                .mapToDouble(Double::doubleValue)
                                .average()
                                .orElse(0.0);

                double previousAvg = assessments.stream()
                                .filter(a -> a.getGsciAttributes().getLastSeen() != null
                                                && a.getGsciAttributes().getLastSeen().isBefore(oneMonthAgo))
                                .map(a -> a.getGsciAttributes().getCyberGeopoliticalCouplingIndex())
                                .filter(Objects::nonNull)
                                .mapToDouble(Double::doubleValue)
                                .average()
                                .orElse(0.0);

                return (currentMonthAvg - previousAvg) > 2.0;
        }
}
