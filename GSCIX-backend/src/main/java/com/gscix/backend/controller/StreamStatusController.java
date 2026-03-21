package com.gscix.backend.controller;

import com.gscix.backend.dto.StreamStatusDto;
import com.gscix.backend.service.StreamStatusService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gscix/stream")
public class StreamStatusController {

    private final StreamStatusService streamStatusService;

    public StreamStatusController(StreamStatusService streamStatusService) {
        this.streamStatusService = streamStatusService;
    }

    @GetMapping("/status")
    public ResponseEntity<StreamStatusDto> getStatus() {
        return ResponseEntity.ok(streamStatusService.getStatus());
    }
}
