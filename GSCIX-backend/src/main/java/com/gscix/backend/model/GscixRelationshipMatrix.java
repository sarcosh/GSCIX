package com.gscix.backend.model;

import java.util.List;
import java.util.Map;

/**
 * GSCIX Relationship Matrix (Master Table).
 * <p>
 * Defines which relationship types are valid for each source→target entity type pair.
 * This is the single source of truth shared across all layers: CRUD API validation,
 * STIX Bundle ingestion, pre-import schema validation, and orphan auto-linking.
 * <p>
 * Source: custom_schemas/README.MD — GSCIX Relationship Matrix (GSCI Model)
 */
public final class GscixRelationshipMatrix {

    private GscixRelationshipMatrix() {
        // Utility class — no instantiation
    }

    /**
     * Map: sourceType → targetType → list of valid relationshipTypes.
     */
    public static final Map<String, Map<String, List<String>>> VALID_RELATIONS = Map.of(
            "x-geo-strategic-actor", Map.of(
                    "x-strategic-objective", List.of("pursues"),
                    "x-hybrid-campaign", List.of("executes"),
                    "x-strategic-impact", List.of("generates"),
                    "threat-actor", List.of("controls"),
                    "intrusion-set", List.of("sponsors")
            ),
            "x-hybrid-campaign", Map.of(
                    "x-influence-vector", List.of("integrates"),
                    "intrusion-set", List.of("integrates"),
                    "x-strategic-impact", List.of("generates"),
                    "identity", List.of("targets"),
                    "location", List.of("targets")
            ),
            "x-influence-vector", Map.of(
                    "identity", List.of("targets")
            ),
            "x-strategic-assessment", Map.of(
                    "x-geo-strategic-actor", List.of("evaluates"),
                    "x-hybrid-campaign", List.of("evaluates"),
                    "x-strategic-impact", List.of("evaluates")
            ),
            "intrusion-set", Map.of(
                    "threat-actor", List.of("attributed-to")
            )
    );

    /**
     * Validates that a relationship type is valid for the given source and target entity types.
     *
     * @return null if valid, or an error message string if invalid.
     */
    public static String validate(String sourceType, String targetType, String relationshipType) {
        Map<String, List<String>> targetMap = VALID_RELATIONS.get(sourceType);
        if (targetMap == null) {
            return "Source type '" + sourceType + "' cannot originate relationships. "
                    + "Valid source types: " + VALID_RELATIONS.keySet();
        }
        List<String> validTypes = targetMap.get(targetType);
        if (validTypes == null) {
            return "No valid relationships from '" + sourceType + "' to '" + targetType
                    + "'. Valid target types for '" + sourceType + "': " + targetMap.keySet();
        }
        if (!validTypes.contains(relationshipType)) {
            return "Relationship type '" + relationshipType + "' is not valid from '"
                    + sourceType + "' to '" + targetType + "'. Valid types: " + validTypes;
        }
        return null; // valid
    }

    /**
     * Resolves the correct relationship type and direction for linking a source
     * entity to a target entity according to the GSCIX matrix.
     * <p>
     * First tries sourceType → targetType (forward). If no match, tries the
     * reverse direction (targetType → sourceType) and swaps source/target.
     *
     * @return a {@link ResolvedRelation} with the correct source, target, and
     *         relationship type, or null if no valid relation exists.
     */
    public static ResolvedRelation resolve(String sourceId, String sourceType,
                                            String targetId, String targetType) {
        // Forward: source → target
        Map<String, List<String>> forwardTargets = VALID_RELATIONS.get(sourceType);
        if (forwardTargets != null) {
            List<String> forwardRels = forwardTargets.get(targetType);
            if (forwardRels != null && !forwardRels.isEmpty()) {
                return new ResolvedRelation(sourceId, targetId, forwardRels.get(0));
            }
        }

        // Reverse: target → source (swap direction)
        Map<String, List<String>> reverseTargets = VALID_RELATIONS.get(targetType);
        if (reverseTargets != null) {
            List<String> reverseRels = reverseTargets.get(sourceType);
            if (reverseRels != null && !reverseRels.isEmpty()) {
                return new ResolvedRelation(targetId, sourceId, reverseRels.get(0));
            }
        }

        return null; // No valid relation in either direction
    }

    /**
     * Result of a relationship resolution: the correctly oriented source, target,
     * and relationship type.
     */
    public static record ResolvedRelation(String sourceRef, String targetRef, String relationshipType) {
    }
}
