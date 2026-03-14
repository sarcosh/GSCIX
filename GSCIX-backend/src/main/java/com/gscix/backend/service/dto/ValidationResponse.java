package com.gscix.backend.service.dto;

import lombok.Data;
import java.util.List;

@Data
public class ValidationResponse {
    private String status; // "OK", "ERROR", "WARNING"
    private String message;
    private List<ValidationError> errors;

    @Data
    public static class ValidationError {
        private String objectId;
        private String objectType;
        private String property;
        private String error;
    }
}
