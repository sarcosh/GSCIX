package com.gscix.backend.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Normalizes entity names into a canonical "dedup key" so that semantically
 * identical entities with cosmetic name variations are recognized as duplicates.
 *
 * <p>Handled variations:
 * <ul>
 *   <li>Parenthetical qualifiers: {@code MuddyWater (Seedworm)} → {@code muddy water}</li>
 *   <li>CamelCase vs delimiters: {@code MuddyWater} / {@code MUDDY_WATER} → {@code muddy water}</li>
 *   <li>Roman vs arabic numerals: {@code Operation True Promise IV} → {@code operation true promise 4}</li>
 * </ul>
 *
 * <p>Intentionally does NOT merge names with different word tokens after normalization,
 * e.g. {@code Handala} ≠ {@code HANDALA HACK} (different threat actors).
 */
public final class EntityNameNormalizer {

    private EntityNameNormalizer() { /* utility class */ }

    // Roman numeral replacement table — ordered from longest to shortest to avoid
    // partial replacements (e.g. "VIII" must be checked before "V" or "II").
    // "I" is only matched as a trailing word (suffix) to avoid false positives like "I Corps".
    private static final Map<Pattern, String> ROMAN_NUMERALS = new LinkedHashMap<>();
    static {
        ROMAN_NUMERALS.put(Pattern.compile("\\bXII\\b",  Pattern.CASE_INSENSITIVE), "12");
        ROMAN_NUMERALS.put(Pattern.compile("\\bXI\\b",   Pattern.CASE_INSENSITIVE), "11");
        ROMAN_NUMERALS.put(Pattern.compile("\\bX\\b",    Pattern.CASE_INSENSITIVE), "10");
        ROMAN_NUMERALS.put(Pattern.compile("\\bIX\\b",   Pattern.CASE_INSENSITIVE), "9");
        ROMAN_NUMERALS.put(Pattern.compile("\\bVIII\\b", Pattern.CASE_INSENSITIVE), "8");
        ROMAN_NUMERALS.put(Pattern.compile("\\bVII\\b",  Pattern.CASE_INSENSITIVE), "7");
        ROMAN_NUMERALS.put(Pattern.compile("\\bVI\\b",   Pattern.CASE_INSENSITIVE), "6");
        ROMAN_NUMERALS.put(Pattern.compile("\\bV\\b",    Pattern.CASE_INSENSITIVE), "5");
        ROMAN_NUMERALS.put(Pattern.compile("\\bIV\\b",   Pattern.CASE_INSENSITIVE), "4");
        ROMAN_NUMERALS.put(Pattern.compile("\\bIII\\b",  Pattern.CASE_INSENSITIVE), "3");
        ROMAN_NUMERALS.put(Pattern.compile("\\bII\\b",   Pattern.CASE_INSENSITIVE), "2");
        // "I" only as a trailing word (suffix) to avoid "I Corps", "I am", etc.
        ROMAN_NUMERALS.put(Pattern.compile("\\bI$",      Pattern.CASE_INSENSITIVE), "1");
    }

    private static final Pattern TRAILING_PARENTHETICAL = Pattern.compile("\\s*\\([^)]*\\)\\s*$");
    private static final Pattern CAMEL_CASE_SPLIT       = Pattern.compile("([a-z])([A-Z])");
    private static final Pattern DELIMITERS             = Pattern.compile("[\\s_\\-]+");

    /**
     * Produces a canonical dedup key from an entity name.
     *
     * @param name the raw entity name (e.g. "MuddyWater (Seedworm)")
     * @return the normalized key (e.g. "muddy water"), or {@code null} if name is null/blank
     */
    public static String normalizeForDedup(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }

        String s = name;

        // 1. Strip trailing parenthetical qualifier
        s = TRAILING_PARENTHETICAL.matcher(s).replaceAll("");

        // 2. Split CamelCase: "MuddyWater" → "Muddy Water"
        s = CAMEL_CASE_SPLIT.matcher(s).replaceAll("$1 $2");

        // 3. Normalize delimiters (_, -, multiple spaces → single space)
        s = DELIMITERS.matcher(s).replaceAll(" ");

        // 4. Convert roman numerals to arabic
        for (Map.Entry<Pattern, String> entry : ROMAN_NUMERALS.entrySet()) {
            s = entry.getKey().matcher(s).replaceAll(entry.getValue());
        }

        // 5. Lowercase + trim
        s = s.trim().toLowerCase();

        return s.isEmpty() ? null : s;
    }
}
